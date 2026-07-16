#!/bin/sh
# LoopCheck combined smoke test -- the integration gate.
#
# Boots a FRESH PocketBase from the repo's migrations, runs the full
# seed_demo.sh, and asserts the whole stack is healthy WHEN EVERY MODULE
# RUNS TOGETHER: every migration applied, every module's demo seed
# populated, the append-only / close-once rules still hold, and the clean
# URL routes serve.
#
# WHY THIS EXISTS: each module is built in its own session and verified in
# isolation, where that module's own migration and seed block look fine.
# The failures this catches only appear in combination --
#   * a migration-number collision or a migration that throws on load,
#   * a seed probe that wrongly skips a whole module against the combined
#     API (this is how a services block once seeded 0 records silently),
#   * an append-only rule loosened by accident in a later migration,
#   * a create-rule change (e.g. the tag/system/service XOR) that breaks
#     another module's records.
# Run it BEFORE a module commit lands, not after.
#
# It writes ONLY through the public REST API a sidecar uses (via
# seed_demo.sh) plus the admin bootstrap an operator would use -- no
# pb_data/ surgery. The throwaway database lives in a gitignored
# pb_data_smoke/ and is deleted on exit; the operator's real pb_data/ is
# never touched.
#
# Usage:   ./scripts/smoke_test.sh
#          LC_TEST_PORT=8500 ./scripts/smoke_test.sh
# Exit:    0 = all assertions passed;  1 = a regression;  2 = setup failure.
#
# Needs: the pocketbase binary in the repo root (scripts/setup.sh), curl,
# and GNU date (seed_demo.sh's requirement).

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${LC_TEST_PORT:-8399}"
BASE="http://127.0.0.1:$PORT"
DATA_DIR="$ROOT/pb_data_smoke"   # gitignored; relative so the native binary reads it on every OS
ADMIN_EMAIL="smoke-admin@example.com"
ADMIN_PASS="smokeadmin-123456"
DEMO_EMAIL="smoke-demo@example.com"
DEMO_PASS="smokedemo-123456"

# pocketbase binary: .exe on Windows/Git Bash, bare elsewhere.
PB="./pocketbase"
[ -f ./pocketbase.exe ] && PB="./pocketbase.exe"
if [ ! -f "$PB" ]; then
  echo "FATAL: pocketbase binary not found in repo root. Run scripts/setup.sh first." >&2
  exit 2
fi

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    # Block until the process is actually reaped -- on Windows the DB files
    # stay locked until it fully exits, so rm-ing before this races and fails.
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  # Belt-and-suspenders: the OS can hold the file handles a moment longer.
  n=0
  while [ -d "$DATA_DIR" ] && [ "$n" -lt 10 ]; do
    rm -rf "$DATA_DIR" 2>/dev/null && break
    n=$((n + 1)); sleep 1
  done
}
trap cleanup EXIT INT TERM

# ---- tiny assertion harness -------------------------------------------------
PASS=0; FAIL=0
ok()  { PASS=$((PASS + 1)); printf '  PASS  %s\n' "$1"; }
bad() { FAIL=$((FAIL + 1)); printf '  FAIL  %s\n' "$1"; }
# nonzero LABEL ACTUAL  -- pass when ACTUAL is an integer > 0 (a module's
# seed block populated its collection; 0 means it was silently skipped).
nonzero() {
  case "$2" in
    ''|*[!0-9]*) bad "$1: expected a positive count, got '$2'" ;;
    0)           bad "$1: expected > 0, got 0 (module seed skipped?)" ;;
    *)           ok "$1 ($2)" ;;
  esac
}
# zero LABEL ACTUAL  -- pass when ACTUAL is exactly 0. Used for the negative
# access check: a guest must see nothing in an auth-gated collection. A nonzero
# count means the office listRule leaked data to an unauthenticated request.
zero() {
  case "$2" in
    0)           ok "$1 (guest sees 0)" ;;
    ''|*[!0-9]*) bad "$1: expected 0, got '$2'" ;;
    *)           bad "$1: guest saw $2 (office data LEAKED to anon)" ;;
  esac
}
# atleast LABEL FLOOR ACTUAL  -- pass when ACTUAL >= FLOOR.
atleast() {
  case "$3" in ''|*[!0-9]*) bad "$1: got '$3'"; return;; esac
  if [ "$3" -ge "$2" ]; then ok "$1 ($3 >= $2)"; else bad "$1: expected >= $2, got $3"; fi
}
# rejected LABEL CODE  -- pass when CODE is NOT 2xx (the write was refused).
rejected() { case "$2" in 2*) bad "$1 (got $2 -- write was ALLOWED)";; *) ok "$1 (HTTP $2)";; esac; }
# accepted LABEL CODE  -- pass when CODE is 2xx.
accepted() { case "$2" in 2*) ok "$1 (HTTP $2)";; *) bad "$1 (HTTP $2)";; esac; }

# ---- API helpers ------------------------------------------------------------
# These reads carry the superuser token ($SU, set in step 4) so they can see
# the office-gated collections. The auth lockdown (migration H, ADR 0011) puts
# warranties / closeout_requirements / closeout_log / warranty_claims behind
# listRule=AUTH — an UNAUTHENTICATED list of those returns 200 with an empty
# filtered result (not 403), which would make this gate read them as 0 and
# wrongly cry "module seed skipped." $SU is empty before step 4; the reads
# used before then are of public collections, where an empty token is fine.
# total COLLECTION [querySuffix]  -> totalItems for the query
total() {
  curl -s "$BASE/api/collections/$1/records?perPage=1${2:-}" \
    -H "Authorization: ${SU:-}" \
    | sed -n 's/.*"totalItems":\([0-9]*\).*/\1/p'
}
# first_id COLLECTION [querySuffix]  -> first matching 15-char record id
first_id() {
  curl -s "$BASE/api/collections/$1/records?perPage=1${2:-}" \
    -H "Authorization: ${SU:-}" \
    | sed -n 's/.*"id":"\([a-z0-9]\{15\}\)".*/\1/p' | head -1
}
# anon_total COLLECTION [querySuffix]  -> totalItems for an UNAUTHENTICATED read.
# Deliberately sends NO token: this is exactly what a guest / accountless field
# scan sees. An office collection behind listRule=AUTH returns 200 with an empty
# filtered result to a guest, so this comes back 0 even though the data exists.
anon_total() {
  curl -s "$BASE/api/collections/$1/records?perPage=1${2:-}" \
    | sed -n 's/.*"totalItems":\([0-9]*\).*/\1/p'
}
# anon_post_status COLLECTION JSON  -> HTTP code of an UNAUTHENTICATED create.
# Sends no token: the accountless field tier (a QR scan, no login) must still be
# able to POST a check / punch flag (ADR 0011 §3), and this proves that path.
anon_post_status() {
  curl -s -o /dev/null -w '%{http_code}' -X POST \
    "$BASE/api/collections/$1/records" \
    -H "Content-Type: application/json" -d "$2"
}
# http_status METHOD URL           -> HTTP code, no body
http_status() { curl -s -o /dev/null -w '%{http_code}' -X "$1" "$2"; }
# patch_status COLLECTION ID JSON  -> HTTP code of an authenticated PATCH
patch_status() {
  curl -s -o /dev/null -w '%{http_code}' -X PATCH \
    "$BASE/api/collections/$1/records/$2" \
    -H "Content-Type: application/json" -H "Authorization: $TOKEN" -d "$3"
}

# ---- 0. clean slate + guard the port ----------------------------------------
rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR"
if curl -s -o /dev/null "$BASE/api/health" 2>/dev/null; then
  echo "FATAL: something is already listening on port $PORT." >&2
  echo "       Set LC_TEST_PORT to a free port and retry." >&2
  exit 2
fi

# ---- 1. bootstrap admin + boot the server -----------------------------------
echo "==> booting a fresh PocketBase on port $PORT (throwaway DB)"
"$PB" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASS" \
  --dir="$DATA_DIR" --migrationsDir="$ROOT/pb_migrations" \
  --hooksDir="$ROOT/pb_hooks" --publicDir="$ROOT/pb_public" >"$DATA_DIR/setup.log" 2>&1 \
  || { echo "FATAL: superuser bootstrap failed:" >&2; cat "$DATA_DIR/setup.log" >&2; exit 2; }

"$PB" serve --http="127.0.0.1:$PORT" \
  --dir="$DATA_DIR" --migrationsDir="$ROOT/pb_migrations" \
  --hooksDir="$ROOT/pb_hooks" --publicDir="$ROOT/pb_public" >"$DATA_DIR/serve.log" 2>&1 &
SERVER_PID=$!

i=0
until curl -s -o /dev/null "$BASE/api/health" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "FATAL: server did not come up in 30s. serve.log:" >&2
    cat "$DATA_DIR/serve.log" >&2
    exit 2
  fi
  sleep 1
done
echo "  up (migrations applied with no fatal error)"

# ---- 2. every expected collection exists ------------------------------------
echo "==> all migrations present (collection set)"
for c in projects systems tags checklist_templates template_items \
         checks check_items punch_items test_equipment attachments \
         warranties closeout_requirements closeout_log warranty_claims \
         services service_contacts loto_events test_standards calibrations \
         calibration_points; do
  code=$(http_status GET "$BASE/api/collections/$c/records?perPage=1")
  if [ "$code" = "200" ]; then ok "collection $c"; else bad "collection $c (HTTP $code)"; fi
done

# ---- 3. the seed library loaded (migration seed) ----------------------------
echo "==> domain library seeded by migration"
atleast "checklist_templates" 26 "$(total checklist_templates)"
atleast "template_items"      197 "$(total template_items)"

# ---- 4. run the real demo seed ----------------------------------------------
echo "==> creating demo user + running scripts/seed_demo.sh"
SU=$(curl -s -X POST "$BASE/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$SU" ] || { echo "FATAL: could not authenticate as the smoke superuser." >&2; exit 2; }
ucode=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/collections/users/records" \
  -H "Content-Type: application/json" -H "Authorization: $SU" \
  -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASS\",\"passwordConfirm\":\"$DEMO_PASS\"}")
case "$ucode" in 2*) ;; *) echo "FATAL: could not create demo user (HTTP $ucode)." >&2; exit 2;; esac

LC_URL="$BASE" LC_EMAIL="$DEMO_EMAIL" LC_PASSWORD="$DEMO_PASS" \
  sh "$ROOT/scripts/seed_demo.sh" >"$DATA_DIR/seed.log" 2>&1 \
  || { echo "FATAL: seed_demo.sh aborted -- the combined API rejected something:" >&2; cat "$DATA_DIR/seed.log" >&2; exit 2; }
echo "  seed ran to completion"

# ---- 5. every module's seed actually populated ------------------------------
# Non-empty, not exact: a module silently skipping (probe misfire) drops its
# collection to 0, which is the integration failure this gate is for. Exact
# counts would break every time the demo data is tweaked.
echo "==> each module's demo seed populated (> 0)"
nonzero "projects"              "$(total projects)"
nonzero "systems"               "$(total systems)"
nonzero "tags"                  "$(total tags)"
nonzero "checks"                "$(total checks)"
nonzero "punch_items"           "$(total punch_items)"
nonzero "warranties"            "$(total warranties)"
nonzero "closeout_requirements" "$(total closeout_requirements)"
nonzero "closeout_log"          "$(total closeout_log)"
nonzero "warranty_claims"       "$(total warranty_claims)"
nonzero "services"              "$(total services)"
nonzero "service_contacts"      "$(total service_contacts)"
nonzero "loto_events"           "$(total loto_events)"
nonzero "test_standards"        "$(total test_standards)"
nonzero "calibrations"          "$(total calibrations)"
nonzero "calibration_points"    "$(total calibration_points)"
nonzero "adjusted calibrations" "$(total calibrations "&filter=(result='adjusted_pass')")"
nonzero "expired-standard calibration flag" "$(total calibrations "&filter=(standard_expired_at_use=true)")"
# service-subject checks prove the tag/system/service XOR create-rule still
# admits a service subject (Migration D) after every later migration.
nonzero "service-subject checks" "$(total checks "&filter=(service!='')")"

# ---- 6. append-only / close-once rules survive the combined migrations ------
echo "==> immutability rules hold (hard constraint #2)"
TOKEN=$(curl -s -X POST "$BASE/api/collections/users/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "FATAL: could not authenticate as the demo user." >&2; exit 2; }

rejected "checks reject PATCH"        "$(patch_status checks       "$(first_id checks)"       '{"notes":"tampered"}')"
rejected "loto_events reject PATCH"   "$(patch_status loto_events  "$(first_id loto_events)"  '{"note":"tampered"}')"
rejected "loto_events reject DELETE"  "$(http_status DELETE "$BASE/api/collections/loto_events/records/$(first_id loto_events)")"
rejected "closeout_log reject PATCH"  "$(patch_status closeout_log "$(first_id closeout_log)" '{"note":"tampered"}')"
rejected "calibrations reject PATCH"  "$(patch_status calibrations "$(first_id calibrations)" '{"notes":"tampered"}')"
rejected "calibration_points reject PATCH" "$(patch_status calibration_points "$(first_id calibration_points)" '{"as_left":999}')"
rejected "closed warranty_claim frozen" "$(patch_status warranty_claims "$(first_id warranty_claims "&filter=(closed_at!='')")" '{"resolution_note":"tampered"}')"
# The positive half of close-once: an OPEN claim still accepts edits.
accepted "open warranty_claim editable" "$(patch_status warranty_claims "$(first_id warranty_claims "&filter=(closed_at='')")" '{"resolution_note":"smoke-test edit"}')"

# ---- 7. the auth lockdown gates office data from the accountless field tier --
# ADR 0011 / migrations H + I. The field tier has NO account (a scanned QR is
# the whole interaction, hard constraint #1), so "denied to the field tier"
# means denied to an UNAUTHENTICATED request. Section 5 already read these
# office collections WITH the superuser token and found them populated; here an
# ANONYMOUS read of the same collections must come back empty, while the
# field-scan collections must stay publicly readable. This guards both failure
# directions: a listRule reverted to public would leak warranty/closeout data
# to anyone who reaches the URL, and an over-broad lockdown would break the
# accountless field tier the product is defined by.
echo "==> auth lockdown: office data hidden from anon, field tier still public (ADR 0011)"
# Negative: office / PII collections show a guest NOTHING. They are populated
# (Section 5), so a guest total of 0 proves listRule=AUTH is filtering.
for c in warranties closeout_requirements closeout_log warranty_claims service_contacts; do
  zero "anon list $c denied" "$(anon_total "$c")"
done
# viewRule too: a guest fetching a known office record id is refused (not 2xx).
rejected "anon view of a warranty refused" \
  "$(http_status GET "$BASE/api/collections/warranties/records/$(first_id warranties)")"
# Positive (hard constraint #1): the lockdown must NOT wall off the field tier.
# A guest still reads the field-scan collections a QR code lands on.
nonzero "anon list tags (field tier public)"         "$(anon_total tags)"
nonzero "anon list checks (field ledger public)"     "$(anon_total checks)"
nonzero "anon list loto_events (safety never gated)" "$(anon_total loto_events)"
# Write side of the same guard: the accountless field tier can still LOG a check
# with no account (ADR 0011 §3), even though office writes (tags/systems/
# projects) now require auth. A real tag is the subject; the checks createRule
# needs a subject, not a token.
accepted "anon check-create (accountless field logging)" \
  "$(anon_post_status checks "{\"tag\":\"$(first_id tags)\",\"result\":\"pass\",\"phase\":\"installation\"}")"

# ---- 8. the clean-URL hook routes serve (printed on QR labels = contract) ----
echo "==> clean-URL routes serve"
accepted "/t/{tag} route"     "$(http_status GET "$BASE/t/PMP-1002")"
accepted "/s/{service} route" "$(http_status GET "$BASE/s/$(first_id services)")"

# ---- report -----------------------------------------------------------------
echo ""
echo "-------------------------------------------------------------"
echo "smoke test: $PASS passed, $FAIL failed"
echo "-------------------------------------------------------------"
if [ "$FAIL" -ne 0 ]; then
  echo "COMBINED STACK REGRESSED -- do not land this until green." >&2
  exit 1
fi
echo "OK -- the combined stack reproduces from scratch and is healthy."
