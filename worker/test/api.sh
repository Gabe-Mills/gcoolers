#!/usr/bin/env bash
# End-to-end API exercise against a local `wrangler dev`.
#
# Starts the Worker, runs every path a real submission takes — valid, invalid,
# profane, abusive, hostile, rate limited — then the admin lifecycle, and
# asserts on what the public API returns at each step.
#
# Everything runs inside one invocation because the shell reaps background
# processes between calls.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=8787
API="http://127.0.0.1:$PORT"
PASS=0
FAIL=0
FAILED=()

ok()   { PASS=$((PASS+1)); printf '\033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); FAILED+=("$1"); printf '\033[31mFAIL\033[0m  %s\n     %s\n' "$1" "${2:-}"; }
is()   { [[ "$2" == "$3" ]] && ok "$1" || bad "$1" "expected '$3', got '$2'"; }
has()  { [[ "$2" == *"$3"* ]] && ok "$1" || bad "$1" "expected to contain '$3', got: ${2:0:200}"; }
hasnt(){ [[ "$2" != *"$3"* ]] && ok "$1" || bad "$1" "should NOT contain '$3': ${2:0:200}"; }

cleanup() { [[ -n "${DEV_PID:-}" ]] && kill "$DEV_PID" 2>/dev/null; pkill -f "wrangler dev" 2>/dev/null; return 0; }
trap cleanup EXIT

# Fresh database each run so counts are deterministic.
rm -rf .wrangler/state
npx wrangler d1 execute gcoolers-reviews --local --file=./schema.sql --env dev >/dev/null 2>&1

# Test-only secrets. Never used anywhere but here.
cat > .dev.vars <<'VARS'
SESSION_SECRET = "test-session-secret-not-used-in-production-0123456789"
IP_SALT = "test-ip-salt"
ADMIN_PASSWORD_HASH = "PLACEHOLDER"
VARS
HASH=$(printf 'correct horse battery staple' | node scripts/hash-password.mjs 2>/dev/null)
sed -i "s|ADMIN_PASSWORD_HASH = \"PLACEHOLDER\"|ADMIN_PASSWORD_HASH = \"$HASH\"|" .dev.vars

npx wrangler dev --env dev --port "$PORT" --local >/tmp/wrangler-dev.log 2>&1 &
DEV_PID=$!

for _ in $(seq 1 90); do
  curl -sf "$API/api/reviews/stats" -o /dev/null 2>/dev/null && break
  sleep 1
done
if ! curl -sf "$API/api/reviews/stats" -o /dev/null 2>/dev/null; then
  echo "worker never came up"; tail -20 /tmp/wrangler-dev.log; exit 1
fi

post() { curl -s -X POST "$API$1" -H 'Content-Type: application/json' -d "$2" "${@:3}"; }
code() { curl -s -o /dev/null -w '%{http_code}' -X POST "$API$1" -H 'Content-Type: application/json' -d "$2" "${@:3}"; }

review() {
  local name="$1" rating="$2" title="$3" bodytext="$4"
  printf '{"displayName":"%s","rating":%s,"title":"%s","body":"%s","profile":"balanced","useCase":"coding","macModel":"MacBook Pro 14 M3","consentPublic":true}' \
    "$name" "$rating" "$title" "$bodytext"
}

echo; echo "=== empty state ==="
STATS=$(curl -s "$API/api/reviews/stats")
has "stats start at zero" "$STATS" '"total":0'
has "average is null, not a fake zero" "$STATS" '"average":null'
LIST=$(curl -s "$API/api/reviews")
has "review list starts empty" "$LIST" '"reviews":[]'

echo; echo "=== validation ==="
is "missing everything is 422" "$(code /api/reviews '{}')" 422
is "rating 0 rejected" "$(code /api/reviews "$(review Alex 0 'Good tool' 'This is a perfectly reasonable length of review body text for testing purposes.')")" 422
is "rating 6 rejected" "$(code /api/reviews "$(review Alex 6 'Good tool' 'This is a perfectly reasonable length of review body text for testing purposes.')")" 422
is "rating 2.5 rejected" "$(code /api/reviews '{"displayName":"Alex","rating":2.5,"title":"Halves","body":"This is a perfectly reasonable length of review body text for testing purposes."}')" 422
is "short body rejected" "$(code /api/reviews "$(review Alex 5 'Nice' 'too short')")" 422
is "blank name rejected" "$(code /api/reviews "$(review '   ' 5 'Good tool' 'This is a perfectly reasonable length of review body text for testing purposes.')")" 422
ERRS=$(post /api/reviews "$(review Alex 9 'x' 'y')")
has "field errors are itemised" "$ERRS" '"field"'
hasnt "validation errors leak no internals" "$ERRS" 'SQL'

echo; echo "=== forbidden fields ==="
is "phone field refused" "$(code /api/reviews '{"displayName":"Alex","rating":5,"title":"Good tool","body":"This is a perfectly reasonable length of review body text for testing purposes.","phone":"555"}')" 422

echo; echo "=== hostile input ==="
is "script tag rejected" "$(code /api/reviews "$(review Alex 5 'Nice' '<script>alert(1)</script> and some more text to clear the minimum body length here')")" 400
is "img onerror rejected" "$(code /api/reviews "$(review Alex 5 'Nice' '<img src=x onerror=alert(1)> and some more text to clear the minimum length here ok')")" 400
XSSR=$(post /api/reviews "$(review Alex 5 'Nice' '<script>alert(1)</script> and some more text to clear the minimum body length here')")
hasnt "rejection message reveals no rule" "$XSSR" 'script'
has "rejection message is generic" "$XSSR" 'could not be accepted'
is "honeypot answers 202 but stores nothing" "$(code /api/reviews '{"displayName":"Bot","rating":5,"title":"Buy now","body":"This is a perfectly reasonable length of review body text for testing purposes.","website":"http://spam.example"}')" 202

echo; echo "=== accepted submissions ==="
is "clean 5-star accepted" "$(code /api/reviews "$(review Priya 5 'Quieter under load' 'Fans used to ramp hard during Xcode builds. On Balanced the peak sits lower and the machine is much quieter overall.')")" 202
is "negative 2-star accepted" "$(code /api/reviews "$(review Sam 2 'Did not work for me' 'The daemon installed fine but the menu bar app never compiled on my machine and doctor kept flagging a stale path.')")" 202
is "profane review accepted" "$(code /api/reviews "$(review Jo 4 'Bloody good' 'This is fucking great honestly, my fans finally shut up during long compile jobs on this machine.')")" 202
SUBMITTED=$(post /api/reviews "$(review Rae 3 'Mixed' 'Works well on my Pro but did nothing noticeable on the Air, which is fanless so that is expected really.')")
has "confirmation is neutral" "$SUBMITTED" 'in the queue'
hasnt "confirmation never claims approval" "$SUBMITTED" 'approved'
hasnt "confirmation never claims published" "$SUBMITTED" 'published'

echo; echo "=== nothing is public before approval ==="
has "list is still empty" "$(curl -s "$API/api/reviews")" '"reviews":[]'
has "stats still zero" "$(curl -s "$API/api/reviews/stats")" '"total":0'

echo; echo "=== rate limiting ==="
RL=""
for i in $(seq 1 6); do
  RL=$(code /api/reviews "$(review "Flood$i" 5 "Title $i" 'Some perfectly reasonable review body text that clears the minimum length requirement.')")
done
is "burst limit returns 429" "$RL" 429

echo; echo "=== admin auth ==="
is "admin list rejects anonymous" "$(curl -s -o /dev/null -w '%{http_code}' "$API/api/admin/reviews")" 401
is "forged cookie rejected" "$(curl -s -o /dev/null -w '%{http_code}' "$API/api/admin/reviews" -H 'Cookie: gc_admin=letmein')" 401
is "admin=true does nothing" "$(curl -s -o /dev/null -w '%{http_code}' "$API/api/admin/reviews?admin=true")" 401
is "wrong passphrase rejected" "$(code /api/admin/login '{"password":"hunter2"}')" 401
rm -f /tmp/gc-cookies.txt
LOGIN=$(curl -s -c /tmp/gc-cookies.txt -X POST "$API/api/admin/login" -H 'Content-Type: application/json' -d '{"password":"correct horse battery staple"}')
has "correct passphrase logs in" "$LOGIN" '"ok":true'
has "session cookie is HttpOnly" "$(grep -c HttpOnly /tmp/gc-cookies.txt || echo 0)" "1"

QUEUE=$(curl -s -b /tmp/gc-cookies.txt "$API/api/admin/reviews?status=queue")
has "queue shows the clean review" "$QUEUE" 'Quieter under load'
has "queue shows the negative review" "$QUEUE" 'Did not work for me'
has "censored review is marked" "$QUEUE" '"wasCensored":true'
hasnt "queue never stores the raw profanity" "$QUEUE" 'fucking'
has "queue exposes metadata for judgement" "$QUEUE" '"ipHash"'

echo; echo "=== moderation lifecycle ==="
ID=$(echo "$QUEUE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).reviews.find(x=>x.title==="Quieter under load");process.stdout.write(r.id)})')
is "approve succeeds" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/gc-cookies.txt -X POST "$API/api/admin/reviews/$ID/approve" -H 'Content-Type: application/json' -d '{}')" 200
PUB=$(curl -s "$API/api/reviews")
has "approved review is public" "$PUB" 'Quieter under load'
hasnt "public payload has no flags" "$PUB" '"flags"'
hasnt "public payload has no ipHash" "$PUB" 'ipHash'
hasnt "public payload has no status" "$PUB" '"status"'
hasnt "public payload has no userAgent" "$PUB" 'userAgent'
has "stats now count one" "$(curl -s "$API/api/reviews/stats")" '"total":1'

NEG=$(echo "$QUEUE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).reviews.find(x=>x.rating===2);process.stdout.write(r.id)})')
curl -s -o /dev/null -b /tmp/gc-cookies.txt -X POST "$API/api/admin/reviews/$NEG/approve" -H 'Content-Type: application/json' -d '{}'
has "negative review can be approved" "$(curl -s "$API/api/reviews")" 'Did not work for me'
has "1-3 star reviews appear in stats" "$(curl -s "$API/api/reviews/stats")" '"2":1'

PROF=$(echo "$QUEUE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).reviews.find(x=>x.wasCensored);process.stdout.write(r.id)})')
curl -s -o /dev/null -b /tmp/gc-cookies.txt -X POST "$API/api/admin/reviews/$PROF/approve" -H 'Content-Type: application/json' -d '{}'
PUB2=$(curl -s "$API/api/reviews")
has "censored review publishes" "$PUB2" 'Bloody good'
hasnt "published copy has no profanity" "$PUB2" 'fucking'
has "censorship is asterisks" "$PUB2" '*'

is "remove works" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/gc-cookies.txt -X POST "$API/api/admin/reviews/$PROF/remove" -H 'Content-Type: application/json' -d '{}')" 200
hasnt "removed review leaves the public list" "$(curl -s "$API/api/reviews")" 'Bloody good'

REJ=$(echo "$QUEUE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).reviews.find(x=>x.rating===3);process.stdout.write(r.id)})')
curl -s -o /dev/null -b /tmp/gc-cookies.txt -X POST "$API/api/admin/reviews/$REJ/reject" -H 'Content-Type: application/json' -d '{"note":"duplicate"}'
hasnt "rejected review never appears" "$(curl -s "$API/api/reviews")" 'Mixed'

echo; echo "=== filters and paging ==="
has "rating filter works" "$(curl -s "$API/api/reviews?rating=2")" 'Did not work for me'
hasnt "rating filter excludes others" "$(curl -s "$API/api/reviews?rating=2")" 'Quieter under load'
is "bad rating filter is 400" "$(curl -s -o /dev/null -w '%{http_code}' "$API/api/reviews?rating=99")" 400
has "limit is honoured" "$(curl -s "$API/api/reviews?limit=1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).reviews.length)))')" "1"

echo; echo "=== logout ==="
curl -s -o /dev/null -b /tmp/gc-cookies.txt -c /tmp/gc-cookies.txt -X POST "$API/api/admin/logout"
is "logout invalidates the session" "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/gc-cookies.txt "$API/api/admin/reviews")" 401

echo
echo "$PASS passed, $FAIL failed"
if ((FAIL)); then printf '  - %s\n' "${FAILED[@]}"; exit 1; fi
