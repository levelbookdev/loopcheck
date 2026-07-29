# 040 — Headless-browser smoke test of the critical field path

Status: DONE (2026-07-28 — 7 assertions green; wired into both gates)
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 030

## Outcome

`scripts/browser_test.sh` boots its own seeded throwaway instance (separate data
dir and port from the REST suite) and runs `scripts/browser/field_path.mjs`
headless: **7 passed, 0 failed**, exit 0.

Two false failures during construction are worth knowing about, because both
would have been read as product bugs:

- **`networkidle` is not "loaded".** `tag.html`'s `load()` runs several
  sequential fetches, so the page briefly renders a convincing partial — header
  and LOTO heading present, checkout standing and the honesty line absent.
  Asserting then reported a missing safety line on a page that renders it
  correctly. The suite now waits on the component's own `state !== 'loading'`.
- **The tag number is outside `<main>`.** It lives in `<header class="bar">`, so
  reading `main`'s text missed it. The suite reads the whole body.

Both are recorded in the script's comments so the next reader does not re-derive
them. A third gotcha, already predicted by the task, held true: synthetic events
do not drive Alpine `x-model`; the suite sets state via `Alpine.$data()` and
calls the component's own method.

Also note the subject tag is **chosen**, not hardcoded: it picks a tag whose
`tag_type` actually has a checklist template. The first tag alphabetically was an
`analyzer`, which has none, so the check-flow assertion could not run at all.

**No product bug was found** — nothing under `pb_public/` changed.

## Context

The existing `scripts/smoke_test.sh` asserts REST/rule behavior but never
exercises the actual pages a field user touches. A rendered-page regression
(broken Alpine binding, a fetch that silently 200s-empty, a QR route that stops
returning `tag.html`) would pass the REST suite and still ship a dead field tier.
M1 adds a browser test of the critical path. See ROADMAP → M1 and
[DECISIONS.md D16](../DECISIONS.md#d16--browser-test-tooling-is-dev-only-and-isolated).

**The one non-obvious decision (settled — do not relitigate):** a headless
browser tool (**Playwright** is the default) is allowed as **dev-only,
git-ignored tooling** invoked from `scripts/`. Hard constraint #3 ("no build
step, ~50 KB JS budget") governs the **shipped app in `pb_public/`**, not the dev
test harness. The tooling must never be vendored into `pb_public/`, never be a
runtime dependency, and never change how the field tier loads.

**If you believe introducing any Node/dev dependency is wrong for this repo,
STOP and ask the maintainer before proceeding** (D16). Do not silently pick a
different approach.

## Scope

**Create:**
- `scripts/browser_test.<ext>` (or a `scripts/browser/` folder) — the headless
  test.
- A dev-only manifest for the tool (e.g. `package.json` + lockfile) **at the repo
  root or under `scripts/`**, plus `.gitignore` entries for its installed
  modules (e.g. `node_modules/`, browser downloads).
- A short "Running the browser test" note in `docs/DEPLOY.md` or a new
  `docs/testing.md` (whichever fits; keep to one place).

**Leave alone:**
- Everything in `pb_public/` — you are testing it, not changing it. If the test
  finds a real page bug, **stop and report it**; fixing pages is not this task.
- `scripts/smoke_test.sh` — keep the REST suite separate; this is a second,
  complementary suite.

## Specification

1. **Environment.** The test must run against a freshly seeded instance. Reuse
   the throwaway-DB pattern from `scripts/smoke_test.sh` (boot PocketBase from
   `pb_migrations/`, seed via `scripts/seed_demo.sh` or the REST seed the smoke
   test uses) so the browser test targets a known dataset. Document how to point
   it at a running instance (base URL from an env var, default
   `http://127.0.0.1:<port>`).
2. **Critical path to cover (the field tier that must never break):**
   - Load a tag page via the clean route `/t/{tag_number}` for a seeded tag and
     assert the page renders the tag number and a checkout-standing section
     (not a blank/error shell).
   - Log a check from the tag/check flow and assert the new check appears in the
     tag's check history (the append-and-read-back promise).
   - Flag a punch item from the tag page and assert it appears.
   - LOTO: assert the tag-page LOTO banner renders with its data-freshness
     timestamp and the "Verify physically before any work." line (the ADR 0007
     honesty invariant — its absence is a safety regression).
3. **Alpine scripting caveat (from SESSION-NOTES — save yourself the hour):**
   synthetic `input` events do not reliably drive Alpine `x-model`. To set form
   values in-page, use `Alpine.$data(root)` to set properties and call the
   component method directly, rather than typing into inputs and firing events.
4. **Honest failure.** The test must fail loudly if a page returns 200 with empty
   content (the "confident absence" failure mode). Assert on rendered data
   presence, not just HTTP status.
5. **Keep it small.** One spec file, the four assertions above. This is a smoke
   test, not a full E2E suite.

## Acceptance criteria

- [ ] Running the documented command starts a seeded throwaway instance, runs the
      browser test headless, and exits non-zero on failure / zero on success.
- [ ] The four critical-path assertions exist and pass against the seed data.
- [ ] The LOTO honesty-line assertion is present (freshness timestamp + "Verify
      physically before any work.").
- [ ] The tool's installed artifacts are git-ignored; `git status` after an
      install is clean of `node_modules`/browser binaries.
- [ ] Nothing under `pb_public/` changed; the field tier's page weight and
      no-build-step property are untouched.
- [ ] The run command is documented in exactly one place and referenced from the
      CI task's expectations (task `050`).

## Guardrails

- Dev-only, isolated ([D16](../DECISIONS.md#d16--browser-test-tooling-is-dev-only-and-isolated)).
  No test tooling in `pb_public/`. No new runtime dependency for the app.
- Do not "fix" any page you find broken here — report it as a finding; page fixes
  are their own task so the test change stays reviewable.
- Prefer the project's existing throwaway-DB mechanics over inventing a new
  harness; consistency with `smoke_test.sh` matters.
- Keep the browser binary download out of the committed tree and out of any field
  deployment path.

## Definition of done

- Browser smoke test runs and passes headless; artifacts git-ignored; run
  documented once.
- `Status:` set to `DONE`.
- Committed as the maintainer, message e.g.:
  `test: add a headless-browser smoke of the critical field path (dev-only tooling)`.
