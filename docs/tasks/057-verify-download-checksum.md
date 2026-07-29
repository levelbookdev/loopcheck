# 057 — Verify the PocketBase download against its published checksum

Status: DONE (2026-07-28 — all three paths tested, incl. deliberate corruption)
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none

## Outcome

`scripts/setup.sh` now verifies the download before extracting. Tested, not
assumed:

| Path | Result |
|---|---|
| Valid download | `Checksum verified (sha256 aad897c0…)`, exit 0 |
| **Corrupted artifact** | `FATAL: checksum mismatch`, both digests printed, **file deleted**, exit 1 |
| `checksums.txt` unreachable | Loud `WARNING`, continues — a skip is visible, never silent |
| No SHA-256 tool | Loud `WARNING` naming the missing tools |

The corruption test used the real script with only the `curl` download stubbed,
so the verification code path exercised is the shipped one.

**A bug in the first draft, caught by that test:** when `sha256sum` existed but
failed (unreadable file), `ACTUAL` came back empty and the script announced
*"neither sha256sum nor shasum is available"* — on a machine where it was
installed and working. That would send the next person hunting for a missing
tool that isn't missing. "No tool" and "tool failed" are now distinct: the first
warns and continues, the second is fatal, because a hashing tool that cannot read
a file we just downloaded means the download is broken.

**One more thing the first pass got wrong.** The claim "CI exercises this on
every run" was false: a PocketBase cache hit skips `setup.sh` entirely, so the
verification never executed on Linux. The cache key now includes
`hashFiles('scripts/setup.sh')`, so any change to the installer forces a real
download-and-verify on the next run — which is precisely when you want it
exercised. Confirmed by the run that followed, which fetched rather than restored
and printed `Checksum verified`.

## Context

`scripts/setup.sh` downloads the PocketBase release zip over HTTPS and unzips it
without ever verifying the bytes. Upstream publishes a `checksums.txt` alongside
every release covering every architecture — it is simply not consulted.

Found during task `060`'s ARM validation (recorded in `docs/DEPLOY.md`), and
deliberately not fixed there: `060` is a validation task guarded against silently
patching scripts.

Why it matters: **HTTPS authenticates the host, not the artifact.** It protects
the transfer, and nothing else. A truncated download, a corrupted CDN object, or
a compromised release asset all install silently and become the binary that runs
the commissioning ledger on a plant network. This is the same class of gap the
project already refuses to accept elsewhere — the whole point of the append-only
ledger is that you can trust what you're looking at.

It is also the first thing a stranger self-hosting LoopCheck runs, which makes it
an M3 "stranger-ready" concern arriving early.

## Scope

**Touch:**
- `scripts/setup.sh` — add verification after the download, before the unzip.

**Leave alone:**
- The OS/architecture detection, the `PB_VERSION` resolution, and the hook-wiring
  at the end of the script. This task adds one check; it is not a rewrite.
- `.github/workflows/ci.yml` — CI calls `setup.sh`, so it inherits the check for
  free. No workflow change should be needed; if one is, say why.

## Specification

1. After downloading `pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip`, fetch
   `checksums.txt` from the same release tag and compare the SHA-256 of the
   downloaded file against the entry for exactly that filename.
2. **Fail loudly and delete the bad artifact** on mismatch — a failed verification
   must not leave a half-trusted zip on disk for a later run to pick up. Exit
   non-zero with a message naming the expected and actual digests.
3. **Portability matters more than elegance here.** The script must keep running
   under Git Bash on Windows, dash on Debian/Ubuntu, and a Raspberry Pi's
   `/bin/sh`. `sha256sum` exists on Linux; macOS has `shasum -a 256`; Git Bash
   has `sha256sum`. Detect what is available and degrade with an explicit
   warning if none is — do **not** silently skip verification.
4. If `checksums.txt` cannot be fetched (offline mirror, air-gapped install),
   print a clear warning saying verification was skipped and why. A skip must be
   visible; a silent skip is worse than no feature, because it looks like
   protection.

## Acceptance criteria

- [ ] A normal `./scripts/setup.sh` run verifies the download and says so.
- [ ] A deliberately corrupted zip (truncate it, re-run the verify path) is
      rejected with a non-zero exit and the file is removed.
- [ ] The script still works on Windows/Git Bash and on Linux.
- [ ] `scripts/smoke_test.sh` still passes (89) and CI is green — CI calls
      `setup.sh`, so a broken verification would surface there.
- [ ] `docs/DEPLOY.md`'s "installer does not verify checksums" finding is updated
      or removed, since it will no longer be true.

## Guardrails

- Do not add a dependency (no `curl | python`, no jq) — the script is plain POSIX
  sh plus `curl`/`unzip` by design.
- Do not make verification silently optional. If it cannot run, it must say so.
- Do not change which binary is downloaded or where it lands; only whether it is
  trusted.

## Definition of done

- Acceptance criteria checked, including the deliberate-corruption test.
- `docs/DEPLOY.md` finding reconciled.
- `Status:` set to `DONE`.
- Committed as the maintainer (no AI trailer), message e.g.:
  `fix(setup): verify the PocketBase download against its published checksum`.
