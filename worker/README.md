# Gcoolers reviews API

The backend behind `/reviews`. A single Cloudflare Worker plus a D1 database —
no framework, no ORM, no build step beyond what `wrangler` does itself.

The site is a static build on GitHub Pages, which cannot keep a secret or hold
state, so review submission needs somewhere to land. This is the smallest thing
that does the job properly: Workers and D1 both have free tiers that comfortably
cover a review page, and D1 is SQLite, so the whole store is one file you can
export and read.

---

## What is stored, and where

One table, `reviews`, in a D1 database. Every column is listed in
[`schema.sql`](./schema.sql) with a comment.

The important design decision: **there is no column for uncensored text.**
`title` and `body` hold the moderated copy and nothing else. If the filter
masked a word, the masked version is what exists — a database dump cannot leak
the original because the original was never written. `flags` holds category
codes such as `body:hate_speech`, never an excerpt.

IP addresses are never stored. `ip_hash` is `SHA-256(IP_SALT + ":" + address)`
truncated to 32 hex characters, used for rate limiting and for spotting the same
source across submissions. Rotating `IP_SALT` invalidates every existing hash,
which also resets everyone's rate limits.

---

## Moderation

Three levels, applied server-side to public free text — display name, title and
body. Technical fields (Mac model, macOS version, Gcoolers version, profile, use
case) are validated against an allowlist of shapes and never reach the word
filter, so `MacBook Air` cannot be mangled by it.

| Level | What it catches | What happens |
|---|---|---|
| 1 | Ordinary swearing | Masked with asterisks. The review still publishes. |
| 2 | Hate speech, threats, self-harm encouragement, explicit content, possible personal data, single spam signals | Stored as `FLAGGED`. Waits for you. |
| 3 | XSS and injection payloads, bot spam, link floods, oversized bodies | Rejected outright with a generic error. Nothing is stored. |

Level 1 resists the usual evasions: leetspeak (`sh1t`), symbol substitution
(`@sshole`), character repetition (`fuuuck`), separators (`f.u.c.k`, `f u c k`),
and Cyrillic or Greek lookalikes. It is also deliberately conservative about
false positives — `assess`, `class`, `Scunthorpe`, `cockpit` and `analysis` all
survive untouched, and `mass hole` does not become an insult. Ordinary swearing
is masked, not blocked: the opinion underneath still gets published.

**Negative reviews are not a moderation category.** A one-star report saying the
software did nothing is published like any other. Level 2 is for abuse, not for
criticism.

### Status lifecycle

```
SUBMITTED ─┬─> PENDING    (clean)      ─┬─> APPROVED ──> REMOVED
           ├─> SANITIZED  (censored)   ─┤
           └─> FLAGGED    (level 2)    ─┴─> REJECTED
```

Nothing is public until it is `APPROVED`. Censoring is not approval — it only
decides whether the report reaches your queue as `SANITIZED` or `FLAGGED`.

The submitter always gets the same neutral answer: *"in the queue for review."*
Someone whose report was flagged is not told it was flagged, and someone whose
report was clean is not told it will be published.

---

## Environment

`wrangler.toml` is committed and contains **no secrets**. Three secrets are set
with `wrangler secret put`, which stores them encrypted on Cloudflare's side and
never writes them to disk:

| Name | What it is | How to generate |
|---|---|---|
| `ADMIN_PASSWORD_HASH` | PBKDF2 hash of your admin passphrase | `npm run hash-password` |
| `SESSION_SECRET` | HMAC key for session cookies | `openssl rand -base64 48` |
| `IP_SALT` | Salt for hashing addresses | `openssl rand -base64 32` |

One plain variable lives in `wrangler.toml` because it is not sensitive:

| Name | What it is |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call the API from a browser |

Never put a secret in `wrangler.toml`, in `[vars]`, or in the website's
`PUBLIC_*` environment — anything prefixed `PUBLIC_` is compiled into the
JavaScript the browser downloads.

---

## Deploying

```bash
cd worker
npm install

# 1. Create the database. Copy the printed database_id into wrangler.toml.
npx wrangler d1 create gcoolers-reviews

# 2. Create the table.
npm run db:remote

# 3. Set the three secrets. The passphrase is piped straight in and never
#    written to a file or your shell history.
npm run hash-password | npx wrangler secret put ADMIN_PASSWORD_HASH
openssl rand -base64 48 | npx wrangler secret put SESSION_SECRET
openssl rand -base64 32 | npx wrangler secret put IP_SALT

# 4. Ship it.
npm run deploy
```

Then point the website at it. In the site's build environment set:

```
PUBLIC_REVIEWS_API=https://gcoolers-reviews.<your-subdomain>.workers.dev
```

or a custom domain such as `https://reviews.gcoolers.com`. For GitHub Actions,
add it as a repository variable and expose it in the build step. Until it is
set, `/reviews` renders its empty state and the form says submissions are not
open — the site never breaks over it.

Whatever origin you choose must also appear in `ALLOWED_ORIGINS`.

---

## How to moderate

Everything is authenticated. There is no `?admin=true`, no unlisted URL, and no
password checked in the browser: the passphrase is verified server-side against
a PBKDF2 hash, and a successful login returns an HMAC-signed, `HttpOnly`,
`Secure`, `SameSite=Strict` cookie with its expiry inside the signature. Editing
the cookie invalidates it. Login is rate limited to five attempts per fifteen
minutes per address.

```bash
API=https://reviews.gcoolers.com

# Log in once; the cookie lasts 8 hours.
curl -sc cookies.txt -X POST "$API/api/admin/login" \
  -H 'Content-Type: application/json' -d '{"password":"YOUR PASSPHRASE"}'

# Everything waiting on you: PENDING, SANITIZED and FLAGGED, oldest first.
curl -sb cookies.txt "$API/api/admin/reviews?status=queue" | jq

# Act on one. Actions: approve | reject | remove | unflag
curl -sb cookies.txt -X POST "$API/api/admin/reviews/<id>/approve" \
  -H 'Content-Type: application/json' -d '{"note":"why, for your own records"}'
```

The queue shows you the moderated text, the flag codes, whether anything was
masked, the hashed address, and the user-agent — enough to judge a submission
without storing the abuse itself.

- **approve** — publishes it. It appears on `/reviews` immediately, and in the
  static HTML at the next site build.
- **reject** — never publishes. Use for spam and abuse.
- **remove** — takes down something already published, e.g. on request.
- **unflag** — clears a false positive back to `PENDING` so you can approve it.

A short `note` is stored with the decision and is never public.

---

## Running it locally

```bash
npm run db:local     # create the local SQLite copy
npm run dev          # wrangler dev on :8787
npm test             # moderation unit tests
bash test/api.sh     # full end-to-end API suite
```

`test/api.sh` starts its own Worker against a throwaway database and exercises
the whole surface: validation, hostile input, rate limiting, the moderation
levels, admin auth, and the complete approve/reject/remove lifecycle. It also
asserts that the public payload never contains flags, statuses, hashes or user
agents.

Local development secrets go in `.dev.vars`, which is git-ignored. Never commit
it.

---

## Notes for a future maintainer

- **Rate limiting counts stored rows, not attempts.** An earlier version counted
  every request against the strict budget, which meant three fumbled form
  submissions locked an honest person out for ten minutes before they had posted
  anything. Attempts have their own generous ceiling; the strict budget is only
  spent when a row is actually written.
- **The public list is built column by column**, not by spreading a database
  row. A column added to the table later cannot accidentally become public.
- **Every query is parameterised.** There is no string interpolation anywhere
  near SQL; the sort direction is chosen from a fixed pair rather than passed
  through.
- **The honeypot answers `202`.** A bot that fills the hidden `website` field
  gets the same response a human gets, and nothing is stored. Telling it that it
  failed would only help it try again.
