/**
 * Gcoolers reviews API — Cloudflare Worker + D1.
 *
 * Public:
 *   GET  /api/reviews?limit&cursor&rating&sort   approved reviews only
 *   GET  /api/reviews/stats                      counts computed from approved rows
 *   POST /api/reviews                            submit one
 *
 * Admin (session cookie required on every call):
 *   POST /api/admin/login   { password }
 *   POST /api/admin/logout
 *   GET  /api/admin/session
 *   GET  /api/admin/reviews?status=
 *   POST /api/admin/reviews/:id/:action          approve | reject | remove | unflag
 *
 * Every query is parameterised. Every public response is built field by field
 * from an allowlist, so a column added later cannot accidentally become public,
 * and moderation internals — flags, ip_hash, user agent, notes — have no path
 * to the public surface at all.
 */
import { moderate } from "./moderate";
import { validate, type CleanSubmission } from "./validate";
import {
  clearedCookie,
  mintSession,
  readCookie,
  SESSION_COOKIE,
  sessionCookie,
  verifyPassword,
  verifySession,
} from "./auth";

export interface Env {
  DB: D1Database;
  /** Comma-separated list of allowed browser origins. */
  ALLOWED_ORIGINS: string;
  /** pbkdf2$... — set with `wrangler secret put ADMIN_PASSWORD_HASH`. */
  ADMIN_PASSWORD_HASH: string;
  /** Random 32+ byte string — `wrangler secret put SESSION_SECRET`. */
  SESSION_SECRET: string;
  /** Random string — `wrangler secret put IP_SALT`. Rotating it resets limits. */
  IP_SALT: string;
}

const MAX_BODY_BYTES = 16 * 1024;
const PAGE_SIZE = 12;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "https://gcoolers.com",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function json(data: unknown, init: ResponseInit = {}, request?: Request, env?: Env): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...(request && env ? corsHeaders(request, env) : {}),
    ...((init.headers as Record<string, string>) || {}),
  };
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/**
 * Fixed-window counters.
 *
 * Two kinds of limit, deliberately separated:
 *
 *   attempts  — every request that reaches the endpoint, counted on arrival.
 *               Generous. This exists to stop someone hammering the Worker.
 *   accepted  — incremented only after a row is actually written. Strict.
 *
 * Counting attempts against the strict budget was the first version, and it
 * was wrong: three fumbled form submissions — a short body, a missing title —
 * burned the whole allowance and locked an honest person out for ten minutes
 * before they had posted anything at all. A rate limit should bound what gets
 * stored, not punish typing.
 */
const windowOf = (windowSeconds: number) => {
  const now = Math.floor(Date.now() / 1000);
  return now - (now % windowSeconds);
};

async function bumpLimit(env: Env, bucket: string, windowSeconds: number): Promise<number> {
  const windowStart = windowOf(windowSeconds);
  await env.DB.prepare(
    `INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?1, ?2, 1)
     ON CONFLICT(bucket, window_start) DO UPDATE SET hits = hits + 1`,
  )
    .bind(bucket, windowStart)
    .run();
  const row = await env.DB.prepare(`SELECT hits FROM rate_limits WHERE bucket = ?1 AND window_start = ?2`)
    .bind(bucket, windowStart)
    .first<{ hits: number }>();
  // Opportunistic sweep so the table cannot grow without bound.
  if (Math.random() < 0.02) {
    await env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?1`)
      .bind(windowStart - windowSeconds * 4)
      .run();
  }
  return row?.hits ?? 0;
}

/** Read a counter without touching it. */
async function peekLimit(env: Env, bucket: string, windowSeconds: number): Promise<number> {
  const row = await env.DB.prepare(`SELECT hits FROM rate_limits WHERE bucket = ?1 AND window_start = ?2`)
    .bind(bucket, windowOf(windowSeconds))
    .first<{ hits: number }>();
  return row?.hits ?? 0;
}

async function overLimit(env: Env, bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  return (await bumpLimit(env, bucket, windowSeconds)) > limit;
}

/** How many reviews one address may actually get into the queue. */
const ACCEPTED_PER_HOUR = 5;
const ACCEPTED_PER_DAY = 12;
/** How hard one address may hammer the endpoint, valid or not. */
const ATTEMPTS_PER_10_MIN = 40;

/** The only shape a review ever takes in public. Built key by key on purpose. */
interface PublicReview {
  id: string;
  displayName: string;
  rating: number;
  title: string;
  body: string;
  macModel: string | null;
  macosVersion: string | null;
  gcoolersVersion: string | null;
  profile: string | null;
  useCase: string | null;
  link: string | null;
  createdAt: number;
}

function toPublic(row: Record<string, unknown>): PublicReview {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    rating: Number(row.rating),
    title: String(row.title),
    body: String(row.body),
    macModel: (row.mac_model as string) ?? null,
    macosVersion: (row.macos_version as string) ?? null,
    gcoolersVersion: (row.gcoolers_version as string) ?? null,
    profile: (row.profile as string) ?? null,
    useCase: (row.use_case as string) ?? null,
    link: (row.link as string) ?? null,
    createdAt: Number(row.created_at),
  };
}

const PUBLIC_COLUMNS =
  "id, display_name, rating, title, body, mac_model, macos_version, gcoolers_version, profile, use_case, link, created_at";

/* ------------------------------------------------------------------ *
 * Public endpoints
 * ------------------------------------------------------------------ */

async function listReviews(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || PAGE_SIZE, 1), 50);
  const cursor = Number(url.searchParams.get("cursor")) || null;
  const ratingParam = url.searchParams.get("rating");
  const rating = ratingParam ? Number(ratingParam) : null;
  const sort = url.searchParams.get("sort") === "oldest" ? "ASC" : "DESC";

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return json({ error: "Invalid rating filter." }, { status: 400 }, request, env);
  }

  // Cursor pagination on created_at. Sort direction is chosen from a fixed set
  // rather than interpolated, so it cannot carry SQL.
  const where: string[] = ["status = 'APPROVED'"];
  const binds: unknown[] = [];
  if (rating !== null) {
    where.push(`rating = ?${binds.length + 1}`);
    binds.push(rating);
  }
  if (cursor) {
    where.push(`created_at ${sort === "DESC" ? "<" : ">"} ?${binds.length + 1}`);
    binds.push(cursor);
  }
  binds.push(limit + 1);

  const { results } = await env.DB.prepare(
    `SELECT ${PUBLIC_COLUMNS} FROM reviews WHERE ${where.join(" AND ")}
     ORDER BY created_at ${sort} LIMIT ?${binds.length}`,
  )
    .bind(...binds)
    .all<Record<string, unknown>>();

  const rows = results ?? [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).map(toPublic);
  return json(
    { reviews: page, nextCursor: hasMore ? page[page.length - 1]?.createdAt ?? null : null },
    {},
    request,
    env,
  );
}

async function reviewStats(request: Request, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT rating, COUNT(*) AS n FROM reviews WHERE status = 'APPROVED' GROUP BY rating`,
  ).all<{ rating: number; n: number }>();

  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let total = 0;
  let sum = 0;
  for (const row of results ?? []) {
    distribution[String(row.rating)] = row.n;
    total += row.n;
    sum += row.rating * row.n;
  }
  // The average is returned as null rather than 0 when there is nothing to
  // average, so the page can omit the stat instead of printing a false zero.
  return json({ total, average: total ? Number((sum / total).toFixed(2)) : null, distribution }, {}, request, env);
}

async function submitReview(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ipHash = await hashIp(ip, env.IP_SALT || "unsalted");

  // Cheap protection first: this counts every request, valid or not.
  if (await overLimit(env, `attempt:${ipHash}`, ATTEMPTS_PER_10_MIN, 600)) {
    return json({ error: "Too many requests. Please try again later." }, { status: 429 }, request, env);
  }
  // The strict budget is only *read* here. It is incremented after a row is
  // written, so failed validation never costs a submitter their allowance.
  if (
    (await peekLimit(env, `accepted:${ipHash}`, 3_600)) >= ACCEPTED_PER_HOUR ||
    (await peekLimit(env, `accepted-day:${ipHash}`, 86_400)) >= ACCEPTED_PER_DAY
  ) {
    return json({ error: "Too many submissions. Please try again later." }, { status: 429 }, request, env);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "That submission could not be accepted." }, { status: 413 }, request, env);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "That submission could not be accepted." }, { status: 400 }, request, env);
  }

  // Honeypot: a field no human sees. Answer as if accepted so bots learn
  // nothing, but write nothing.
  if (typeof (payload as Record<string, unknown>)?.website === "string" && (payload as Record<string, string>).website) {
    return json({ status: "received" }, { status: 202 }, request, env);
  }

  const checked = validate(payload);
  if (!checked.ok) {
    return json({ error: "Some fields need attention.", fields: checked.errors }, { status: 422 }, request, env);
  }
  const value: CleanSubmission = checked.value;

  // Public free text goes through moderation. Technical fields do not.
  const modTitle = moderate(value.title, "title");
  const modBody = moderate(value.body, "body");
  const modName = moderate(value.displayName, "displayName");

  if (modTitle.severity === "rejected" || modBody.severity === "rejected" || modName.severity === "rejected") {
    // Deliberately generic: an attacker learns nothing about what tripped.
    return json({ error: "That submission could not be accepted." }, { status: 400 }, request, env);
  }

  const flags = [...modTitle.flags, ...modBody.flags, ...modName.flags];
  const censored = modTitle.censored || modBody.censored || modName.censored;
  const flagged = modTitle.severity === "flagged" || modBody.severity === "flagged" || modName.severity === "flagged";

  // Everything waits for a human. Censoring is not approval — it only decides
  // whether the queue entry arrives as SANITIZED or FLAGGED.
  const status = flagged ? "FLAGGED" : censored ? "SANITIZED" : "PENDING";

  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO reviews (
       id, display_name, rating, title, body,
       mac_model, macos_version, gcoolers_version, profile, use_case, link,
       consent_public, status, flags, was_censored,
       ip_hash, user_agent, created_at, updated_at
     ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)`,
  )
    .bind(
      id,
      modName.text,
      value.rating,
      modTitle.text,
      modBody.text,
      value.macModel,
      value.macosVersion,
      value.gcoolersVersion,
      value.profile,
      value.useCase,
      value.link,
      value.consentPublic ? 1 : 0,
      status,
      JSON.stringify(flags),
      censored ? 1 : 0,
      ipHash,
      (request.headers.get("User-Agent") || "").slice(0, 200),
      now,
      now,
    )
    .run();

  // Only a stored row costs the submitter part of their allowance.
  await bumpLimit(env, `accepted:${ipHash}`, 3_600);
  await bumpLimit(env, `accepted-day:${ipHash}`, 86_400);

  // The same neutral answer regardless of outcome: a flagged submitter is not
  // told they were flagged, and a clean one is not told they are approved.
  return json(
    {
      status: "received",
      message: "Thanks — your field report is in the queue for review.",
    },
    { status: 202 },
    request,
    env,
  );
}

/* ------------------------------------------------------------------ *
 * Admin
 * ------------------------------------------------------------------ */

async function requireAdmin(request: Request, env: Env): Promise<boolean> {
  return verifySession(readCookie(request, SESSION_COOKIE), env.SESSION_SECRET || "");
}

async function adminLogin(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ipHash = await hashIp(ip, env.IP_SALT || "unsalted");
  if (await overLimit(env, `login:${ipHash}`, 5, 900)) {
    return json({ error: "Too many attempts." }, { status: 429 }, request, env);
  }
  if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) {
    return json({ error: "Admin is not configured." }, { status: 503 }, request, env);
  }

  let password = "";
  try {
    password = String(((await request.json()) as Record<string, unknown>).password ?? "");
  } catch {
    /* fall through to the generic failure below */
  }
  if (!password || !(await verifyPassword(password, env.ADMIN_PASSWORD_HASH))) {
    return json({ error: "Incorrect passphrase." }, { status: 401 }, request, env);
  }

  const { token, expires } = await mintSession(env.SESSION_SECRET);
  return json({ ok: true }, { status: 200, headers: { "Set-Cookie": sessionCookie(token, expires) } }, request, env);
}

const ADMIN_COLUMNS = `${PUBLIC_COLUMNS}, status, flags, was_censored, consent_public, ip_hash, user_agent, updated_at, moderated_at, moderator_note`;

async function adminList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "queue";
  const valid = ["SUBMITTED", "AUTO", "SANITIZED", "PENDING", "FLAGGED", "APPROVED", "REJECTED", "REMOVED"];

  let sql: string;
  let binds: unknown[] = [];
  if (status === "queue") {
    sql = `SELECT ${ADMIN_COLUMNS} FROM reviews WHERE status IN ('PENDING','SANITIZED','FLAGGED') ORDER BY created_at ASC LIMIT 200`;
  } else if (valid.includes(status)) {
    sql = `SELECT ${ADMIN_COLUMNS} FROM reviews WHERE status = ?1 ORDER BY created_at DESC LIMIT 200`;
    binds = [status];
  } else {
    return json({ error: "Unknown status." }, { status: 400 }, request, env);
  }

  const stmt = binds.length ? env.DB.prepare(sql).bind(...binds) : env.DB.prepare(sql);
  const { results } = await stmt.all<Record<string, unknown>>();
  return json(
    {
      reviews: (results ?? []).map((r) => ({
        ...toPublic(r),
        status: r.status,
        flags: JSON.parse(String(r.flags || "[]")),
        wasCensored: Number(r.was_censored) === 1,
        consentPublic: Number(r.consent_public) === 1,
        ipHash: r.ip_hash,
        userAgent: r.user_agent,
        moderatedAt: r.moderated_at,
        moderatorNote: r.moderator_note,
      })),
    },
    {},
    request,
    env,
  );
}

const ACTIONS: Record<string, string> = {
  approve: "APPROVED",
  reject: "REJECTED",
  remove: "REMOVED",
  unflag: "PENDING",
};

async function adminAct(request: Request, env: Env, id: string, action: string): Promise<Response> {
  const next = ACTIONS[action];
  if (!next) return json({ error: "Unknown action." }, { status: 400 }, request, env);

  let note: string | null = null;
  try {
    const parsed = (await request.json()) as Record<string, unknown>;
    if (typeof parsed.note === "string") note = parsed.note.slice(0, 500);
  } catch {
    /* a note is optional */
  }

  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `UPDATE reviews SET status = ?1, moderated_at = ?2, updated_at = ?2, moderator_note = COALESCE(?3, moderator_note) WHERE id = ?4`,
  )
    .bind(next, now, note, id)
    .run();

  if (!result.meta.changes) return json({ error: "Not found." }, { status: 404 }, request, env);
  return json({ ok: true, status: next }, {}, request, env);
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (path === "/api/reviews" && request.method === "GET") return await listReviews(request, env);
      if (path === "/api/reviews/stats" && request.method === "GET") return await reviewStats(request, env);
      if (path === "/api/reviews" && request.method === "POST") return await submitReview(request, env);

      if (path === "/api/admin/login" && request.method === "POST") return await adminLogin(request, env);
      if (path === "/api/admin/logout" && request.method === "POST") {
        return json({ ok: true }, { headers: { "Set-Cookie": clearedCookie() } }, request, env);
      }

      if (path.startsWith("/api/admin/")) {
        if (!(await requireAdmin(request, env))) {
          return json({ error: "Not authorised." }, { status: 401 }, request, env);
        }
        if (path === "/api/admin/session") return json({ ok: true }, {}, request, env);
        if (path === "/api/admin/reviews" && request.method === "GET") return await adminList(request, env);

        const m = /^\/api\/admin\/reviews\/([0-9a-f-]{36})\/([a-z]+)$/.exec(path);
        if (m && request.method === "POST") return await adminAct(request, env, m[1], m[2]);
      }

      return json({ error: "Not found." }, { status: 404 }, request, env);
    } catch (err) {
      // Never surface internals. The message is generic; the detail goes to the
      // Worker log where only the operator can see it.
      console.error("reviews-api", err instanceof Error ? err.stack : String(err));
      return json({ error: "Something went wrong." }, { status: 500 }, request, env);
    }
  },
};
