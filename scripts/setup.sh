#!/bin/sh
# LoopCheck setup — download the right PocketBase binary for this machine.
#
# Usage:
#   ./scripts/setup.sh              # latest release
#   PB_VERSION=0.28.4 ./scripts/setup.sh   # pin a specific version
#
# PocketBase is a single Go binary with an embedded SQLite database.
# We download it instead of committing it: it's ~40 MB and differs per
# OS/architecture. Everything else LoopCheck needs is already in the repo —
# on first run PocketBase auto-applies the schema from pb_migrations/.
#
# POSIX sh on purpose: must work on a bare Raspberry Pi, a $5 VPS, macOS,
# and Git Bash on Windows.

set -eu

# Work from the repo root (this script lives in scripts/), so the binary
# lands next to pb_migrations/ and pb_public/ where PocketBase expects them.
cd "$(dirname "$0")/.."

# ---- 0. Enable the pre-push smoke-test gate (git clones only) ---------------
# scripts/smoke_test.sh boots a fresh DB, applies every migration, runs the
# full seed, and asserts the combined stack is healthy. Wiring it as a
# pre-push hook makes that the price of a push -- integration drift has
# reached pushed main before. Bypass one push with SKIP_SMOKE=1 git push.
# A plain tarball (no .git) just skips this; done before the binary check so
# re-running setup on an existing install still turns it on.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git config core.hooksPath .githooks
  echo "Pre-push smoke-test gate enabled (bypass one push with SKIP_SMOKE=1 git push)."
fi

# ---- 1. Detect OS ----------------------------------------------------------
case "$(uname -s)" in
  Linux*)                     OS="linux"   ;;
  Darwin*)                    OS="darwin"  ;;
  MINGW*|MSYS*|CYGWIN*)       OS="windows" ;;
  *)
    echo "Unsupported OS: $(uname -s)" >&2
    echo "Download PocketBase manually from https://github.com/pocketbase/pocketbase/releases" >&2
    exit 1
    ;;
esac

# ---- 2. Detect CPU architecture --------------------------------------------
case "$(uname -m)" in
  x86_64|amd64)   ARCH="amd64" ;;
  aarch64|arm64)  ARCH="arm64" ;;
  armv7*|armv6*)  ARCH="armv7" ;;   # older Raspberry Pis
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    echo "Download PocketBase manually from https://github.com/pocketbase/pocketbase/releases" >&2
    exit 1
    ;;
esac

BIN="pocketbase"
[ "$OS" = "windows" ] && BIN="pocketbase.exe"

if [ -f "$BIN" ]; then
  echo "$BIN already exists — delete it first if you want to re-download."
  exit 0
fi

# ---- 3. Resolve the version -------------------------------------------------
# Default to the latest GitHub release; override with PB_VERSION=x.y.z.
if [ "${PB_VERSION:-}" = "" ]; then
  echo "Looking up latest PocketBase release..."
  # The GitHub API returns JSON; grab the tag_name line (e.g. "v0.28.4")
  # without needing jq installed.
  PB_VERSION=$(curl -fsSL https://api.github.com/repos/pocketbase/pocketbase/releases/latest \
    | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
  if [ "$PB_VERSION" = "" ]; then
    echo "Could not detect the latest version (GitHub API unreachable?)." >&2
    echo "Retry with a pinned version, e.g.: PB_VERSION=0.28.4 ./scripts/setup.sh" >&2
    exit 1
  fi
fi

# ---- 4. Download -------------------------------------------------------------
ZIP="pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${ZIP}"

echo "Downloading PocketBase v${PB_VERSION} for ${OS}/${ARCH}..."
curl -fL -o "$ZIP" "$URL"

# ---- 5. Verify the download against the published checksum -------------------
# HTTPS authenticates the SERVER, not the FILE. It says nothing about whether the
# bytes that arrived are the bytes upstream published — a truncated transfer, a
# corrupted CDN object, or a replaced release asset all land silently and become
# the binary running a commissioning ledger on a plant network. PocketBase
# publishes checksums.txt for every architecture; this consults it.
#
# A skip is always LOUD. A verification step that quietly does nothing is worse
# than no verification at all, because it reads as protection.
SUMS_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/checksums.txt"

# sha256sum: Linux and Git Bash. shasum: macOS. Neither is guaranteed, so the
# absence is reported rather than assumed away.
#
# "No hashing tool" and "the hashing tool failed" are kept distinct on purpose.
# Collapsing them makes the script announce that sha256sum is unavailable on a
# machine where it is installed and working, which sends the next person hunting
# for the wrong problem.
SHA_TOOL=""
if command -v sha256sum >/dev/null 2>&1; then
  SHA_TOOL="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  SHA_TOOL="shasum -a 256"
fi

ACTUAL=""
if [ "$SHA_TOOL" != "" ]; then
  ACTUAL=$($SHA_TOOL "$ZIP" 2>/dev/null | cut -d' ' -f1)
  if [ "$ACTUAL" = "" ]; then
    # The tool is present and still produced nothing: the file we just
    # downloaded is missing or unreadable. That is a real failure, not a
    # reason to shrug and continue.
    rm -f "$ZIP"
    echo "" >&2
    echo "FATAL: could not compute a checksum for $ZIP using $SHA_TOOL." >&2
    echo "       The download is missing or unreadable; it has been deleted." >&2
    echo "" >&2
    exit 1
  fi
fi

if [ "$SHA_TOOL" = "" ]; then
  echo "" >&2
  echo "WARNING: neither sha256sum nor shasum is available on this system." >&2
  echo "         The download was NOT verified against its published checksum." >&2
  echo "         Expected checksums: $SUMS_URL" >&2
  echo "" >&2
elif ! SUMS=$(curl -fsSL "$SUMS_URL" 2>/dev/null) || [ "$SUMS" = "" ]; then
  echo "" >&2
  echo "WARNING: could not fetch checksums.txt (offline or mirrored install?)." >&2
  echo "         The download was NOT verified. Verify by hand if this box" >&2
  echo "         matters: $SUMS_URL" >&2
  echo "" >&2
else
  # checksums.txt is "<sha256>  <filename>" per line. Match the whole filename
  # field exactly -- a substring match could pair us with a different asset.
  EXPECTED=$(printf '%s\n' "$SUMS" | awk -v f="$ZIP" '$2 == f { print $1; exit }')

  if [ "$EXPECTED" = "" ]; then
    echo "" >&2
    echo "WARNING: $ZIP is not listed in the published checksums.txt." >&2
    echo "         The download was NOT verified." >&2
    echo "" >&2
  elif [ "$EXPECTED" != "$ACTUAL" ]; then
    # Refuse, and remove the artifact -- leaving a failed download on disk lets
    # a later run (or a human) treat it as usable.
    rm -f "$ZIP"
    echo "" >&2
    echo "FATAL: checksum mismatch on $ZIP — the download was NOT what upstream" >&2
    echo "       published, and has been deleted." >&2
    echo "         expected: $EXPECTED" >&2
    echo "         actual:   $ACTUAL" >&2
    echo "" >&2
    echo "       Do not use this binary. Re-run to download again; if it fails" >&2
    echo "       twice, stop and investigate before installing anything." >&2
    exit 1
  else
    echo "Checksum verified (sha256 $ACTUAL)."
  fi
fi

# ---- 6. Extract --------------------------------------------------------------
# Extract only the binary — the zip also has LICENSE/CHANGELOG we don't need.
unzip -o "$ZIP" "$BIN" >/dev/null
rm "$ZIP"
chmod +x "$BIN" 2>/dev/null || true   # no-op on Windows, required elsewhere

echo ""
echo "Done. Start LoopCheck with:"
echo "    ./$BIN serve"
echo ""
echo "Then open http://127.0.0.1:8090/_/ to create your admin account."
echo "To reach it from phones on the same network:"
echo "    ./$BIN serve --http=0.0.0.0:8090"
