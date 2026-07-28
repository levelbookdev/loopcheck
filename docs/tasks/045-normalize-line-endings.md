# 045 — Normalize line endings: add `.gitattributes`, fix committed CRLF

Status: TODO
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none

## Context

Files are committed to this repository with **CRLF line endings**, and there is
no `.gitattributes`. Verified 2026-07-28:

- `git show HEAD:scripts/smoke_test.sh` — the **blob itself** contains CR, so
  this is in the repository, not just a working-tree artifact.
- `git config core.autocrlf` is `true` on the maintainer's Windows machine, and
  no `.gitattributes` exists to pin `eol=lf` for shell scripts.

This is currently invisible because the only machine running the tests is
Windows (Git Bash tolerates it). It stops being invisible the moment anything
runs on Linux:

- **Task `050` (CI) runs GitHub Actions on Linux.** `scripts/smoke_test.sh` with
  CRLF will fail or misbehave there — a `\r` at the end of every line breaks
  variable expansion, `case` patterns, and heredoc terminators.
- The **deployment** hit this on 2026-07-28. The droplet upgrade had to strip CR
  from the shipped tree as a workaround; the artifact was normalised on the
  server rather than in the repo, so the underlying problem is still here.

## Scope

**Touch:**
- `.gitattributes` (new, repo root).
- Re-normalize the tracked text files whose blobs contain CR.

**Leave alone:**
- File *content* — this task changes line endings only. No behavioural edit, no
  reformatting, no reflowing of prose.
- `pb_public/vendor/*` — vendored third-party libraries; leave their bytes as
  shipped unless they are shell scripts (they are not).

## Specification

1. Add a `.gitattributes` that at minimum:
   - defaults text files to LF in the repository (`* text=auto eol=lf`);
   - pins `*.sh` to `eol=lf` explicitly — these are the files that actually break;
   - marks binary types (`*.png`, `*.jpg`, `*.ico`, `*.pdf`) as `binary` so they
     are never touched.
2. Re-normalize the index so committed blobs use LF:
   `git add --renormalize .` then commit. Expect a large diff that is **purely**
   line endings — verify with `git diff --stat` before committing, and spot-check
   with `git diff --ignore-all-space` (should be near-empty).
3. Confirm no blob still carries CR for the file types that matter:
   `git grep -I --cached -l $'\r' -- '*.sh' '*.js' '*.html' '*.css'` returns
   nothing.
4. Re-run `scripts/smoke_test.sh` locally — it must still pass with the same
   assertion count (89) after renormalization.

## Acceptance criteria

- [ ] `.gitattributes` exists and pins `*.sh` to LF.
- [ ] `git show HEAD:scripts/smoke_test.sh | file -` reports no CRLF.
- [ ] A `git grep` for CR in cached `*.sh` / `*.js` / `*.html` / `*.css` blobs
      returns nothing.
- [ ] `scripts/smoke_test.sh` still passes at 89 assertions.
- [ ] The commit's diff is line endings only — no content change. State in the
      commit message that this was verified.

## Guardrails

- Do this as its **own commit**, touching nothing else. A renormalization diff is
  large and would bury any real change committed alongside it.
- Do not "fix" file content while you are in there. If a file looks wrong,
  raise it separately.
- Do not change `core.autocrlf` on the developer machine as the fix —
  `.gitattributes` is the portable answer and travels with the repo.

## Definition of done

- Acceptance criteria checked; smoke test green at 89.
- `Status:` set to `DONE`.
- Committed as the maintainer (no AI trailer), message e.g.:
  `chore: add .gitattributes and normalize committed line endings to LF`.
