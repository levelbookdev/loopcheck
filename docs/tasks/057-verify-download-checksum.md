# 057 — Verify the PocketBase download against its published checksum

Status: TODO
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none

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
