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
# Assertion count: 112 as of 2026-09-07. If you add or remove assertions, update
# this number -- it is the cheap check that a section did not silently stop
# running (a helper returning empty makes assertions vanish, not fail loudly).
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
# --- three-tier helpers (ADR 0011 matrix: guest / user / superuser) ----------
# The negative axis (guest denied, field tier public) is section 7. These add
# the POSITIVE user axis and the distinct superuser axis. $TOKEN is the ordinary
# demo user (set in step 6); $SU is the superuser (step 4).
# auth_total COLLECTION [querySuffix]  -> totalItems for an ORDINARY-USER read.
# Proves the positive half of the lockdown: a signed-in user CAN read the office
# collections a guest cannot. Asserts on data presence, per the 200-empty gotcha.
auth_total() {
  curl -s "$BASE/api/collections/$1/records?perPage=1${2:-}" \
    -H "Authorization: ${TOKEN:-}" \
    | sed -n 's/.*"totalItems":\([0-9]*\).*/\1/p'
}
# auth_post_status COLLECTION JSON  -> HTTP code of an ORDINARY-USER create.
auth_post_status() {
  curl -s -o /dev/null -w '%{http_code}' -X POST \
    "$BASE/api/collections/$1/records" \
    -H "Content-Type: application/json" -H "Authorization: ${TOKEN:-}" -d "$2"
}
# auth_post_id COLLECTION JSON  -> the id of a record an ORDINARY USER just
# created. Sections that must build a small object graph of their own (rather
# than reading one seed_demo.sh already made) need the new id, not the status.
auth_post_id() {
  curl -s -X POST "$BASE/api/collections/$1/records" \
    -H "Content-Type: application/json" -H "Authorization: ${TOKEN:-}" -d "$2" \
    | sed -n 's/.*"id":"\([a-z0-9]\{15\}\)".*/\1/p' | head -1
}
# auth_delete_status / su_delete_status COLLECTION ID  -> HTTP code of a DELETE
# as ordinary user / as superuser. Deletes are admin-only everywhere
# (deleteRule null), so the two together prove the tier boundary: the same
# request the user is refused, the superuser is granted.
auth_delete_status() {
  curl -s -o /dev/null -w '%{http_code}' -X DELETE \
    "$BASE/api/collections/$1/records/$2" -H "Authorization: ${TOKEN:-}"
}
su_delete_status() {
  curl -s -o /dev/null -w '%{http_code}' -X DELETE \
    "$BASE/api/collections/$1/records/$2" -H "Authorization: ${SU:-}"
}
# anon_field_absent LABEL URL NEEDLE  -- pass when an UNAUTHENTICATED GET of URL
# returns a body that does NOT contain NEEDLE. This is the ONE field-level check
# a collection rule cannot express (ADR 0011 §4): PocketBase rules are
# collection-level, so the PII guarantee for customer_name/phone rests on the
# structural split PLUS the fact that a guest expanding the back-relation gets
# nothing. Asserts on the BODY, not a status -- a leak comes back 200 with the
# needle present, which the status-code gotcha would miss entirely.
anon_field_absent() {
  body=$(curl -s "$2")
  case "$body" in
    *"$3"*) bad "$1 (LEAKED: '$3' present in an anonymous response)" ;;
    *)      ok  "$1 ('$3' absent from anon body)" ;;
  esac
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
for c in projects systems tags segments checklist_templates template_items \
         checks check_items punch_items test_equipment attachments \
         warranties closeout_requirements closeout_log warranty_claims \
         services service_contacts loto_events test_standards calibrations \
         calibration_points service_visits turnover_packages signatures \
         shutdown_templates shutdown_template_steps shutdown_contingencies \
         shutdown_roles shutdowns shutdown_steps shutdown_step_events; do
  code=$(http_status GET "$BASE/api/collections/$c/records?perPage=1")
  if [ "$code" = "200" ]; then ok "collection $c"; else bad "collection $c (HTTP $code)"; fi
done

# ---- 3. the seed library loaded (migration seed) ----------------------------
echo "==> domain library seeded by migration"
atleast "checklist_templates" 26 "$(total checklist_templates)"
atleast "template_items"      197 "$(total template_items)"
# The tank leak test (migration 1789000028) loads from its OWN seed file and its
# own loader, because the early loader (1789000009) runs before migration
# 1789000027 opens the `tank` tag_type and `leak_test` phase enums. That
# ordering is exactly the kind of thing that breaks silently in combination, so
# assert the template landed AND that its items came with it.
TANK_TPL=$(first_id checklist_templates "&filter=(template_key='tank.leakTest')")
if [ -n "$TANK_TPL" ]; then ok "tank leak-test template seeded"; else bad "tank leak-test template MISSING (migration 1789000028)"; fi
nonzero "tank leak-test template items" \
  "$(total template_items "&filter=(template='$TANK_TPL')")"
# Its phase/tag_type enum values really exist on the template (not silently ""):
# NOTE: filter strings here must contain NO SPACES -- curl sends the query raw,
# and a literal space breaks the request (you get an empty body, which the
# assertion helpers report as "expected a positive count, got ''"). `&&` is
# percent-encoded as %26%26 so it is not read as a query-parameter separator.
nonzero "tank template keyed to tag_type=tank, phase=leak_test" \
  "$(total checklist_templates "&filter=(tag_type='tank'%26%26phase='leak_test')")"

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

# ---- 8. the matrix from the OTHER two tiers: user (positive) + superuser ------
# Section 7 proved the guest axis. The lockdown is only half-tested until the
# authenticated tiers are asserted too: a rule that denied EVERYONE would also
# pass section 7. Here an ordinary user must READ what the guest could not and
# WRITE where the field tier may not, and a superuser must be able to do the one
# thing even a signed-in user cannot (delete). ADR 0011 §2 matrix.
echo "==> matrix: authenticated user reads office data + writes segments (ADR 0011)"
PID=$(first_id projects)

# Positive read axis: the same office/PII collections section 7 hid from a guest
# must be READABLE by an ordinary signed-in user. Data presence, not status.
for c in warranties closeout_requirements closeout_log warranty_claims service_contacts; do
  nonzero "user reads $c (auth path)" "$(auth_total "$c")"
done

# The segment lock (migration R / 1789000033, the gap this effort closed): guest
# create is REFUSED, the same create as an authenticated user is ACCEPTED. This
# is the one rule the whole reconciliation turned on, so it is asserted in both
# directions.
rejected "anon segment-create denied (the closed gap)" \
  "$(anon_post_status segments "{\"project\":\"$PID\",\"segment_id\":\"SMOKE-SEG-A\",\"segment_type\":\"pressure_main\"}")"
accepted "user segment-create allowed (auth path)" \
  "$(auth_post_status segments "{\"project\":\"$PID\",\"segment_id\":\"SMOKE-SEG-B\",\"segment_type\":\"pressure_main\"}")"

# Superuser tier is DISTINCT from user tier: deletes are admin-only everywhere
# (deleteRule null). Create a throwaway punch via the accountless field tier,
# then the ordinary user is REFUSED the delete and the superuser is GRANTED it —
# the same request, two tiers, opposite outcomes. Self-cleaning (the record is
# gone by the time the superuser is done).
PUNCH_ID=$(curl -s -X POST "$BASE/api/collections/punch_items/records" \
  -H "Content-Type: application/json" \
  -d "{\"project\":\"$PID\",\"tag\":\"$(first_id tags)\",\"description\":\"smoke tier-test punch\",\"severity\":\"C\",\"status\":\"open\"}" \
  | sed -n 's/.*"id":"\([a-z0-9]\{15\}\)".*/\1/p' | head -1)
rejected "ordinary user CANNOT delete (deletes are admin-only)" "$(auth_delete_status punch_items "$PUNCH_ID")"
accepted "superuser CAN delete (the distinct admin tier)"        "$(su_delete_status   punch_items "$PUNCH_ID")"

# ---- 8b. open->resolve: a linked PAIR, never a mutation (ADR 0012) -----------
# The open half is signed now with result='pending' (a 48-hr tank leak test, a
# bac-t sample awaiting the lab); the resolve half lands later carrying the
# pass/fail and pointing back via `resolves`. The whole point is that resolving
# does NOT edit the open record -- if it did, the ledger would be mutable and
# hard constraint #2 would be broken. So: create the pair, then prove the open
# record is byte-for-byte what it was.
echo "==> open->resolve is an append-only PAIR, not an edit (ADR 0012)"
OPEN_TAG=$(first_id tags)
OPEN_ID=$(curl -s -X POST "$BASE/api/collections/checks/records" \
  -H "Content-Type: application/json" \
  -d "{\"tag\":\"$OPEN_TAG\",\"result\":\"pending\",\"phase\":\"leak_test\",\"performed_by\":\"smoke open\"}" \
  | sed -n 's/.*"id":"\([a-z0-9]\{15\}\)".*/\1/p' | head -1)
if [ -n "$OPEN_ID" ]; then ok "open check created (result=pending)"; else bad "could not create the pending open check"; fi
# Snapshot the open record BEFORE the resolve lands.
OPEN_BEFORE=$(curl -s "$BASE/api/collections/checks/records/$OPEN_ID")
accepted "resolve check created, pointing back via resolves" \
  "$(anon_post_status checks "{\"tag\":\"$OPEN_TAG\",\"result\":\"pass\",\"phase\":\"leak_test\",\"resolves\":\"$OPEN_ID\",\"performed_by\":\"smoke resolve\"}")"
OPEN_AFTER=$(curl -s "$BASE/api/collections/checks/records/$OPEN_ID")
# The load-bearing assertion: the open record is unchanged. `updated` is an
# onUpdate autodate, so ANY write to the row moves it -- comparing the whole
# body therefore catches a mutation even if `result` itself were left alone.
# Guard first: if both fetches failed, the two bodies would be identically
# empty and the comparison would pass while proving nothing.
case "$OPEN_BEFORE" in
  *"\"id\":\"$OPEN_ID\""*) ;;
  *) bad "could not read the open record back -- the non-mutation check below would be vacuous" ;;
esac
if [ "$OPEN_BEFORE" = "$OPEN_AFTER" ]; then
  ok "open record NOT mutated by its resolution (append-only holds)"
else
  bad "open record CHANGED when resolved -- append-only VIOLATED"
fi
# And it is still pending: the resolution carries the verdict, the open half
# never acquires one.
nonzero "open check still result=pending after resolution" \
  "$(total checks "&filter=(id='$OPEN_ID'%26%26result='pending')")"
# The link is real and queryable from the resolve side.
nonzero "resolve check linked by resolves" \
  "$(total checks "&filter=(resolves='$OPEN_ID')")"

# ---- 8c. the newer collections are ruled as docs/API.md says -----------------
# calibrations / calibration_points are CAPTURE-ROUTE-ONLY (createRule null):
# the atomic POST /api/calibrations/capture writes them server-side after
# validating, so a direct client create must be refused even WITH a token.
# (Their PATCH refusals are asserted in section 6.)
echo "==> newer collections match the published contract (ADR 0016 / 0017)"
rejected "direct calibrations create refused (capture route only)" \
  "$(auth_post_status calibrations "{\"tag\":\"$(first_id tags)\",\"result\":\"pass\"}")"
rejected "direct calibration_points create refused (capture route only)" \
  "$(auth_post_status calibration_points "{\"expected\":1,\"as_found\":1,\"as_left\":1}")"
# test_standards is an ordinary office registry: guest refused, user allowed.
# The payload must be COMPLETE and valid (name/serial/cert_date/cert_due_date are
# all required) -- otherwise the guest create would 400 on validation and the
# "denied" assertion would pass without auth having anything to do with it. The
# paired positive below is what proves the guest refusal is the auth rule.
TS_BODY='{"name":"Smoke Standard","serial":"SMOKE-%s","cert_date":"2026-01-01","cert_due_date":"2027-01-01"}'
rejected "anon test_standards create denied" \
  "$(anon_post_status test_standards "$(printf "$TS_BODY" 1)")"
accepted "user test_standards create allowed (same valid payload)" \
  "$(auth_post_status test_standards "$(printf "$TS_BODY" 2)")"
# service_visits create is PUBLIC (accountless field tier, ADR 0017) but shape-
# ruled: exactly one of tag XOR system, and it must belong to the same project.
# Both halves are asserted -- the accountless path works, and the shape rule
# still rejects a cross-project record.
SV_TAG=$(first_id tags)
SV_PROJ=$(curl -s "$BASE/api/collections/tags/records/$SV_TAG?fields=project" \
  | sed -n 's/.*"project":"\([a-z0-9]\{15\}\)".*/\1/p' | head -1)
accepted "anon service_visits create (accountless field tier)" \
  "$(anon_post_status service_visits "{\"project\":\"$SV_PROJ\",\"tag\":\"$SV_TAG\",\"vendor_company\":\"Smoke Vendor\",\"rep_name\":\"S. Tester\",\"date\":\"2026-07-01\",\"purpose\":\"startup_assistance\",\"summary\":\"smoke test visit\",\"client_token\":\"smoke-sv-token-000001\"}")"
rejected "service_visits rejects tag AND system together (shape rule)" \
  "$(anon_post_status service_visits "{\"project\":\"$SV_PROJ\",\"tag\":\"$SV_TAG\",\"system\":\"$(first_id systems)\",\"vendor_company\":\"Smoke Vendor\",\"rep_name\":\"S. Tester\",\"date\":\"2026-07-01\",\"purpose\":\"other\",\"summary\":\"invalid two-subject visit\",\"client_token\":\"smoke-sv-token-000002\"}")"
rejected "service_visits reject PATCH (append-only)" \
  "$(patch_status service_visits "$(first_id service_visits)" '{"summary":"tampered"}')"

# ---- 8d. shutdown runbooks: office plan, accountless execution (ADR 0019) ----
# The asymmetry IS the design, so both halves are asserted together. PLANNING a
# shutdown is an office act and needs an account; LOGGING what happened is a
# gloved hand at 2 AM in the rain on a live main and must work with no account
# at all (hard constraint #1). A login wall on the execution ledger is the one
# thing guaranteed to make it get written from memory afterwards, which is the
# failure the module exists to prevent.
#
# The events are append-only, so a malformed record is PERMANENT -- which is why
# the shape is enforced by the createRule rather than the UI, and why both the
# accept and the refuse direction are pinned here.
echo "==> shutdown runbooks: planning gated, execution accountless (ADR 0019)"

SD_PROJ=$(first_id projects)
rejected "anon shutdowns create denied (planning is an office act)" \
  "$(anon_post_status shutdowns "{\"project\":\"$SD_PROJ\",\"title\":\"anon plan\"}")"
SD_ID=$(auth_post_id shutdowns "{\"project\":\"$SD_PROJ\",\"title\":\"Smoke tie-in\"}")
if [ -n "$SD_ID" ]; then ok "user shutdowns create allowed (same payload)"; else bad "user shutdowns create FAILED"; fi

# A template + contingency, so contingency_invoked has something real to name.
SD_TPL=$(auth_post_id shutdown_templates '{"name":"Smoke runbook"}')
SD_CON=$(auth_post_id shutdown_contingencies "{\"template\":\"$SD_TPL\",\"seq\":1,\"trigger\":\"valve fails to hold\",\"action\":\"secondary isolation or abort\"}")
SD_STEP=$(auth_post_id shutdown_steps "{\"shutdown\":\"$SD_ID\",\"seq\":1,\"group\":\"window\",\"description\":\"Verify zero pressure at work point\",\"hold_point\":true}")

# The accountless half. No token anywhere in these calls.
accepted "anon shutdown_step_events create (accountless execution logging)" \
  "$(anon_post_status shutdown_step_events "{\"shutdown\":\"$SD_ID\",\"step\":\"$SD_STEP\",\"kind\":\"completed\",\"performed_by\":\"smoke crew\",\"client_token\":\"smoke-sd-token-000001\"}")"
# `aborted` is about the whole shutdown, not a step -- `step` is nullable for it.
accepted "anon aborted event with no step (abort is shutdown-level)" \
  "$(anon_post_status shutdown_step_events "{\"shutdown\":\"$SD_ID\",\"kind\":\"aborted\",\"performed_by\":\"smoke super\",\"client_token\":\"smoke-sd-token-000002\"}")"

# Shape rule, both directions for each clause.
rejected "contingency_invoked without a contingency refused" \
  "$(anon_post_status shutdown_step_events "{\"shutdown\":\"$SD_ID\",\"kind\":\"contingency_invoked\",\"client_token\":\"smoke-sd-token-000003\"}")"
accepted "contingency_invoked naming a contingency allowed" \
  "$(anon_post_status shutdown_step_events "{\"shutdown\":\"$SD_ID\",\"kind\":\"contingency_invoked\",\"contingency\":\"$SD_CON\",\"client_token\":\"smoke-sd-token-000004\"}")"
rejected "not_performed without a reason refused" \
  "$(anon_post_status shutdown_step_events "{\"shutdown\":\"$SD_ID\",\"step\":\"$SD_STEP\",\"kind\":\"not_performed\",\"client_token\":\"smoke-sd-token-000005\"}")"
accepted "not_performed with an ADR 0018 reason allowed" \
  "$(anon_post_status shutdown_step_events "{\"shutdown\":\"$SD_ID\",\"step\":\"$SD_STEP\",\"kind\":\"not_performed\",\"not_performed_reason\":\"access_blocked\",\"client_token\":\"smoke-sd-token-000006\"}")"

# Offline replay: the outbox re-POSTs a queued event after a dead zone. The
# unique client_token makes the duplicate a refused write rather than a second
# entry in a ledger nobody can edit afterwards.
rejected "duplicate client_token refused (idempotent offline replay)" \
  "$(anon_post_status shutdown_step_events "{\"shutdown\":\"$SD_ID\",\"kind\":\"aborted\",\"performed_by\":\"smoke super\",\"client_token\":\"smoke-sd-token-000002\"}")"

# Append-only, asserted from the ordinary-user tier (deleteRule/updateRule null
# means superuser-only, and a superuser can always write -- the client tiers are
# what must be refused).
SD_EV=$(first_id shutdown_step_events)
rejected "shutdown_step_events reject PATCH (append-only)" \
  "$(patch_status shutdown_step_events "$SD_EV" '{"note":"tampered"}')"
rejected "shutdown_step_events reject DELETE (append-only)" \
  "$(auth_delete_status shutdown_step_events "$SD_EV")"

# ---- 9. field-level PII: the back-relation expand a guest must not pierce -----
# The collection rule hides service_contacts as a list/view (section 7). The
# remaining escape is EXPAND: a guest reading a public service could ask
# PocketBase to expand the back-relation and pull the contact along with it.
# PocketBase applies the target's viewRule to expands, so this should come back
# with an empty expand -- but nothing else in this suite proves it, and a future
# rule change could silently open it. Pick a service that actually HAS a contact
# (so there is something to leak), then assert the anon expand body carries no
# customer_name key at all.
echo "==> field-level PII: guest cannot expand service_contacts off a service"
SVC_WITH_CONTACT=$(curl -s "$BASE/api/collections/service_contacts/records?perPage=1" \
  -H "Authorization: $SU" | sed -n 's/.*"service":"\([a-z0-9]\{15\}\)".*/\1/p' | head -1)
anon_field_absent "anon expand of service_contacts_via_service carries no PII" \
  "$BASE/api/collections/services/records/$SVC_WITH_CONTACT?expand=service_contacts_via_service" \
  "customer_name"

# ---- 10. the clean-URL hook routes serve (printed on QR labels = contract) ---
echo "==> clean-URL routes serve"
accepted "/t/{tag} route"     "$(http_status GET "$BASE/t/PMP-1002")"
accepted "/s/{service} route" "$(http_status GET "$BASE/s/$(first_id services)")"

# ---- turnover: the seal is only evidence if it reproduces (ADR 0010) --------
# The golden vector was a console.log until 2026-08-04 -- on drift it printed
# one line to a console nobody reads and kept sealing packages with hashes no
# independent verifier could reproduce. ADR 0010 says the fixture "ships as a
# test"; these assertions are what makes that true. The build route now refuses
# on mismatch, so a drifted canonicalizer fails HERE rather than silently
# producing worthless evidence.
echo "==> turnover build seals a reproducible hash (ADR 0010)"
TP_PROJECT=$(first_id projects)
turnover_build() {
  curl -s -X POST "$BASE/api/turnover/build" \
    -H "Content-Type: application/json" -H "Authorization: ${TOKEN:-}" \
    -d "{\"project\":\"$TP_PROJECT\",\"title\":\"smoke\"}"
}
TP1=$(turnover_build)
TP1_HASH=$(printf '%s' "$TP1" | sed -n 's/.*"content_hash":"\([0-9a-f]*\)".*/\1/p')
TP1_ALGO=$(printf '%s' "$TP1" | sed -n 's/.*"hash_algo":"\([^"]*\)".*/\1/p')

case "$TP1_ALGO" in
  sha256-canon-v1) ok "build route seals under the pinned algo ($TP1_ALGO)" ;;
  *) bad "build route algo: expected sha256-canon-v1, got '${TP1_ALGO:-<none>}'" ;;
esac

# 64 lowercase hex = a real SHA-256. Guards against an empty/absent hash field
# being read as "fine" by a looser check.
case "$TP1_HASH" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*)
    if [ "${#TP1_HASH}" -eq 64 ]; then ok "content_hash is 64-char lowercase hex"
    else bad "content_hash length: expected 64, got ${#TP1_HASH}"; fi ;;
  *) bad "content_hash missing or malformed ('${TP1_HASH:-<none>}')" ;;
esac

# DETERMINISM is the property that makes the hash evidence at all: the same
# unchanged scope must seal to the same bytes, or no third party can ever
# recompute it. generated_at/generated_by are deliberately OUTSIDE the hashed
# manifest (only algo/scope/records/truncated enter it), so a rebuild with no
# ledger changes MUST match exactly.
TP2=$(turnover_build)
TP2_HASH=$(printf '%s' "$TP2" | sed -n 's/.*"content_hash":"\([0-9a-f]*\)".*/\1/p')
if [ -n "$TP1_HASH" ] && [ "$TP1_HASH" = "$TP2_HASH" ]; then
  ok "rebuilding an unchanged scope reproduces the identical hash (canonicalizer is deterministic)"
else
  bad "hash NOT reproducible: first '$TP1_HASH' vs rebuild '$TP2_HASH' -- an unverifiable seal"
fi

# A re-issue supersedes the prior package for the same scope (ADR 0010 C3);
# signatures do not carry forward, so the chain is how "current" is derived.
# NOTE: the build response deliberately returns only {id, content_hash,
# hash_algo, standing, records} -- `supersedes` is set on the RECORD, so read it
# back rather than expecting it in the response body.
TP1_ID=$(printf '%s' "$TP1" | sed -n 's/.*"id":"\([a-z0-9]\{15\}\)".*/\1/p')
TP2_ID=$(printf '%s' "$TP2" | sed -n 's/.*"id":"\([a-z0-9]\{15\}\)".*/\1/p')
TP2_SUPERSEDES=$(curl -s "$BASE/api/collections/turnover_packages/records/$TP2_ID" \
  -H "Authorization: ${TOKEN:-}" \
  | sed -n 's/.*"supersedes":"\([a-z0-9]\{15\}\)".*/\1/p')
if [ -n "$TP1_ID" ] && [ "$TP2_SUPERSEDES" = "$TP1_ID" ]; then
  ok "re-issued package supersedes the prior one for the scope"
else
  bad "re-issue supersedes '${TP2_SUPERSEDES:-<none>}', expected the prior package '$TP1_ID'"
fi

# The packages just built are append-only like every other ledger.
rejected "turnover_packages reject PATCH (append-only)" \
  "$(patch_status turnover_packages "$(first_id turnover_packages)" '{"title":"tamper"}')"

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
