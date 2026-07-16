# ADR 0004 — Test-equipment traceability lives in core; punch items link to their evidence

**Status:** accepted · **Date:** 2026-07-10
Implements Migration B from [DATA_MODEL_PLAN.md](../DATA_MODEL_PLAN.md)
(Rev 1). Lands with Phase 2 because the check-execution UI is what
populates these fields.

## Context

Two facts about the field cannot be reconstructed after the fact:

1. **Which instrument performed a check.** Standard loop-sheet and startup
   forms require the test equipment used and its calibration status — the
   real contractual rule, confirmed against an actual startup package
   (DATA_MODEL_PLAN Rev 1), is calibration to a NIST-traceable standard
   *within the previous 90 days* of use. That is field data captured at
   check time, so it belongs in core (boundary doctrine, ADR 0003) — the
   premium calibration watchdog then derives its alerts from data everyone
   has.
2. **Which check spawned a punch item, and which retest cleared it.**
   Today closure is free text; a retest can only be inferred (failed check
   → later check, same tag + phase). The inference stays as a fallback,
   but "punch A-041, raised by check 118, cleared by check 235" is an
   evidence chain an owner's inspector — and a dispute — values far more
   than a heuristic.

## Decision

One forward migration (`1789000011_migration_b_evidence_links.js`), all
additive, no DB reset.

**`test_equipment` — a new, GLOBAL registry collection** (resolves the
plan's open question 1 as it recommended): `description`, `manufacturer`,
`model`, `serial_number`, `cal_due` (date). A meter moves between jobs and
its serial number is its identity, so the registry is not per-project; a
project filter can be added later if a fleet grows past usefulness.
Calibration certificates attach through the existing polymorphic
`attachments` (`parent_collection = "test_equipment"`) — no schema change.
The registry is **editable** (it is a catalog, not a ledger); history is
protected by freezing, below.

**On `checks`:**
- `test_equipment_used` — relation to the registry, up to 3 (a loop check
  can involve a calibrator, a meter, and a pressure module).
- `test_equipment_note` — frozen text written at execution time
  ("Fluke 754 s/n 8823, cal due 2026-09-01"), same pattern as the frozen
  prompt text and `witness_required`: the appended-only record must read
  correctly even if the registry is edited later.

**On `punch_items`:**
- `source_check` — optional relation to the failed check that spawned the
  item, set at creation when applicable.
- `closing_check` — optional relation to the passing retest that justified
  closure. Optional because plenty of punch items (paint scratch, missing
  label) close without a retest.

## Consequences

- The Phase 2 execution UI must offer the registry at check time, freeze
  the note, set `source_check` on punch items flagged from a failed check,
  and offer `closing_check` when closing a punch item off a passing retest.
- The API contract grows a tenth collection and four fields — additive, so
  contract v1 stands; docs/API.md is updated, not version-bumped.
- Aging analytics move from heuristic to evidence where the links exist;
  the failed-check → later-pass inference remains the documented fallback
  for records created without them.
- The 90-day NIST window is premium derivation (`cal_due`, use date,
  `planned_startup`) — core stores facts, not alerts. Nothing here stores
  a status.
- Deliberately not added: calibration history as a ledger (the certificate
  attachments and frozen notes carry it), per-project registry scoping,
  and any scheduling data.
