# 045 — Normalize line endings: add `.gitattributes`, fix committed CRLF

Status: DONE (2026-07-28 — premise corrected; `.gitattributes` added)
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none

## Context

**The original premise of this task was wrong, and the correction is the useful
part.** It claimed the repository stores CRLF line endings. It does not: every
tracked text blob was verified CR-free by reading raw bytes with
`git cat-file blob`.

The mistake was one of measurement. `git show HEAD:<file>` applies the checkout
conversion on a Windows machine with `core.autocrlf=true`, so it *prints* CRLF
for a blob stored as LF. `git show` was the wrong instrument; `git cat-file blob`
is the right one. `git add --renormalize .` correctly reported nothing to do —
which was the first real clue.

The genuine problem sat one step downstream: **`git archive` applies the same
conversion** when the archived tree has no `.gitattributes`. The 2026-07-28
deploy artifact was built that way and arrived on the droplet full of CRLF,
where it had to be stripped on the server. A shell script with CRLF does fail on
Linux — `\r` at end of line breaks variable expansion, `case` patterns, and
heredoc terminators — so the risk to task `050`'s Linux CI was real even though
the stated cause was not.

So `.gitattributes` is still worth having, for two accurate reasons: it pins the
LF guarantee that currently depends on each developer's per-machine
`core.autocrlf`, and it makes `git archive` produce LF, removing the failure
mode that actually bit.

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

- [x] `.gitattributes` exists and pins `*.sh` to LF.
- [x] Every tracked text blob is CR-free, verified with `git cat-file blob`
      (**not** `git show`, which converts on output).
- [x] `git add --renormalize .` produces no content changes — the repository was
      already clean.
- [x] `git archive HEAD` produces LF output once `.gitattributes` is committed
      (verify against the new HEAD, since `git archive` reads attributes from the
      tree it archives, not the working directory).
- [x] `scripts/smoke_test.sh` still passes at 89 assertions.

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
