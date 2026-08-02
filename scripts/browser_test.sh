#!/bin/sh
# LoopCheck headless-browser smoke -- the FIELD PATH gate.
#
# scripts/smoke_test.sh proves the REST surface and the access matrix. It cannot
# see a rendered page, so a broken Alpine binding, a fetch that silently returns
# 200-with-nothing, or a clean-URL route that stops serving tag.html would leave
# it green while the field tier is dead. This suite drives a real browser over
# the four things a laborer with a phone actually does (ADR 0007 / hard
# constraint #1), and fails loudly if a page renders an empty shell.
#
# It boots its OWN throwaway database from pb_migrations/ and runs the real demo
# seed, so it targets a known dataset -- same mechanics as smoke_test.sh, a
# separate data dir and port so the two can run side by side.
#
# Usage:   ./scripts/browser_test.sh
#          LC_BROWSER_PORT=8500 ./scripts/browser_test.sh
#          LC_BASE=https://app.example.com ./scripts/browser_test.sh   # skip the
#              throwaway boot and test an instance that is already running
# Exit:    0 = all assertions passed;  1 = a regression;  2 = setup failure.
#
# Needs: node + the dev-only tooling in scripts/browser (npm ci && npx playwright
# install chromium), the pocketbase binary (scripts/setup.sh), and curl.
# The tooling is DEV-ONLY and git-ignored -- it is never vendored into
# pb_public/ and never becomes a runtime dependency (DECISIONS.md D16).
#
# Playwright is pinned to 1.61.1, which is NOT the latest on purpose: 1.62.0
# raised its floor to node >= 20, and node 18 is what Ubuntu/Pop 24.04 installs
# from apt. 1.61.1 is the newest release that still runs on node 18 while
# clearing GHSA-7mvr-c777-76hp (browser downloads without SSL verification,
# fixed in 1.55.1). Bumping past it means requiring node 20+ locally; CI
# already runs node 22, so CI alone will not catch that break.

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BROWSER_DIR="$ROOT/scripts/browser"

# ---- preflight: fail with a useful message, not a stack trace ---------------
if ! command -v node >/dev/null 2>&1; then
  echo "FATAL: node not found. The browser suite is dev-only tooling; install" >&2
  echo "       Node, then: cd scripts/browser && npm ci && npx playwright install chromium" >&2
  exit 2
fi
if [ ! -d "$BROWSER_DIR/node_modules" ]; then
  echo "FATAL: browser tooling not installed." >&2
  echo "       cd scripts/browser && npm ci && npx playwright install chromium" >&2
  exit 2
fi

# ---- mode A: point at an instance that is already running -------------------
if [ -n "${LC_BASE:-}" ]; then
  echo "==> testing the running instance at $LC_BASE (no throwaway boot)"
  LC_BASE="$LC_BASE" node "$BROWSER_DIR/field_path.mjs"
  exit $?
fi

# ---- mode B: boot a fresh, seeded throwaway instance ------------------------
PORT="${LC_BROWSER_PORT:-8398}"
BASE="http://127.0.0.1:$PORT"
DATA_DIR="$ROOT/pb_data_browser"     # gitignored (pb_data_*/)
ADMIN_EMAIL="browser-admin@example.com"
ADMIN_PASS="browseradmin-123456"
DEMO_EMAIL="browser-demo@example.com"
DEMO_PASS="browserdemo-123456"

PB="./pocketbase"
[ -f ./pocketbase.exe ] && PB="./pocketbase.exe"
if [ ! -f "$PB" ]; then
  echo "FATAL: pocketbase binary not found. Run scripts/setup.sh first." >&2
  exit 2
fi

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  n=0
  while [ -d "$DATA_DIR" ] && [ "$n" -lt 10 ]; do
    rm -rf "$DATA_DIR" 2>/dev/null && break
    n=$((n + 1)); sleep 1
  done
}
trap cleanup EXIT INT TERM

rm -rf "$DATA_DIR"; mkdir -p "$DATA_DIR"
if curl -s -o /dev/null "$BASE/api/health" 2>/dev/null; then
  echo "FATAL: something is already listening on port $PORT." >&2
  echo "       Set LC_BROWSER_PORT to a free port and retry." >&2
  exit 2
fi

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

SU=$(curl -s -X POST "$BASE/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$SU" ] || { echo "FATAL: could not authenticate as the browser-test superuser." >&2; exit 2; }

curl -s -o /dev/null -X POST "$BASE/api/collections/users/records" \
  -H "Content-Type: application/json" -H "Authorization: $SU" \
  -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASS\",\"passwordConfirm\":\"$DEMO_PASS\"}"

echo "==> seeding demo data"
LC_URL="$BASE" LC_EMAIL="$DEMO_EMAIL" LC_PASSWORD="$DEMO_PASS" \
  sh "$ROOT/scripts/seed_demo.sh" >"$DATA_DIR/seed.log" 2>&1 \
  || { echo "FATAL: seed_demo.sh aborted:" >&2; tail -30 "$DATA_DIR/seed.log" >&2; exit 2; }

echo "==> driving the field path in a headless browser"
LC_BASE="$BASE" node "$BROWSER_DIR/field_path.mjs"
