# ADR 0002 — Capture-side fields land before crews start logging

**Status:** accepted · **Date:** 2026-07-09
Implements Migration A from [DATA_MODEL_PLAN.md](../DATA_MODEL_PLAN.md) (Rev 1).

## Context

The future paid tier is a sidecar reading this repo's public API: if the
ledger doesn't record a fact, premium can't compute it. More importantly,
these are *capture-side* fields — they get their values when a tag is
imported or a check is executed. Retro-tagging 800 loops after six months of
logging is misery nobody will do; the columns must exist before the first
crew logs the first check. LoopCheck is pre-Phase-2, so that moment is now.

Every field below is a **field fact** (something true about the equipment or
the work, knowable standing in front of it or reading the contract
documents). Office coordination data — witness scheduling, SOV mappings,
lookaheads — stays out of core per the boundary doctrine.

## Decision

All additions optional and additive. No renames, no stored status, no
breaking changes. One forward migration (`1789000010_migration_a_capture_fields.js`)
— no DB reset needed, unlike the reconciliation.

**`tags` — the instrument-index facts** (all text, captured at CSV import):

| Field | What it is |
|---|---|
| `area` | Construction area — orthogonal to process *system* (Area 3 can contain parts of five systems). Billing and progress break down by area; also plain useful for filtering. |
| `spec_section` | The spec section governing this equipment (e.g. "11312"). Pairs with `confirm_per_spec` items — the "per Section __" prompt's first stop. |
| `loop_numbers` | Instrument loop number(s) the tag belongs to, comma-separated free text. |
| `plc` | The PLC/RTU serving this tag's I/O. |
| `mcc_breaker` | MCC bucket / breaker feeding it — the electrical trace a checkout crew walks. |
| `drawing_refs` | Drawing references beyond the P&ID: single line, schematic, loop drawing. |

**`systems.planned_startup`** (date): `startup_sequence` says *order*; alerts
and lookaheads need *calendar*. Considered premium-side schedule overlay vs.
core field; core wins because "planned startup: Aug 14" on the free system
page is genuinely useful, it is one optional date on an editable collection,
and it turns the risk-alert module into pure derived insight. Premium can
still overlay a richer schedule (P6 import) in its own database.

**`checklist_templates.witness_required`** (bool) and
**`checks.witness_required`** (bool, frozen at execution): whether a check
needs an owner/EOR witness comes from the spec, per checklist — template
data. Frozen onto the check at execution time, same pattern as frozen prompt
text: the historical record must read correctly even if the template is
later edited. Per-template granularity (not per-item) to keep the
"ready to witness" derivation simple; per-item is additive later if a real
owner ITR format demands it.

**`template_items.spec_reference`** (text): the per-line-item spec citation
("11312-2.03.B", or a universal standard like "NEMA MG-1") that answers a
`confirm_per_spec` item's "per Section __" prompt. Maintained per project against
the contract documents, and now also populated from the seed for lines whose
governing standard is universal. **Amendment (2026-07-11):** this field moved to
the `create_template_items` migration (`1789000004`) so the seed loader — which
runs *before* this migration — can populate `spec_reference` at seed time; it is
no longer added by Migration A. Pre-release refactor (DB reset), no behavior
change beyond the field existing earlier.

## Consequences

- The CSV importer's header-synonym table grows (`area`/`bldg`, `spec`,
  `loop`/`loop no`, `plc`, `mcc`/`breaker`, `single line`/`schematic`) so
  real instrument indexes populate the new tag fields with no reformatting.
- The system page shows `planned_startup`; the tag page shows which of its
  checkout phases require an owner witness. Read-only displays — no new
  workflows until Phase 2/3.
- Phase 2's execution UI must freeze `witness_required` from the template
  onto each new check, alongside the frozen prompt text.
- Deliberately NOT added (recorded so they aren't reinvented): witness
  scheduling collections, SOV/contract anything, import provenance (G8,
  deferred), `test_equipment` and punch-to-check links (Migration B — waits
  for Phase 0 review and the Phase 2 task).
