# ADR 0005 — Warranty & closeout tracking: record the clock, not the deadline

**Status:** accepted · **Date:** 2026-07-10
Adds the Warranty & Closeout Tracker module: four collections
(`warranties`, `closeout_requirements`, `closeout_log`,
`warranty_claims`), a tag-page section, two project views, a
print-friendly package, and a CSV import mode.

## Context

Every tag in the registry lives on after startup: it has a warranty
clock, a vendor contact, an O&M manual, spare parts, and training
requirements. Today that is a closeout spreadsheet that dies when the PM
rolls off the job. The QR code that carried a tag through checkout should
answer, for the rest of the plant's life: *is this still under warranty,
who do I call, where are the spares?* This is also the first LoopCheck
surface whose end user may be the **owner/operator**, not the contractor.

The single biggest warranty fight in this industry is **when the clock
started**. Equipment often sits installed for a year before startup, and
specs define the basis differently per project: substantial completion,
beneficial use, successful startup, or "X months after shipment,
whichever occurs first." A spreadsheet column that holds only an end
date has already lost that fight — there is no provenance.

## Decision

### The clock-start provenance model

A warranty record stores the **basis** (enum: `substantial_completion`,
`beneficial_use`, `startup`, `shipment_cap`, `other`), a free-text
`basis_note` for the exact spec language ("24 mo from SC or 30 mo from
shipment, whichever first"), the **`clock_start_date`** (the actual
triggering event date), and **`duration_months`**. The end date is
**derived** (`clock_start_date + duration_months`, day-clamped calendar
month arithmetic, computed in the UI) and **never stored** — the same
invariant as tag status (hard constraint #4): a stored end date can
drift from its inputs; a derived one cannot, and the inputs *are* the
provenance a dispute needs.

`clock_start_date` is deliberately **optional**: during commissioning —
exactly when this data gets entered — most trigger events have not
happened yet. "Terms known, clock not started" is a first-class state
(shown as *Awaiting trigger event*), not missing data. Recording the
basis before the event is the whole point.

### Four collections, three mutability profiles

| Collection | Profile | Rule shape |
|---|---|---|
| `warranties` | editable registry of contract facts | update allowed, delete admin-only |
| `closeout_requirements` | workflow state (`required → received → accepted`) | update allowed, delete admin-only |
| `closeout_log` | append-only trail of requirement status changes | **update/delete never** |
| `warranty_claims` | close-once ledger | update **only while open**, delete admin-only |

- **`closeout_requirements.status` is workflow state, not history**, so
  it may be edited — but every change is also appended to
  `closeout_log` (requirement, from/to status, who, note, server
  timestamp) by the UI. The log is a separate append-only collection,
  **not** a mutable note field on the requirement: a text field any
  client can rewrite is not a trail, it is a story. Same reasoning as
  checks (hard constraint #2), enforced in the schema
  (`updateRule: null`, `deleteRule: null`).
- **`warranty_claims`** have a lifecycle (opened → vendor notified →
  resolved → closed), so an *open* claim is updatable. Closure freezes
  it: `updateRule: "closed_at = ''"` — the rule is evaluated against
  the stored record, so the closing PATCH itself passes and every
  update after it is rejected server-side. Corrections to a closed
  claim are new claims. An open claim is one with no `closed_at` —
  derived, not a status field.
- Both `warranties` and `warranty_claims` carry a denormalized
  `project` relation (same pattern as `punch_items`) so the project
  views filter without nested-relation queries.

### Attachments and TrenchNote

Warranty certificates, spec-section photos, O&M manual PDFs, and
training sign-in sheets attach through the existing polymorphic
`attachments` collection (`parent_collection = "warranties" |
"closeout_requirements"`) — no schema change, as designed in Phase 1.
`closeout_requirements.storage_location` is **free text** ("Owner's
warehouse shelf B3"); a team that also runs TrenchNote writes its asset
reference there as text. No integration is built.

## Consequences

- The API contract grows from ten to **fourteen collections** — all
  additive, so contract v1 stands; `docs/API.md` is updated, not
  version-bumped (the ADR 0004 precedent).
- The tag page grows a Warranty & Closeout section (derived status
  badge, tap-to-call vendor, requirement checklist, claims), readable
  by an operator who has never heard of LoopCheck. Claims open and
  close from the tag page — the person standing at broken equipment is
  the person on the phone with the vendor.
- The closeout dashboard (`closeout.html`) is the "are we ready for
  final completion" view: tags × requirement types, completion % by
  system, status advanced there (each advance writes a `closeout_log`
  entry). The warranty timeline (`warranty.html`) sorts tags by derived
  expiration, flagging ≤ 90 days.
- The CSV import gains a warranties mode (tag_number, vendor, basis,
  clock_start_date, duration_months) so a PM migrates the existing
  closeout spreadsheet in one paste.
- The compiled **Warranty Log & Closeout Package** is paid-tier
  deliverable territory; core ships a print-friendly HTML view
  (`closeout-package.html`) — the same boundary as the turnover binder
  (ADR 0003). **No email alerts in core**: expiry alerts are derivation
  (`clock_start_date`, `duration_months`, today), which is the future
  hosted tier's job. Core stores facts, not alerts.

## Rejected

- **Storing the derived warranty end date.** It drifts from its inputs,
  and it erases exactly the provenance (basis + trigger date) the
  dispute is about. Hard constraint #4 applies beyond checkout status.
- **A mutable `status_log` text field on requirements** instead of the
  `closeout_log` collection. Rewriteable history is no history.
- **Pure append-only `warranty_claims`** (a new record per state
  change). Over-modeled for a record a human touches three times over
  months; the close-once rule preserves the immutability that matters
  (nothing changes after closure) without scattering one claim across
  rows.
- **A `warranty` relation on claims.** The brief's model is per-tag and
  the tag is what the QR resolves; a claim cites its warranty terms in
  prose. Revisit only if multi-warranty tags prove common.
- **A TrenchNote integration** for spare-parts storage locations. Free
  text; the wall between the products stays up.
