# ADR 0001 — The seed library is the schema authority; a check's subject is a tag XOR a system

**Status:** accepted · **Date:** 2026-07-09
Part 1 (reconciliation) shipped in commit `9d87dd1`; part 2 (check subjects)
is implemented by the migrations that accompany this ADR.

## Context

LoopCheck's domain checklist library was authored twice, in parallel. The
Phase 1 migrations hand-wrote a simplified copy (three response types, coarse
tag types, ~120 items). The maintainer — the domain expert — then delivered
the authoritative library in `seed/` with a deliberately richer schema:
four response types (`pass_fail_na`, `value` + `unit`, `text`,
`photo_required`), finer tag types (`pump_centrifugal`,
`valve_motor_operated`, `instrument_flow`, …), stable `template_key`
identifiers, `confirm_per_spec` flags for spec-governed acceptance values,
`subject_kind` (tag vs. location), camelCase phase names, and 197 line items.
ARCHITECTURE.md §9 recorded the divergence. One side had to win, project-wide.

Separately, `checks` required a `tag`. But real checkout practice includes
system-level events with no single equipment subject — a system functional
demonstration, a loop-wide test witnessed as one record — and the seed
library's `subject_kind` already anticipates non-tag subjects. With `checks`
append-only, a record created with the wrong shape is permanent, so the shape
must be enforced server-side, not by trusting clients.

## Decision

**1. The seed library wins, and exists in exactly one place.**

- `seed/` is the authoritative domain library. The seed migration is a
  **loader**: it reads `seed/checkout_templates.json` and
  `seed/compliance_templates.json` at migration time (via a
  `__hooks`-relative path, so it works from any launch directory) and holds
  no checklist content of its own.
- The schema adopts the seed side: the four response types, `unit`,
  `confirm_per_spec` on `template_items`; `template_key` (partial unique
  index — blank allowed on user-created templates) and `subject_kind` on
  `checklist_templates`; the finer tag_type enums on `tags` and
  `checklist_templates`.
- **Phases:** the authored JSON keeps its camelCase names (`pointToPoint`,
  `loopCheck`); the database stores snake_case (`point_to_point`,
  `loop_check`), consistent with every other identifier in the schema; the
  loader converts mechanically. `template_key` is stored **verbatim** — it is
  an opaque identifier, never parsed for its parts.
- `recurrence` blank = a one-time checkout checklist; `daily` / `per_shift` /
  `per_event` are the compliance cadences.
- **A tag's required phases are derived** — the phases that have a template
  for its tag_type — never stored. (Verified identical to the map documented
  in `seed/README.md`.)
- The shutdown runbook JSON is **not** loaded: a flat checklist cannot hold
  its offsets, hold points, and roles. It waits in `seed/` for Phase 4's
  shutdown collections.
- **DB reset, migrations edited in place.** No production databases exist —
  LoopCheck is pre-release — so the existing migration files were amended
  rather than stacked with rename migrations. After first release this
  door closes; schema changes become real forward migrations.

**2. A check's subject is a tag XOR a system (G11).**

- `checks.tag` becomes optional; a `checks.system` relation is added.
- The collection's server-side `createRule` enforces **exactly one** of the
  two is set — the same pattern as TrenchNote's movements either/or shape.
  Append-only means a malformed record is forever; the rule is the gate.
- Tag-subject checks serve equipment checkout (`subject_kind: "tag"`
  templates). System-subject checks serve system-level events. Phase 5's
  location subjects will get their own decision when a location entity
  exists; `subject_kind: "location"` templates are loaded but not executable
  until then.

## Consequences

- Editing the checklist library = edit `seed/`, reset the database. One
  source, no drift between JSON and migration code.
- The loader fails loudly at startup if `seed/` is missing — the repo, not
  just `pb_migrations/`, is the unit of reproducibility.
- Phase 2's execution UI must render all four response types, and render
  `confirm_per_spec` items with the value blank and a "per Section __"
  prompt.
- System readiness derivation gains a second input: a system's own checks,
  alongside its tags' checks and open A-punch items.
- Accepted quirk: `template_key` strings contain camelCase phase names while
  the DB's `phase` column is snake_case. Harmless — the key is opaque.
- Accepted: the tag-XOR-system rule lives in a Phase-1-permissive
  `createRule` that also carries a `TODO(auth)`; the auth lockdown ADR
  (still open) must preserve the shape check while tightening who may create.
