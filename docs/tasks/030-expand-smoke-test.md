# 030 — Expand the smoke test to the current collection set and known gaps

Status: DONE
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none

## Context

`scripts/smoke_test.sh` is the only automated test. It boots a throwaway
PocketBase from `pb_migrations/`, runs the demo seed through REST, and asserts
collection/rule invariants plus the full ADR 0011 auth matrix across
guest/user/superuser (~70 assertions). `docs/current-state.md` documents its own
coverage gaps, which this task closes. See ROADMAP → M1 and
[DECISIONS.md D2](../DECISIONS.md#d2--trust-before-features-m1-comes-first).

**Read `scripts/smoke_test.sh` fully before editing.** Match its existing style:
the helper functions it already defines (e.g. `auth_total`, `auth_post_status`,
`anon_field_absent`), its section structure, and its pass-counting convention.
Do not restructure it.

## Scope

**Touch:**
- `scripts/smoke_test.sh` — add assertions only, following existing patterns.

**Leave alone:**
- Any application code, migration, or seed. If a needed assertion reveals a real
  bug, **stop and report it** — do not fix product code inside this test task.
- The browser/UI test — that is task `040` (this task stays REST-level).

## Specification

Add assertions for the documented gaps (see `docs/current-state.md` "Tests and
quality gates"):

1. **`segments` in the existence loop.** The expected-collection existence check
   currently omits `segments`; add it so the loop confirms the collection exists.
2. **Tank leak-test seed/workflow.** Assert the tank templates from migration
   `1789000028` loaded (the `tank` tag type / tank leak-test template is present
   in `checklist_templates`/`template_items`). A data-presence assertion is
   sufficient; there is no tank UI to drive.
3. **open→resolve behavior.** Assert the append-only open→resolve contract from
   ADR 0012: create a check with a pending result, then create a second check
   that resolves it via `checks.resolves`, and assert the original record was
   **not mutated** (its fields unchanged; the resolution is a separate record).
   Reuse the immutability-assertion style already in the script.
4. **Newer collections present and correctly ruled.** Confirm `calibrations`,
   `calibration_points`, `test_standards`, and `service_visits` exist and that
   their create/update/delete rules match `docs/API.md` (e.g. `calibrations`
   create is capture-route-only and update/delete are `never`; `service_visits`
   create is public per the accountless field tier). One or two representative
   assertions per collection is enough — mirror the existing matrix style.

Keep every new assertion in the same PASS/FAIL counting scheme, and update the
script header's assertion count to the new total.

## Acceptance criteria

- [ ] `scripts/smoke_test.sh` runs green end-to-end against a fresh throwaway DB
      (requires the PocketBase binary; `scripts/setup.sh` fetches it).
- [ ] New assertions exist and pass for: `segments` existence, tank template
      presence, open→resolve non-mutation, and the four newer collections' rules.
- [ ] The script header states the new total assertion count and it equals the
      actual number of passing assertions.
- [ ] No product code, migration, or seed file changed.
- [ ] The open→resolve assertion genuinely fails if the original record is
      mutated (sanity-check by reasoning about the assertion, not by breaking
      product code).

## Guardrails

- **Additive only.** Do not remove or weaken existing assertions.
- Follow the script's own truth about PocketBase refusal codes (from
  SESSION-NOTES / the script comments): a denied LIST returns 200+empty, VIEW
  404, CREATE 400, UPDATE/DELETE 403 — assert "refused (non-2xx) AND the same
  request one tier up succeeds", counting records for read denials rather than
  trusting status codes.
- If the binary isn't present, the script/pre-push hook already no-ops; ensure
  your additions don't break that graceful path.
- Do not add a dependency on any non-shell tool; keep it bash + curl like the
  rest of the script.

## Definition of done

- Smoke test green with the new assertions; header count updated.
- `docs/current-state.md` "Known coverage gaps" list updated to remove the gaps
  you closed (docs-as-code).
- `Status:` set to `DONE`.
- Committed as the maintainer, message e.g.:
  `test: cover segments, tank, open→resolve, and the newer collections in the smoke test`.
