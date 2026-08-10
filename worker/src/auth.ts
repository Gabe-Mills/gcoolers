/**
 * Admin authentication.
 *
 * Real auth, deliberately: there is no `?admin=true`, no secret URL, and no
 * password checked in the browser. The only credential is a passphrase whose
 * PBKDF2 hash lives in a Worker secret, and a successful login mints an
 * HMAC-signed, HttpOnly, Secure, SameSite=Strict cookie with an expiry inside
 * the signed payload. Nothing about the session is client-modifiable, because
 * any tampering invalidates the signature.
 *
 * Both comparisons are timing-safe. Login is rate limited by the same limiter
 * the submission endpoint uses, so the passphrase cannot be brute forced from
 * a single address at speed.
 */

const enc = new TextEncoder();

export const SESSION_COOKIE = "gc_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const PBKDF2_ITERATIONS = 210_000;

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Constant-time comparison. Bails on length only, which is not secret. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/**
 * Hash a passphrase for storage in the ADMIN_PASSWORD_HASH secret.
 * Format: pbkdf2$<iterations>$<salt-b64url>$<hash-b64url>
 *
 * Generated with `npm run hash-password` — never by hand, and never committed.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;
  const salt = fromB64url(parts[2]);
  const expected = fromB64url(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Signed session token: <payload-b64url>.<hmac-b64url> */
export async function mintSession(secret: string): Promise<{ token: string; expires: Date }> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = b64url(enc.encode(JSON.stringify({ exp: expiresAt, n: nonce })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload)));
  return { token: `${payload}.${b64url(sig)}`, expires: new Date(expiresAt * 1000) };
}

export async function verifySession(token: string | null, secret: string): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".", 2);
  let expected: Uint8Array;
  try {
    expected = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload)));
  } catch {
    return false;
  }
  let given: Uint8Array;
  try {
    given = fromB64url(sig);
  } catch {
    return false;
  }
  if (!timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export function sessionCookie(token: string, expires: Date): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Expires=${expires.toUTCString()}`,
  ].join("; ");
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}
