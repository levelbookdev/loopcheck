# 050 — CI: GitHub Actions backstop + hardened local pre-push gate

Status: TODO
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 030, 040

## Context

The tests only protect the repo if they run automatically. The maintainer chose
**both** a local pre-push gate and a GitHub Actions backstop
([DECISIONS.md D15](../DECISIONS.md#d15--ci-runs-both-locally-and-in-github-actions)).
`.githooks/pre-push` already runs the smoke test when the PocketBase binary is
present. This task formalizes that and adds a remote workflow. See ROADMAP → M1.

**Constraint that shapes the workflow:** the repo is **private** and the
PocketBase binary is **not committed** (`scripts/setup.sh` fetches it). CI must
fetch PocketBase itself. The browser tooling from task `040` is dev-only and must
be installed in CI, not committed.

## Scope

**Create/touch:**
- `.github/workflows/ci.yml` — the Actions workflow.
- `.githooks/pre-push` — harden and document (it exists; extend it to also run
  the browser test when its tooling is available, and to give a clear message
  when the binary/tooling is absent).
- A short "CI and local gate" section in `docs/DEPLOY.md` or `docs/testing.md`
  (wherever task `040` put the testing note — keep it in one place).

**Leave alone:**
- The test scripts themselves (tasks `030`/`040` own them). CI only invokes them.
- Any application/schema code.

## Specification

1. **GitHub Actions workflow (`ci.yml`):**
   - Trigger on `push` and `pull_request` to the default branch.
   - Runner: `ubuntu-latest`.
   - Steps: checkout → run `scripts/setup.sh` (or an equivalent step) to fetch
     the PocketBase binary for the runner's architecture → run
     `scripts/smoke_test.sh` → install the dev-only browser tooling (task `040`)
     and run the browser test.
   - The job must **fail** if either suite fails. Do not allow-fail either.
   - Cache what is safely cacheable (the browser download, any package cache) but
     never commit binaries.
   - Keep it minimal — this is a correctness gate, not a release pipeline.
2. **Pre-push hook:**
   - Keep the existing graceful behavior: if the PocketBase binary is absent,
     print a clear "skipping smoke test — run scripts/setup.sh to enable the local
     gate" message and do **not** block the push on a missing binary (the
     maintainer sometimes works without it).
   - When the binary is present, run the smoke test as today; additionally run
     the browser test **if its tooling is installed**, else print a skip note.
   - A failing suite (when it can run) blocks the push.
3. **Docs.** One short section documenting: what CI runs, how to run the same
   gate locally, and how to enable the local browser test.

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` exists, triggers on push/PR, fetches PocketBase,
      and runs both the smoke test and the browser test, failing the job if
      either fails.
- [ ] The workflow is valid YAML and its steps reference real script paths that
      exist in the repo.
- [ ] `.githooks/pre-push` runs both suites when able, skips gracefully with a
      clear message when the binary/tooling is absent, and blocks on a real
      failure.
- [ ] The testing/CI doc section describes the remote and local gates in one
      place.
- [ ] No application/schema/test-logic files changed (CI invokes existing
      scripts; it does not reimplement them).

## Guardrails

- **Never commit the PocketBase binary or browser binaries.** CI fetches them;
  `.gitignore` already excludes `pocketbase`/`pocketbase.exe` — verify the
  browser tooling artifacts are excluded too.
- Private-repo Actions minutes are finite: keep the job single and fast; don't
  add matrix builds or extra OSes without a reason.
- Do not weaken the local hook's graceful no-binary path — the maintainer relies
  on being able to commit offline.
- If `scripts/setup.sh` is interactive or otherwise unsuitable for CI, add a
  non-interactive path rather than duplicating its logic; note it in the doc.

## Definition of done

- Workflow green on a test push/PR (or, if the agent can't push, the YAML is
  validated and the steps are demonstrably correct against real paths).
- `Status:` set to `DONE`.
- Committed as the maintainer, message e.g.:
  `ci: add GitHub Actions gate and harden the local pre-push hook`.
