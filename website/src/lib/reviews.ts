/**
 * Reviews API client.
 *
 * The site is a static build on GitHub Pages, so reviews cannot be baked in at
 * publish time and stay correct — a review approved an hour after a deploy
 * would not appear until the next one. The page therefore does both: the build
 * fetches whatever exists at that moment (which gives real structured data in
 * the HTML), and the browser refreshes from the same API on load.
 *
 * Every failure path returns empty rather than throwing. A reviews page that
 * renders its empty state because the API is unreachable is a much better
 * outcome than one that renders a stack trace.
 */

export interface Review {
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

export interface ReviewStats {
  total: number;
  /** null when there is nothing to average — never a placeholder zero. */
  average: number | null;
  distribution: Record<string, number>;
}

export const EMPTY_STATS: ReviewStats = {
  total: 0,
  average: null,
  distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
};

/**
 * Set PUBLIC_REVIEWS_API to the deployed Worker origin, e.g.
 * https://reviews.gcoolers.com. Left unset, the page degrades to its empty
 * state and the form says submissions are not open yet, which is honest
 * rather than broken.
 */
export const API_BASE: string =
  (import.meta.env.PUBLIC_REVIEWS_API as string | undefined)?.replace(/\/+$/, "") || "";

export const isConfigured = () => API_BASE.length > 0;

const TIMEOUT_MS = 8000;

async function get<T>(path: string, fallback: T): Promise<T> {
  if (!isConfigured()) return fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export interface ReviewPage {
  reviews: Review[];
  nextCursor: number | null;
}

export function fetchReviews(opts: { limit?: number; cursor?: number | null; rating?: number | null; sort?: "newest" | "oldest" } = {}) {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", String(opts.cursor));
  if (opts.rating) params.set("rating", String(opts.rating));
  if (opts.sort === "oldest") params.set("sort", "oldest");
  const qs = params.toString();
  return get<ReviewPage>(`/api/reviews${qs ? `?${qs}` : ""}`, { reviews: [], nextCursor: null });
}

export function fetchStats() {
  return get<ReviewStats>("/api/reviews/stats", EMPTY_STATS);
}

export interface SubmitPayload {
  displayName: string;
  rating: number;
  title: string;
  body: string;
  macModel?: string;
  macosVersion?: string;
  gcoolersVersion?: string;
  profile?: string;
  useCase?: string;
  link?: string;
  consentPublic: boolean;
  /** Honeypot. Always empty for a human — the field is hidden from everyone. */
  website?: string;
}

export type SubmitResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fields?: Array<{ field: string; message: string }> };

export async function submitReview(payload: SubmitPayload): Promise<SubmitResult> {
  if (!isConfigured()) {
    return { ok: false, message: "Submissions are not open yet." };
  }
  try {
    const res = await fetch(`${API_BASE}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 202) {
      return { ok: true, message: String(data.message || "Thanks — your field report is in the queue for review.") };
    }
    if (res.status === 429) {
      return { ok: false, message: "You have sent a few already. Please try again later." };
    }
    if (res.status === 422) {
      return {
        ok: false,
        message: String(data.error || "Some fields need attention."),
        fields: (data.fields as Array<{ field: string; message: string }>) || [],
      };
    }
    return { ok: false, message: String(data.error || "That could not be sent. Please try again.") };
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection and try again." };
  }
}

/* ------------------------------------------------------------------ *
 * Display helpers
 * ------------------------------------------------------------------ */

export const PROFILE_LABELS: Record<string, string> = {
  quiet: "Quiet",
  balanced: "Balanced",
  cool: "Cool",
  mixed: "Mixed",
};

export const USE_CASE_LABELS: Record<string, string> = {
  coding: "Coding",
  gaming: "Gaming",
  video: "Video",
  meetings: "Meetings",
  everyday: "Everyday",
  other: "Other",
};

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Build-time fetch used by the Astro page. Kept separate from the browser
 * client so a build against an unreachable API is a silent no-op rather than a
 * failed deploy.
 */
export async function fetchAtBuild(): Promise<{ reviews: Review[]; stats: ReviewStats }> {
  if (!isConfigured()) return { reviews: [], stats: EMPTY_STATS };
  try {
    const [page, stats] = await Promise.all([fetchReviews({ limit: 12 }), fetchStats()]);
    return { reviews: page.reviews, stats };
  } catch {
    return { reviews: [], stats: EMPTY_STATS };
  }
}
