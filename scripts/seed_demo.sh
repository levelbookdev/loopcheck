#!/bin/sh
# LoopCheck demo seed -- fills a LOCAL instance with realistic fake
# commissioning data for sidecar/premium development and demos, so they run
# against the real API contract instead of mock JSON.
#
# This script is a living exercise of the public API contract
# (docs/API.md): it writes ONLY through the documented REST endpoints,
# authenticated as an ORDINARY user -- exactly as a sidecar would
# (ADR 0003). No superuser calls, no pb_data/ access.
#
# Usage:
#   LC_EMAIL=demo@example.com LC_PASSWORD=demopass1234 ./scripts/seed_demo.sh
#   LC_URL=http://192.168.1.50:8090 LC_EMAIL=... LC_PASSWORD=... ./scripts/seed_demo.sh
#
# The demo user must exist first: create it in the admin UI -- collections
# -> users -> new record. (Phase-1 API rules are still permissive, so the
# token is not strictly required *today* -- but the auth lockdown is coming,
# and a seed script that skipped auth would quietly break that day. This
# script behaves like the sidecar must: sign in, send the token, always.)
#
# Idempotence: aborts if the sentinel project ("Cedar Hollow WRF Phase II
# Expansion") already exists, so re-running cannot duplicate data. To
# reseed, start from a fresh pb_data/ (or delete the demo records).
#
# HONEST LIMITATION -- timestamps: `created` is server-assigned (an
# append-only ledger you could backdate would not be much of a ledger), so
# every seeded record is stamped "now". Punch-item AGE cannot be faked
# through the public API -- the at-risk story lives in open A-severity
# items sitting on soon-starting systems, and in the dates that ARE
# client-set: systems.planned_startup, checks.performed_at, and
# punch_items.closed_at.
#
# The fictional plant (Cedar Hollow WRF, Cedar Hollow Sanitation District,
# Meridian Engineering Group, Blue Rock Constructors) and every person named
# here are invented; any resemblance to a real project is accidental.
#
# Needs: curl, and GNU date for the date arithmetic (Linux and Git Bash
# have it; on macOS: brew install coreutils -> gdate).

set -eu

LC_URL="${LC_URL:-http://127.0.0.1:8090}"
LC_EMAIL="${LC_EMAIL:-}"
LC_PASSWORD="${LC_PASSWORD:-}"

# GNU date on Linux/Git Bash, gdate on macOS.
DATE=date
date -d "+1 day" +%F >/dev/null 2>&1 || DATE=gdate

if [ -z "$LC_EMAIL" ] || [ -z "$LC_PASSWORD" ]; then
  echo "Set LC_EMAIL and LC_PASSWORD to a normal user account." >&2
  echo "No account yet? Create one in the admin UI:" >&2
  echo "  1. Open $LC_URL/_/" >&2
  echo "  2. Collections -> users -> New record (email + password)" >&2
  echo "  3. Re-run:  LC_EMAIL=... LC_PASSWORD=... $0" >&2
  exit 1
fi

TMP="$(mktemp)"
TAGMAP="$(mktemp)"   # "tag_number recordId systemId" lines, for lookups
trap 'rm -f "$TMP" "$TAGMAP"' EXIT

# days_from N -> "YYYY-MM-DD 00:00:00" N days from today (negative = past)
days_from() { echo "$($DATE -d "$1 day" +%F) 00:00:00"; }

# ---- API helpers ------------------------------------------------------------
# api METHOD path [json] -> response body in $TMP; aborts loudly on non-2xx.
api() {
  _code=$(curl -s -o "$TMP" -w '%{http_code}' -X "$1" "$LC_URL/api/$2" \
    -H "Content-Type: application/json" \
    -H "Authorization: ${TOKEN:-}" \
    ${3:+-d "$3"})
  case "$_code" in
    2*) ;;
    *) echo "API $1 $2 failed (HTTP $_code):" >&2
       cat "$TMP" >&2; echo >&2
       exit 1 ;;
  esac
}

# Record id out of the last response (PocketBase ids are 15 chars).
rid() { sed -n 's/.*"id":"\([a-z0-9]\{15\}\)".*/\1/p' "$TMP" | head -1; }

# ---- Sign in (exactly as a sidecar would: auth-with-password) ----------------
TOKEN=""
_code=$(curl -s -o "$TMP" -w '%{http_code}' -X POST \
  "$LC_URL/api/collections/users/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$LC_EMAIL\",\"password\":\"$LC_PASSWORD\"}")
TOKEN=$(sed -n 's/.*"token":"\([^"]*\)".*/\1/p' "$TMP")
if [ -z "$TOKEN" ]; then
  echo "Could not sign in as $LC_EMAIL (HTTP $_code) -- check the" >&2
  echo "credentials, or create the account in the admin UI:" >&2
  echo "  $LC_URL/_/  -> collections -> users -> New record" >&2
  exit 1
fi
echo "Signed in as $LC_EMAIL"

# ---- Idempotence sentinel -----------------------------------------------------
api GET "collections/projects/records?filter=(name~'Cedar%20Hollow%20WRF')&perPage=1"
if grep -q 'Cedar Hollow WRF' "$TMP"; then
  echo "ABORT: demo data already present (found the sentinel project" >&2
  echo "'Cedar Hollow WRF...'). Re-running would duplicate records." >&2
  echo "Reseed against a fresh pb_data/, or delete the demo records first." >&2
  exit 1
fi

echo "Seeding demo data into $LC_URL ..."

# ---- Project ------------------------------------------------------------------
api POST "collections/projects/records" '{
  "name": "Cedar Hollow WRF Phase II Expansion",
  "owner_name": "Cedar Hollow Sanitation District",
  "engineer_of_record": "Meridian Engineering Group",
  "contractor_name": "Blue Rock Constructors, Inc."
}'
PROJ=$(rid)
echo "  1 project (Cedar Hollow WRF)"

# ---- Systems (8) -- staggered startups; the first two are AT RISK (<14 days) --
# sys NUMBER NAME SEQ DAYS_TO_STARTUP
sys() {
  api POST "collections/systems/records" "{
    \"project\": \"$PROJ\", \"number\": \"$1\", \"name\": \"$2\",
    \"startup_sequence\": $3, \"planned_startup\": \"$(days_from "$4")\"
  }"
  rid
}
S10=$(sys 10 "Influent Pump Station"   1  7)   # at risk
S15=$(sys 15 "Headworks Screening"     2 12)   # at risk
S21=$(sys 21 "Grit Removal"            3 21)
S32=$(sys 32 "RAS-WAS Pumping"         4 28)
S41=$(sys 41 "Aeration Basins"         5 35)
S45=$(sys 45 "Blower Building"         6 42)
S53=$(sys 53 "Chlorine Contact"        7 51)
S61=$(sys 61 "Effluent Pump Station"   8 60)
echo "  8 systems (startups staggered +7..+60 days; systems 10 and 15 inside 14)"

# ---- Tags (60) -- the Migration A reference block populated on every one -----
# Table: tag|type|description|sysvar|pid|area|spec|loops|plc|mcc|drawings
TAGS=0
while IFS='|' read -r tno ttype tdesc tsys tpid tarea tspec tloop tplc tmcc tdwg; do
  [ -z "$tno" ] && continue
  eval "_sid=\$$tsys"
  api POST "collections/tags/records" "{
    \"project\": \"$PROJ\", \"system\": \"$_sid\",
    \"tag_number\": \"$tno\", \"tag_type\": \"$ttype\",
    \"description\": \"$tdesc\", \"pid_reference\": \"$tpid\",
    \"area\": \"$tarea\", \"spec_section\": \"$tspec\",
    \"loop_numbers\": \"$tloop\", \"plc\": \"$tplc\",
    \"mcc_breaker\": \"$tmcc\", \"drawing_refs\": \"$tdwg\"
  }"
  printf '%s %s %s\n' "$tno" "$(rid)" "$_sid" >> "$TAGMAP"
  TAGS=$((TAGS + 1))
done <<'EOT'
PMP-1001|pump_centrifugal|Influent Pump No. 1|S10|M-101|Area 1|11312|1001|PLC-1|MCC-1A / 3|E-601 P-101
PMP-1002|pump_centrifugal|Influent Pump No. 2|S10|M-101|Area 1|11312|1002|PLC-1|MCC-1A / 5|E-601 P-101
PMP-1003|pump_centrifugal|Influent Pump No. 3|S10|M-101|Area 1|11312|1003|PLC-1|MCC-1A / 7|E-601 P-101
LIT-1010|instrument_level|Influent Wet Well Level|S10|M-101|Area 1|17300|1010|PLC-1||I-101
FIT-1020|instrument_flow|Plant Influent Flow|S10|M-102|Area 1|17300|1020|PLC-1||I-101
MOV-1031|valve_motor_operated|Influent Isolation Valve No. 1|S10|M-101|Area 1|15100|1031|PLC-1|MCC-1A / 9|E-601
MOV-1032|valve_motor_operated|Influent Isolation Valve No. 2|S10|M-101|Area 1|15100|1032|PLC-1|MCC-1A / 10|E-601
PSH-1040|instrument_pressure|Influent Header High Pressure|S10|M-102|Area 1|17300|1040|PLC-1||I-102
MOV-1501|valve_motor_operated|Screen Channel Inlet Gate No. 1|S15|M-151|Area 1|15100|1501|PLC-1|MCC-1B / 2|E-602
MOV-1502|valve_motor_operated|Screen Channel Inlet Gate No. 2|S15|M-151|Area 1|15100|1502|PLC-1|MCC-1B / 3|E-602
PMP-1503|pump_centrifugal|Screenings Washer Supply Pump|S15|M-152|Area 1|11312|1503|PLC-1|MCC-1B / 5|E-602
LIT-1510|instrument_level|Screen Channel Level|S15|M-151|Area 1|17300|1510|PLC-1||I-151
FIT-1520|instrument_flow|Washwater Flow|S15|M-152|Area 1|17300|1520|PLC-1||I-151
PSH-1530|instrument_pressure|Washwater High Pressure|S15|M-152|Area 1|17300|1530|PLC-1||I-152
CP-1500|control_panel|Headworks Control Panel|S15|E-201|Area 1|17400|1500 1501 1502|PLC-1|MCC-1B / 1|E-602 E-201
PMP-2101|pump_centrifugal|Grit Pump No. 1|S21|M-211|Area 2|11312|2101|PLC-2|MCC-2A / 3|E-611 P-211
PMP-2102|pump_centrifugal|Grit Pump No. 2|S21|M-211|Area 2|11312|2102|PLC-2|MCC-2A / 5|E-611 P-211
MOV-2110|valve_motor_operated|Grit Classifier Inlet Valve|S21|M-211|Area 2|15100|2110|PLC-2|MCC-2A / 7|E-611
LIT-2120|instrument_level|Grit Chamber Level|S21|M-211|Area 2|17300|2120|PLC-2||I-211
FIT-2130|instrument_flow|Grit Slurry Flow|S21|M-212|Area 2|17300|2130|PLC-2||I-211
CP-2100|control_panel|Grit System Control Panel|S21|E-202|Area 2|17400|2100|PLC-2|MCC-2A / 1|E-611 E-202
PMP-3201|pump_centrifugal|RAS Pump No. 1|S32|M-321|Area 3|11312|3201|PLC-3|MCC-3A / 3|E-621 P-321
PMP-3202|pump_centrifugal|RAS Pump No. 2|S32|M-321|Area 3|11312|3202|PLC-3|MCC-3A / 5|E-621 P-321
PMP-3203|pump_centrifugal|RAS Pump No. 3|S32|M-321|Area 3|11312|3203|PLC-3|MCC-3A / 7|E-621 P-321
PMP-3204|pump_centrifugal|WAS Pump No. 1|S32|M-322|Area 3|11312|3204|PLC-3|MCC-3A / 9|E-621 P-322
MOV-3210|valve_motor_operated|RAS Header Isolation Valve|S32|M-321|Area 3|15100|3210|PLC-3|MCC-3A / 11|E-621
MOV-3211|valve_motor_operated|WAS Discharge Valve|S32|M-322|Area 3|15100|3211|PLC-3|MCC-3A / 12|E-621
FIT-3220|instrument_flow|RAS Flow|S32|M-321|Area 3|17300|3220|PLC-3||I-321
FIT-3221|instrument_flow|WAS Flow|S32|M-322|Area 3|17300|3221|PLC-3||I-321
MOV-4101|valve_motor_operated|Aeration Air Valve Basin 1|S41|M-411|Area 3|15100|4101|PLC-4|MCC-4A / 2|E-631
MOV-4102|valve_motor_operated|Aeration Air Valve Basin 2|S41|M-411|Area 3|15100|4102|PLC-4|MCC-4A / 3|E-631
MOV-4103|valve_motor_operated|Aeration Air Valve Basin 3|S41|M-412|Area 3|15100|4103|PLC-4|MCC-4A / 4|E-631
MOV-4104|valve_motor_operated|Aeration Air Valve Basin 4|S41|M-412|Area 3|15100|4104|PLC-4|MCC-4A / 5|E-631
FIT-4110|instrument_flow|Air Flow Basin 1-2|S41|M-411|Area 3|17300|4110|PLC-4||I-411
FIT-4111|instrument_flow|Air Flow Basin 3-4|S41|M-412|Area 3|17300|4111|PLC-4||I-411
AIT-4120|analyzer|Dissolved Oxygen Basin 1-2|S41|M-411|Area 3|17300|4120|PLC-4||I-412
AIT-4121|analyzer|Dissolved Oxygen Basin 3-4|S41|M-412|Area 3|17300|4121|PLC-4||I-412
LIT-4130|instrument_level|Splitter Box Level|S41|M-410|Area 3|17300|4130|PLC-4||I-411
CP-4500|control_panel|Blower Building Control Panel|S45|E-203|Area 3|17400|4500|PLC-4|MCC-4B / 1|E-632 E-203
BLW-4501|other|Turbo Blower No. 1|S45|M-451|Area 3|11376|4501|PLC-4|MCC-4B / 3|E-632 P-451
BLW-4502|other|Turbo Blower No. 2|S45|M-451|Area 3|11376|4502|PLC-4|MCC-4B / 5|E-632 P-451
PSH-4510|instrument_pressure|Blower Discharge High Pressure No. 1|S45|M-451|Area 3|17300|4510|PLC-4||I-451
PSH-4511|instrument_pressure|Blower Discharge High Pressure No. 2|S45|M-451|Area 3|17300|4511|PLC-4||I-451
FIT-4520|instrument_flow|Blower Discharge Air Flow|S45|M-451|Area 3|17300|4520|PLC-4||I-451
MOV-4530|valve_motor_operated|Blower Discharge Isolation Valve|S45|M-451|Area 3|15100|4530|PLC-4|MCC-4B / 7|E-632
MOV-5301|valve_motor_operated|Chlorine Contact Inlet Valve|S53|M-531|Area 4|15100|5301|PLC-5|MCC-5A / 2|E-641
MOV-5302|valve_motor_operated|Chlorine Contact Bypass Valve|S53|M-531|Area 4|15100|5302|PLC-5|MCC-5A / 3|E-641
PMP-5303|pump_centrifugal|Sample Pump|S53|M-532|Area 4|11312|5303|PLC-5|MCC-5A / 5|E-641
AIT-5310|analyzer|Chlorine Residual Analyzer|S53|M-532|Area 4|17300|5310|PLC-5||I-531
FIT-5320|instrument_flow|Contact Basin Effluent Flow|S53|M-531|Area 4|17300|5320|PLC-5||I-531
LIT-5330|instrument_level|Contact Basin Level|S53|M-531|Area 4|17300|5330|PLC-5||I-531
PMP-6101|pump_centrifugal|Effluent Pump No. 1|S61|M-611|Area 5|11312|6101|PLC-5|MCC-5B / 3|E-651 P-611
PMP-6102|pump_centrifugal|Effluent Pump No. 2|S61|M-611|Area 5|11312|6102|PLC-5|MCC-5B / 5|E-651 P-611
PMP-6103|pump_centrifugal|Effluent Pump No. 3|S61|M-611|Area 5|11312|6103|PLC-5|MCC-5B / 7|E-651 P-611
LIT-6110|instrument_level|Effluent Wet Well Level|S61|M-611|Area 5|17300|6110|PLC-5||I-611
FIT-6120|instrument_flow|Plant Effluent Flow|S61|M-612|Area 5|17300|6120|PLC-5||I-611
MOV-6131|valve_motor_operated|Effluent Discharge Valve No. 1|S61|M-611|Area 5|15100|6131|PLC-5|MCC-5B / 9|E-651
MOV-6132|valve_motor_operated|Effluent Discharge Valve No. 2|S61|M-611|Area 5|15100|6132|PLC-5|MCC-5B / 10|E-651
PSH-6140|instrument_pressure|Effluent Header High Pressure|S61|M-612|Area 5|17300|6140|PLC-5||I-612
CP-6100|control_panel|Effluent PS Control Panel|S61|E-204|Area 5|17400|6100|PLC-5|MCC-5B / 1|E-651 E-204
EOT
echo "  $TAGS tags (Migration A reference block on every one)"

# tag lookup helpers, reading the map file written above
tag_id()  { awk -v t="$1" '$1==t{print $2}' "$TAGMAP"; }
tag_sys() { awk -v t="$1" '$1==t{print $3}' "$TAGMAP"; }

# ---- Instrument calibration records (ADR 0016) ------------------------------
# Probe first so this living seed still explains itself against a pre-module
# local database. Fresh smoke-test databases always take this branch.
_probe=$(curl -s -o "$TMP" -w '%{http_code}' \
  "$LC_URL/api/collections/test_standards/records?perPage=1" \
  -H "Authorization: $TOKEN")
if [ "$_probe" != "200" ]; then
  echo "  test_standards: collection not found (HTTP $_probe) -- skipping calibration seed"
else
  api POST "collections/test_standards/records" "{
    \"name\": \"Fluke Documenting Process Calibrator\", \"model\": \"754\",
    \"serial\": \"DMO-754-0182\", \"owner\": \"Blue Rock Constructors\",
    \"cert_date\": \"$(days_from -180)\", \"cert_due_date\": \"$(days_from 185)\"}"
  STD_CURRENT=$(rid)
  api POST "collections/test_standards/records" "{
    \"name\": \"Pressure Reference Module\", \"model\": \"PRM-100\",
    \"serial\": \"RENT-44219\", \"owner\": \"West Coast Instrument Rental\",
    \"cert_date\": \"$(days_from -395)\", \"cert_due_date\": \"$(days_from -30)\"}"
  STD_EXPIRED=$(rid)

  # calib TAG STANDARD TECH COMPANY DAYS_AGO INTERVAL RESULT TOKEN POINTS_JSON
  # Posts the same atomic endpoint the offline phone outbox syncs to.
  calib() {
    _code=$(curl -s -o "$TMP" -w '%{http_code}' -X POST \
      "$LC_URL/api/calibrations/capture" \
      -H "Authorization: $TOKEN" \
      -F "tag=$(tag_id "$1")" -F "standard=$2" \
      -F "technician=$3" -F "company=$4" \
      -F "performed_at=$(days_from "-$5")" -F "interval_months=$6" \
      -F "result=$7" -F "client_token=$8" -F "notes=Fictional demo calibration" \
      -F "points_json=$9")
    case "$_code" in
      2*) ;;
      *) echo "calibration capture failed (HTTP $_code):" >&2; cat "$TMP" >&2; exit 1 ;;
    esac
  }

  # Normal adjustment: the as-found mid/span values differ from as-left, but
  # all final readings are within tolerance.
  calib FIT-1020 "$STD_CURRENT" "S. Whitfield" "Precision Controls" 60 12 adjusted_pass \
    demo-cal-fit-1020 '[{"test_point":"0% / 4 mA","expected_value":4,"as_found":4.03,"as_left":4,"unit":"mA","within_tolerance":true},{"test_point":"25% / 8 mA","expected_value":8,"as_found":8.08,"as_left":8,"unit":"mA","within_tolerance":true},{"test_point":"50% / 12 mA","expected_value":12,"as_found":12.14,"as_left":12,"unit":"mA","within_tolerance":true},{"test_point":"75% / 16 mA","expected_value":16,"as_found":16.09,"as_left":16,"unit":"mA","within_tolerance":true},{"test_point":"100% / 20 mA","expected_value":20,"as_found":20.11,"as_left":20,"unit":"mA","within_tolerance":true}]'

  # Overdue instrument: last performed 400 days ago on a 12-month interval.
  calib LIT-1010 "$STD_CURRENT" "S. Whitfield" "Precision Controls" 400 12 pass \
    demo-cal-lit-1010 '[{"test_point":"0% / 4 mA","expected_value":4,"as_found":4,"as_left":4,"unit":"mA","within_tolerance":true},{"test_point":"50% / 12 mA","expected_value":12,"as_found":12,"as_left":12,"unit":"mA","within_tolerance":true},{"test_point":"100% / 20 mA","expected_value":20,"as_found":20,"as_left":20,"unit":"mA","within_tolerance":true}]'

  # Expired-standard-at-use: submission remains valid evidence and the server
  # freezes the red flag because the selected cert was already past due.
  calib PSH-1040 "$STD_EXPIRED" "R. Patel" "Precision Controls" 10 12 pass \
    demo-cal-psh-1040 '[{"test_point":"0% / 4 mA","expected_value":4,"as_found":4,"as_left":4,"unit":"mA","within_tolerance":true},{"test_point":"50% / 12 mA","expected_value":12,"as_found":12,"as_left":12,"unit":"mA","within_tolerance":true},{"test_point":"100% / 20 mA","expected_value":20,"as_found":20,"as_left":20,"unit":"mA","within_tolerance":true}]'
  echo "  2 test standards + 3 calibrations (adjusted pass, overdue, expired-standard flag)"
fi

# ---- Punch items (25) ---------------------------------------------------------
# The at-risk story: systems 10 and 15 start within 14 days and carry OPEN
# A-severity items. (Their true age cannot be faked -- see header note.)
# punch TAG SEV PARTY STATUS CREATED_BY DESC [CLOSED_BY CLOSED_DAYS_AGO CLOSURE_NOTE]
PUNCH=0
punch() {
  _tid=$(tag_id "$1"); _sid=$(tag_sys "$1")
  _body="{\"project\":\"$PROJ\",\"tag\":\"$_tid\",\"system\":\"$_sid\",
    \"severity\":\"$2\",\"assigned_party\":\"$3\",\"status\":\"$4\",
    \"created_by\":\"$5\",\"description\":\"$6\""
  if [ "$4" = "closed" ]; then
    _body="$_body,\"closed_by\":\"$7\",\"closed_at\":\"$(days_from "-$8")\",\"closure_note\":\"$9\""
  fi
  api POST "collections/punch_items/records" "$_body}"
  PUNCH=$((PUNCH + 1))
}

# Open A-items on the two soon-starting systems (the premium demo's alarm bells)
punch PMP-1001 A contractor open "J. Moreno"    "Seal water supply line not connected - do not run until piped and flow verified"
punch PMP-1002 A vendor     open "J. Moreno"    "Motor overload trips at 80 percent speed during uncoupled run - raised by failed energization check; vendor service tech requested"
punch MOV-1031 A contractor open "R. Patel"     "Valve installed backwards per flow arrow - reinstall per P and ID M-101"
punch LIT-1510 A engineer   open "S. Whitfield" "Level element mounted below max surcharge elevation - RFI 118 submitted, awaiting EOR direction"
punch MOV-1501 A contractor open "R. Patel"     "Gate actuator wiring rung out to wrong MCC bucket (Volt Electric) - reterminate per E-602"
# B-items, mixed systems and parties
punch PMP-1003 B vendor     open "J. Moreno"    "OEM spare parts kit and O and M manuals not yet delivered"
punch FIT-1020 B contractor open "S. Whitfield" "Meter grounding rings not installed - straight run OK, grounding per manufacturer pending"
punch PMP-2101 B contractor open "M. Castillo"  "Baseplate grout voids found by sounding - regrout east half"
punch CP-2100  B vendor     open "M. Castillo"  "Panel HMI backlight flickers - warranty claim opened with panel shop"
punch PMP-3202 B contractor open "D. Okafor"    "Coupling guard fasteners missing on outboard end"
punch MOV-4102 B contractor open "D. Okafor"    "Limit switch conduit unsupported over 3 ft - add strut and strap (Volt Electric)"
punch AIT-4120 B vendor     open "S. Whitfield" "DO sensor cal certificate missing from submittal package"
punch BLW-4501 B vendor     open "M. Castillo"  "Inlet filter differential pressure gauge dial cracked - replace under warranty"
punch FIT-6120 B engineer   open "S. Whitfield" "Effluent meter range disagrees with instrument index - RFI 121 pending"
punch PSH-6140 B contractor open "D. Okafor"    "Switch not yet bench tested - cal lab backlog"
# C-items
punch PMP-3201 C contractor open "D. Okafor"    "Touch-up paint required on baseplate edge after grout cleanup (Cascade Coatings)"
punch MOV-5301 C contractor open "R. Patel"     "Handwheel paint overspray - clean or replace (Cascade Coatings)"
punch LIT-6110 C contractor open "J. Moreno"    "Protective film still on transmitter display"
# Closed items -- closure trail populated, closed_at backdated (client-set date)
punch PMP-1001 B contractor closed "J. Moreno"   "Discharge gauge isolation valve missing" "J. Moreno" 12 "Valve installed and gauge reads correct at static head"
punch MOV-1032 B contractor closed "R. Patel"    "Actuator local display upside down - remount" "R. Patel" 9 "Display remounted; verified at local and HMI"
punch PMP-2102 C contractor closed "M. Castillo" "Equipment tag plate missing" "M. Castillo" 20 "Tag plate installed per submittal"
punch FIT-3220 B contractor closed "D. Okafor"   "Meter display conduit drain fitting missing" "D. Okafor" 15 "Drain fitting installed per detail"
punch MOV-4530 A contractor closed "M. Castillo" "Valve seat leak at shutoff during hydro" "M. Castillo" 6 "Seat adjusted per manufacturer; re-tested tight"
punch CP-6100  B vendor     closed "S. Whitfield" "Panel arrived with door gasket damage" "S. Whitfield" 30 "Gasket replaced by panel shop on site"
punch AIT-5310 C vendor     closed "S. Whitfield" "Analyzer reagent bottles expired on delivery" "S. Whitfield" 4 "Fresh reagents delivered and installed"
echo "  $PUNCH punch items (5 open A on at-risk systems; 7 closed with closure trail)"

# ---- Checks -- probe first: Phase 2 may tighten the create rule ----------------
# A check's subject is tag XOR system (ADR 0001). performed_at is client-set
# (the work happened when it happened); `created` is the log stamp.
CHECKS=0
check() { # TAG PHASE RESULT PERFORMED_BY DAYS_AGO [WITNESS] [NOTES]
  _tid=$(tag_id "$1")
  _body="{\"tag\":\"$_tid\",\"phase\":\"$2\",\"result\":\"$3\",
    \"performed_by\":\"$4\",\"performed_at\":\"$(days_from "-$5")\",
    \"witness_required\":false"
  [ -n "${6:-}" ] && _body="$_body,\"witnessed_by\":\"$6\""
  [ -n "${7:-}" ] && _body="$_body,\"notes\":\"$7\""
  api POST "collections/checks/records" "$_body}"
  CHECKS=$((CHECKS + 1))
}

# Probe: can this instance create checks? (Skip gracefully if a later phase
# tightened the rule -- the punch/tag data above still stands on its own.)
_probe=$(curl -s -o "$TMP" -w '%{http_code}' -X POST \
  "$LC_URL/api/collections/checks/records" \
  -H "Content-Type: application/json" -H "Authorization: $TOKEN" \
  -d "{\"tag\":\"$(tag_id PMP-1001)\",\"phase\":\"installation\",\"result\":\"pass\",\"performed_by\":\"J. Moreno\",\"performed_at\":\"$(days_from -40)\",\"witness_required\":false,\"notes\":\"Alignment 2.1 mils TIR final; grout sounded solid\"}")
if [ "$_probe" != "200" ]; then
  echo "  checks: create blocked (HTTP $_probe) -- skipping check seeding."
  echo "          (Expected if a later phase tightened the create rule.)"
else
  CHECKS=1
  check PMP-1001 point_to_point pass "V. Ellison (Volt Electric)" 33 "" "Megger 550 megohm at 1000V, all phases"
  check PMP-1001 energization   pass "V. Ellison (Volt Electric)" 25 "K. Brandt (Meridian)" "Rotation correct; uncoupled amps balanced"
  check PMP-1002 point_to_point pass "V. Ellison (Volt Electric)" 32
  # THE failed check -- pairs with the open A punch on PMP-1002. The
  # machine-readable punch link (source_check) is Migration B; until it
  # lands, the linkage lives in the two descriptions.
  check PMP-1002 energization   fail "V. Ellison (Volt Electric)" 24 "" "Motor overload trips at 80 percent speed on uncoupled run - punch item raised, vendor service requested"
  check MOV-1032 installation   pass "R. Patel" 30
  check MOV-1032 point_to_point pass "V. Ellison (Volt Electric)" 22
  check LIT-1010 installation   pass "S. Whitfield" 28
  check LIT-1010 loop_check     pass "S. Whitfield" 14 "K. Brandt (Meridian)" "0-50-100 percent simulated; HMI tracks within tolerance"
  check FIT-1020 installation   pass "S. Whitfield" 27
  check PMP-2101 installation   pass "M. Castillo" 18
  check MOV-3210 installation   pass "D. Okafor" 10
  check PMP-3201 installation   incomplete "D. Okafor" 8 "" "Alignment pending final pipe strain check"

  # One SYSTEM-subject check (tag XOR system, ADR 0001): a system-level
  # event no single tag owns.
  api POST "collections/checks/records" "{
    \"system\": \"$S10\", \"phase\": \"functional\", \"result\": \"incomplete\",
    \"performed_by\": \"K. Brandt (Meridian)\",
    \"performed_at\": \"$(days_from -3)\", \"witness_required\": false,
    \"notes\": \"Integrated pump-down demonstration attempted; halted on PMP-1002 overload punch item\"
  }"
  CHECKS=$((CHECKS + 1))
  echo "  $CHECKS checks (mixed phases; 1 failed, paired with an A punch; 1 system-subject)"
fi

# ---- Warranty & closeout (ADR 0005) ---------------------------------------------
# Probe first: this instance may predate Migration C.
_probe=$(curl -s -o "$TMP" -w '%{http_code}' \
  "$LC_URL/api/collections/warranties/records?perPage=1" \
  -H "Authorization: $TOKEN")
if [ "$_probe" != "200" ]; then
  echo "  warranties: collection not found (HTTP $_probe) -- skipping the"
  echo "              warranty & closeout module seed (pre-Migration C instance)."
else
  # warranty TAG VENDOR CONTACT PHONE EMAIL BASIS NOTE START_DAYS_AGO MONTHS
  # START_DAYS_AGO="" means the trigger event hasn't happened yet (the
  # "Awaiting trigger event" state); the end date is DERIVED in the UI,
  # never sent here.
  WTY=0
  warranty() {
    _tid=$(tag_id "$1")
    _body="{\"project\":\"$PROJ\",\"tag\":\"$_tid\",\"vendor_name\":\"$2\",
      \"vendor_contact_name\":\"$3\",\"vendor_phone\":\"$4\",\"vendor_email\":\"$5\",
      \"basis\":\"$6\",\"basis_note\":\"$7\""
    [ -n "$8" ] && _body="$_body,\"clock_start_date\":\"$(days_from "-$8")\""
    [ -n "$9" ] && _body="$_body,\"duration_months\":$9"
    api POST "collections/warranties/records" "$_body}"
    WTY=$((WTY + 1))
  }

  # Five varied bases: an awaiting-trigger SC warranty, a shipment-cap
  # example, a startup-based one, one expiring inside 90 days, one EXPIRED.
  warranty PMP-1001 "Demo Pump Co." "A. Rep" "555-0142" "service@example.com" \
    substantial_completion "12 mo from substantial completion per 11312-1.09" "" 12
  warranty BLW-4501 "Demo Blower Co." "B. Rep" "555-0177" "support@example.com" \
    shipment_cap "24 mo from SC or 30 mo from shipment, whichever occurs first - spec 11376-1.08; clock shown from shipment" 120 30
  warranty AIT-5310 "Demo Instrument Co." "C. Rep" "555-0163" "help@example.com" \
    startup "12 mo from successful startup per 17300-1.12" 60 12
  warranty CP-2100 "Demo Panel Co." "D. Rep" "555-0158" "warranty@example.com" \
    beneficial_use "24 mo from beneficial use of the grit system" 670 24
  warranty FIT-1020 "MagnaFlow Instruments" "" "555-0190" "" \
    other "12 mo from delivery per PO 4417 terms" 760 12
  echo "  $WTY warranties (SC awaiting trigger, shipment cap, startup, expiring <90d, expired)"

  # req TAG TYPE DESC STATUS RECEIVED_DAYS_AGO ACCEPTED_BY STORAGE
  # Every status past 'required' also gets its append-only closeout_log
  # entries -- the editable state always has the trail behind it.
  REQS=0
  req() {
    _tid=$(tag_id "$1")
    _body="{\"project\":\"$PROJ\",\"tag\":\"$_tid\",\"req_type\":\"$2\",
      \"description\":\"$3\",\"status\":\"$4\""
    [ -n "$5" ] && _body="$_body,\"received_date\":\"$(days_from "-$5")\""
    [ -n "$6" ] && _body="$_body,\"accepted_by\":\"$6\""
    [ -n "$7" ] && _body="$_body,\"storage_location\":\"$7\""
    api POST "collections/closeout_requirements/records" "$_body}"
    _rid=$(rid)
    api POST "collections/closeout_log/records" \
      "{\"requirement\":\"$_rid\",\"from_status\":\"\",\"to_status\":\"required\",\"changed_by\":\"K. Brandt (Meridian)\",\"note\":\"$3\"}"
    if [ "$4" = "received" ] || [ "$4" = "accepted" ]; then
      api POST "collections/closeout_log/records" \
        "{\"requirement\":\"$_rid\",\"from_status\":\"required\",\"to_status\":\"received\",\"changed_by\":\"K. Brandt (Meridian)\",\"note\":\"${7:-}\"}"
    fi
    if [ "$4" = "accepted" ]; then
      api POST "collections/closeout_log/records" \
        "{\"requirement\":\"$_rid\",\"from_status\":\"received\",\"to_status\":\"accepted\",\"changed_by\":\"${6:-K. Brandt (Meridian)}\",\"note\":\"\"}"
    fi
    REQS=$((REQS + 1))
  }

  req PMP-1001 om_manual   "O and M manuals, 3 hard copies plus PDF per 01730" required "" "" ""
  req PMP-1001 spare_parts "2 spare mechanical seals per 11312-2.05" received 10 "" "Owner's warehouse shelf B3"
  req PMP-1002 spare_parts "Spare impeller and wear rings per 11312-2.05" required "" "" ""
  req BLW-4501 training    "8 hr operator training by factory tech per 11376-3.04" required "" "" ""
  req BLW-4501 om_manual   "Blower O and M manual set per 01730" accepted 30 "K. Brandt (Meridian)" "O and M library, plant admin bldg"
  req AIT-5310 spare_parts "Reagent kit plus spare sensor cartridge" received 5 "" "Lab storage cabinet 2"
  req CP-2100  warranty_cert "Panel warranty certificate, countersigned" accepted 40 "K. Brandt (Meridian)" "Submittal file 17400-02"
  req FIT-1020 test_report "Factory calibration certificate" received 20 "" "Submittal file 17300-04"
  echo "  $REQS closeout requirements (with append-only closeout_log trails)"

  # Claims: one OPEN (pairs with the CP-2100 HMI punch item above) and one
  # CLOSED (frozen by the server's close-once rule the moment closed_at set).
  api POST "collections/warranty_claims/records" "{
    \"project\": \"$PROJ\", \"tag\": \"$(tag_id CP-2100)\",
    \"opened_at\": \"$(days_from -8)\", \"opened_by\": \"S. Whitfield\",
    \"description\": \"HMI backlight flickers at power-up - claim opened with Demo Panel Co.\",
    \"vendor_notified_date\": \"$(days_from -6)\"
  }"
  api POST "collections/warranty_claims/records" "{
    \"project\": \"$PROJ\", \"tag\": \"$(tag_id BLW-4501)\",
    \"opened_at\": \"$(days_from -30)\", \"opened_by\": \"M. Castillo\",
    \"description\": \"Inlet filter differential pressure gauge dial cracked\",
    \"vendor_notified_date\": \"$(days_from -28)\",
    \"resolution_note\": \"Gauge replaced under warranty by Demo Blower Co. field tech\",
    \"closed_at\": \"$(days_from -12)\", \"closed_by\": \"M. Castillo\"
  }"
  echo "  2 warranty claims (1 open with vendor notified; 1 closed and frozen)"
fi

# ---- Service cutover (ADR 0006) ---------------------------------------------------
# The Phase II expansion includes an offsite main replacement along Maplewood
# Avenue: 12 service connections in mixed cutover states. Probe first: this
# instance may predate Migration D.
_probe=$(curl -s -o "$TMP" -w '%{http_code}' \
  "$LC_URL/api/collections/services/records?perPage=1" \
  -H "Authorization: $TOKEN")
if [ "$_probe" != "200" ]; then
  echo "  services: collection not found (HTTP $_probe) -- skipping the"
  echo "            service cutover module seed (pre-Migration D instance)."
else
  # svc ADDRESS STATION ACCT CUSTOMER PHONE OLDMETER SIZE MATERIAL -> id on stdout
  # customer_name/customer_phone are PII: post-Migration-I they live ONLY in the
  # auth-gated service_contacts collection, never on the publicly-readable
  # services record. The demo uses invented people.
  # NOTE: this helper is called as V1=$(svc ...) to capture the id, so it runs
  # in a command-substitution subshell -- a counter incremented here would be
  # lost in the parent. The count below is taken from the captured ids instead.
  #
  # service_contacts (Migration I) is the PII home; older instances predate it.
  # Probe once so the demo populates it when present and skips it cleanly when
  # not (the public services record carries no PII either way).
  _cprobe=$(curl -s -o /dev/null -w '%{http_code}' \
    "$LC_URL/api/collections/service_contacts/records?perPage=1" -H "Authorization: $TOKEN")
  HAS_CONTACTS=0; [ "$_cprobe" = "200" ] && HAS_CONTACTS=1

  svc() {
    api POST "collections/services/records" "{
      \"project\": \"$PROJ\", \"address\": \"$1\", \"station\": \"$2\",
      \"account_or_parcel\": \"$3\", \"customer_name\": \"$4\",
      \"customer_phone\": \"$5\", \"old_meter_number\": \"$6\",
      \"service_size\": \"$7\", \"service_material\": \"$8\"
    }"
    _sid=$(rid)
    # The customer_* above are ignored by a post-split services collection (the
    # columns are gone); their real home is service_contacts, created here so
    # the PII collection is populated and its auth gate is exercised.
    if [ "${HAS_CONTACTS:-0}" = "1" ] && [ -n "$_sid" ]; then
      api POST "collections/service_contacts/records" \
        "{\"service\": \"$_sid\", \"customer_name\": \"$4\", \"customer_phone\": \"$5\"}"
    fi
    printf '%s\n' "$_sid"
  }

  V1=$(svc  "1402 Maplewood Ave" "10+05 RT" "44-0201" "H. Okada"     "555-0201" "58101110" "3/4 in" "copper")
  V2=$(svc  "1407 Maplewood Ave" "10+40 LT" "44-0202" "M. Ferreira"  "555-0202" "58101124" "3/4 in" "galvanized")
  V3=$(svc  "1414 Maplewood Ave" "11+15 RT" "44-0203" "J. Alvarez"   "555-0203" "58101138" "3/4 in" "copper")
  V4=$(svc  "1415 Maplewood Ave" "11+30 LT" "44-0204" "R. Whitcomb"  "555-0204" "58101142" "1 in"   "poly")
  V5=$(svc  "1422 Maplewood Ave" "12+10 RT" "44-0205" "T. Ngo"       "555-0205" "58101156" "3/4 in" "galvanized")
  V6=$(svc  "1423 Maplewood Ave" "12+25 LT" "44-0206" "S. Bright"    "555-0206" "58101160" "3/4 in" "copper")
  V7=$(svc  "1430 Maplewood Ave" "13+05 RT" "44-0207" "L. Demarco"   "555-0207" "58101174" "1 in"   "copper")
  V8=$(svc  "1431 Maplewood Ave" "13+20 LT" "44-0208" "P. Sandoval"  "555-0208" "58101188" "3/4 in" "galvanized")
  V9=$(svc  "1438 Maplewood Ave" "14+00 RT" "44-0209" "K. Osei"      "555-0209" "58101192" "3/4 in" "copper")
  V10=$(svc "1502 Maplewood Ave" "15+10 RT" "44-0210" "A. Lindqvist" "555-0210" "58101206" "3/4 in" "copper")
  V11=$(svc "1509 Maplewood Ave" "15+45 LT" "44-0211" "B. Marsh"     "555-0211" "58101210" "1 in"   "poly")
  V12=$(svc "1510 Maplewood Ave" "16+05 RT" "44-0212" "C. Yoon"      "555-0212" "58101224" "3/4 in" "galvanized")
  # Count from the captured ids (the subshell counter can't survive -- see svc).
  SVCS=0
  for _v in "$V1" "$V2" "$V3" "$V4" "$V5" "$V6" "$V7" "$V8" "$V9" "$V10" "$V11" "$V12"; do
    [ -n "$_v" ] && SVCS=$((SVCS + 1))
  done
  echo "  $SVCS services (Maplewood Ave offsite main, 10+05 to 16+05)"
  [ "$HAS_CONTACTS" = "1" ] && echo "  $SVCS service contacts (customer PII, auth-gated -- Migration I)"

  # scheck SVCID PHASE RESULT BY DAYS_AGO [NOTES] -- a service-subject check
  # (tag XOR system XOR service; Migration D extended the createRule).
  SCHECKS=0
  scheck() {
    _body="{\"service\":\"$1\",\"phase\":\"$2\",\"result\":\"$3\",
      \"performed_by\":\"$4\",\"performed_at\":\"$(days_from "-$5")\",
      \"witness_required\":false"
    [ -n "${6:-}" ] && _body="$_body,\"notes\":\"$6\""
    api POST "collections/checks/records" "$_body}"
    SCHECKS=$((SCHECKS + 1))
  }

  # Probe with V1's real first check (same graceful-skip pattern as the
  # equipment checks above, in case a later phase tightens the create rule).
  _probe=$(curl -s -o "$TMP" -w '%{http_code}' -X POST \
    "$LC_URL/api/collections/checks/records" \
    -H "Content-Type: application/json" -H "Authorization: $TOKEN" \
    -d "{\"service\":\"$V1\",\"phase\":\"notice\",\"result\":\"pass\",\"performed_by\":\"E. Vance\",\"performed_at\":\"$(days_from -28)\",\"witness_required\":false}")
  if [ "$_probe" != "200" ]; then
    echo "  service checks: create blocked (HTTP $_probe) -- skipping (services stand alone)."
  else
  SCHECKS=1
  # V1: the finished example -- every phase passed, restoration included.
  scheck "$V1" locate_pothole pass "E. Vance" 24 "Existing 3/4 copper at 32 in, good condition"
  scheck "$V1" new_service    pass "E. Vance" 20 "Tested with main at 150 psi"
  scheck "$V1" meter          pass "E. Vance" 16 "Old final 481220 gal; new meter 77020011 set at 0"
  scheck "$V1" tie_over       pass "E. Vance" 14 "Outage 09:10-09:55; old corp killed at main"
  scheck "$V1" restoration    pass "E. Vance" 6  "Final AC patch and parkway turf complete"
  api PATCH "collections/services/records/$V1" "{\"new_meter_number\": \"77020011\"}"

  # V2: tied over, restoration started (temp patch) but not final.
  scheck "$V2" notice         pass "E. Vance" 26
  scheck "$V2" locate_pothole pass "E. Vance" 23 "Galvanized found, heavily tuberculated"
  scheck "$V2" new_service    pass "E. Vance" 19
  scheck "$V2" meter          pass "E. Vance" 15 "Old final 902118 gal; new 77020012 at 0"
  scheck "$V2" tie_over       pass "E. Vance" 13 "Outage 10:05-11:20, hard dig at the main"
  scheck "$V2" restoration    incomplete "E. Vance" 12 "Temp patch placed; final AC with street program"
  api PATCH "collections/services/records/$V2" "{\"new_meter_number\": \"77020012\"}"

  # V3: through meter; tie-over is the next move.
  scheck "$V3" notice         pass "E. Vance" 21
  scheck "$V3" locate_pothole pass "E. Vance" 18
  scheck "$V3" new_service    pass "E. Vance" 12
  scheck "$V3" meter          pass "E. Vance" 9 "Old final 335400 gal; new 77020013 at 0"
  api PATCH "collections/services/records/$V3" "{\"new_meter_number\": \"77020013\"}"

  # V4: tie-over FAILED -- old corp will not seat; pairs with the open A
  # punch below (source_check linkage lives in the punch description here;
  # the UI writes the machine link).
  scheck "$V4" notice         pass "E. Vance" 21
  scheck "$V4" locate_pothole pass "E. Vance" 17
  scheck "$V4" new_service    pass "E. Vance" 11
  scheck "$V4" meter          pass "E. Vance" 8
  scheck "$V4" tie_over       fail "E. Vance" 7 "Old corp will not seat - old service still live; punch raised"

  # V5, V6: noticed then stalled -- the angry-customer early warning rows
  # (noticed > 5 days, not tied over) on the cutover board.
  scheck "$V5" notice         pass "E. Vance" 12
  scheck "$V5" locate_pothole pass "E. Vance" 10 "Existing galv at 26 in - shallow, flag for new depth"
  scheck "$V6" notice         pass "E. Vance" 9

  # V7: mid-stream, healthy.
  scheck "$V7" notice         pass "E. Vance" 8
  scheck "$V7" locate_pothole pass "E. Vance" 6
  scheck "$V7" new_service    pass "E. Vance" 3 "Individual test per spec, 150 psi held"

  # V8, V9: fresh notices from yesterday's block walk (batch mode's output).
  scheck "$V8" notice         pass "E. Vance" 1
  scheck "$V9" notice         pass "E. Vance" 1

  # V10, V11: untouched -- the pending end of the street.

  # V12: locate FAILED -- unmarked gas service in the alignment.
  scheck "$V12" notice         pass "E. Vance" 4
  scheck "$V12" locate_pothole fail "E. Vance" 2 "Unmarked gas service crossing alignment - RFI to district, do not excavate"

  echo "  $SCHECKS service checks (1 complete, 1 failed tie-over, 2 stale notices, 1 locate conflict)"
  fi

  # Service punch items (service XOR tag/system -- Migration D createRule).
  api POST "collections/punch_items/records" "{
    \"project\": \"$PROJ\", \"service\": \"$V4\", \"severity\": \"A\",
    \"status\": \"open\", \"assigned_party\": \"contractor\",
    \"created_by\": \"E. Vance\",
    \"description\": \"Old corp at main will not seat - old service still live at 1415 Maplewood; customer on old main until re-excavated\"
  }"
  api POST "collections/punch_items/records" "{
    \"project\": \"$PROJ\", \"service\": \"$V12\", \"severity\": \"A\",
    \"status\": \"open\", \"assigned_party\": \"engineer\",
    \"created_by\": \"E. Vance\",
    \"description\": \"Unmarked gas service in alignment at 1510 Maplewood - RFI submitted, awaiting district direction before excavation\"
  }"
  api POST "collections/punch_items/records" "{
    \"project\": \"$PROJ\", \"service\": \"$V2\", \"severity\": \"C\",
    \"status\": \"open\", \"assigned_party\": \"contractor\",
    \"created_by\": \"E. Vance\",
    \"description\": \"Temp patch settling at gutter line at 1407 Maplewood - re-compact before final cap\"
  }"
  echo "  3 service punch items (2 A, 1 C)"
fi

# ---- LOTO events (ADR 0007) -------------------------------------------------------
# Probe first: this instance may predate Migration E.
_probe=$(curl -s -o "$TMP" -w '%{http_code}' \
  "$LC_URL/api/collections/loto_events/records?perPage=1" \
  -H "Authorization: $TOKEN")
if [ "$_probe" != "200" ]; then
  echo "  loto_events: collection not found (HTTP $_probe) -- skipping the"
  echo "               LOTO board seed (pre-Migration E instance)."
else
  # The apply photo is REQUIRED by the createRule (the hung lock on the
  # isolation point is constitutive evidence -- ADR 0007). A tiny 1x1 PNG
  # stands in for the phone photo; the event and its photo land in ONE
  # multipart POST, same as the tag page does it.
  # The .png extension (not curl's ";type=...;filename=..." options) carries
  # the content type: Git Bash's MSYS layer mangles -F values containing
  # semicolons into Windows path lists, so keep the -F value plain.
  LOCKPNG="$(mktemp)"
  printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
    | base64 -d > "$LOCKPNG"
  mv "$LOCKPNG" "$LOCKPNG.png" && LOCKPNG="$LOCKPNG.png"

  # loto_apply TAG HOLDER TRADE REASON LOCK_ID DAYS_AGO -> event id on stdout
  loto_apply() {
    _tid=$(tag_id "$1")
    _code=$(curl -s -o "$TMP" -w '%{http_code}' -X POST \
      "$LC_URL/api/collections/loto_events/records" \
      -H "Authorization: $TOKEN" \
      -F "project=$PROJ" -F "tag=$_tid" -F "action=apply" \
      -F "lock_holder_name=$2" -F "company_or_trade=$3" \
      -F "reason=$4" -F "lock_id=$5" \
      -F "performed_at=$(days_from "-$6")" \
      -F "photo=@$LOCKPNG")
    case "$_code" in
      2*) ;;
      *) echo "loto apply failed (HTTP $_code):" >&2; cat "$TMP" >&2; exit 1 ;;
    esac
    rid
  }
  # loto_release TAG APPLY_ID RELEASER NOTE DAYS_AGO -- the createRule
  # demands the note whenever the releaser differs from the lock holder
  # (supervisor removal); no photo required on release.
  loto_release() {
    _tid=$(tag_id "$1")
    api POST "collections/loto_events/records" "{
      \"project\": \"$PROJ\", \"tag\": \"$_tid\", \"action\": \"release\",
      \"applies_to\": \"$2\", \"lock_holder_name\": \"$3\",
      \"released_by_note\": \"$4\",
      \"performed_at\": \"$(days_from "-$5")\"}"
  }

  # Group LOTO: PMP-1002 (the busy tag -- failed check, open A punch) carries
  # TWO active locks from different trades. The tag stays locked out until
  # both are released; the board shows both, oldest first.
  loto_apply PMP-1002 "V. Ellison" "Volt Electric" \
    "Motor disconnect open - troubleshooting overload trips" "VE-07" 6 >/dev/null
  loto_apply PMP-1002 "T. Braddock" "Precision Millwrights" \
    "Coupling removed for alignment - do not energize" "PM-22" 4 >/dev/null

  # Supervisor removal, in history: R. Patel's lock on MOV-4530 released by
  # the site super after Patel rolled off -- the released_by_note carries the
  # justification into the immutable record.
  _a=$(loto_apply MOV-4530 "R. Patel" "Blue Rock Constructors" \
    "Actuator wiring - seat leak rework after failed hydro" "BR-114" 15)
  loto_release MOV-4530 "$_a" "C. Delgado" \
    "Supervisor removal per SOP - R. Patel off site, isolation walked down and verified, C. Delgado authorized" 12
  echo "  4 loto events (2 active locks on PMP-1002 from different trades;"
  echo "                 1 supervisor-removal release in MOV-4530's history)"

  rm -f "$LOCKPNG"
fi

# ---- Turnover package + signatures (ADR 0010) -----------------------------------
# Probe first: this instance may predate Migration M.
_probe=$(curl -s -o "$TMP" -w '%{http_code}' \
  "$LC_URL/api/collections/turnover_packages/records?perPage=1" \
  -H "Authorization: $TOKEN")
if [ "$_probe" != "200" ]; then
  echo "  turnover: collection not found (HTTP $_probe) -- skipping the"
  echo "            turnover package seed (pre-Migration M instance)."
else
  # Build a sealed, frozen turnover package for the Influent Pump Station
  # (system 10) via the SERVER-SIDE build route -- the only way a package is
  # created, because a client cannot be trusted to compute the manifest of
  # what it claims the ledger holds (ADR 0010). Capture the id and the
  # content_hash so the signatures bind to exactly this frozen snapshot.
  _code=$(curl -s -o "$TMP" -w '%{http_code}' -X POST \
    "$LC_URL/api/turnover/build" \
    -H "Authorization: $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project\":\"$PROJ\",\"system\":\"$S10\",\"title\":\"Influent Pump Station turnover\",\"generated_by\":\"K. Brandt (Meridian)\"}")
  if [ "$_code" != "200" ]; then
    echo "  turnover: build route returned HTTP $_code -- skipping signatures."
  else
    PKG=$(rid)
    PKGHASH=$(sed -n 's/.*"content_hash":"\([a-f0-9]*\)".*/\1/p' "$TMP")
    # Two attestations against the frozen snapshot: the contractor certifies
    # the work, the engineer of record accepts it. Signing REQUIRES auth (a
    # signature is worthless if anyone can mint one, ADR 0011 §7) -- the TOKEN
    # carries it. Each signature freezes the exact statement and the hash of
    # the snapshot it covers.
    sign() { # NAME ROLE TITLE STATEMENT DAYS_AGO
      api POST "collections/signatures/records" "{
        \"subject_collection\":\"turnover_packages\",\"subject_id\":\"$PKG\",
        \"signer_name\":\"$1\",\"signer_role\":\"$2\",\"signer_title\":\"$3\",
        \"statement\":\"$4\",\"signed_at\":\"$(days_from "-$5")\",
        \"signed_content_hash\":\"$PKGHASH\"}"
    }
    sign "D. Okafor" "contractor" "Commissioning Lead, Blue Rock Constructors" \
      "I certify the checks recorded here were performed and accurately recorded." 2
    sign "K. Brandt" "engineer" "Resident Engineer, Meridian Engineering Group" \
      "Reviewed and accepted for startup." 1
    echo "  1 turnover package (System 10, sealed) + 2 signatures (contractor + EOR)"
  fi
fi

# ---- Summary --------------------------------------------------------------------
echo ""
echo "Done. Cedar Hollow WRF is seeded:"
echo "  project home:   $LC_URL/"
echo "  at-risk system: $LC_URL/system.html?id=$S10  (starts in 7 days, open A items)"
echo "  a busy tag:     $LC_URL/t/PMP-1002  (failed check + open A punch + LOCKED OUT, 2 locks)"
echo "  loto board:     $LC_URL/loto.html?project=$PROJ  (active locks by system, oldest first)"
echo "  loto history:   $LC_URL/t/MOV-4530  (supervisor-removal release in the ledger)"
echo "  warranty tag:   $LC_URL/t/CP-2100  (expiring warranty + open claim)"
echo "  calibration:    $LC_URL/calibrations.html?project=$PROJ  (overdue + expired standard)"
echo "  adjusted cal:   $LC_URL/t/FIT-1020"
echo "  closeout:       $LC_URL/closeout.html?project=$PROJ"
echo "  warranty view:  $LC_URL/warranty.html?project=$PROJ"
echo "  cutover board:  $LC_URL/cutover.html?project=$PROJ  (12 Maplewood Ave services)"
echo "  batch notices:  $LC_URL/notice_batch.html?project=$PROJ"
echo "  labels:         $LC_URL/labels.html"
