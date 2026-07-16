# ADR 0015 — Stored-equipment preservation log (recurring, tag-subject)

**Status:** accepted · **Date:** 2026-07-11
**Provenance:** second-pass forms-library review §3 ("Requirements for Long-Term
Storage / Stored-In-Place Equipment," reinforced by spec 01650 §2.06). Written
before its migration, per the docs-as-code rule. Ties to
[ADR 0005](0005-warranty-closeout-clock-start-provenance.md) (warranty) and
[ADR 0006](0006-service-connections-third-subject.md)/Phase 5 (the compliance
recurring-log machinery it reuses).

## Context

Equipment is delivered to a job weeks or months before it is installed, and the
manufacturer requires it to be **preserved** during that window — check oil,
check for rust, drain condensate, check lubrication, rotate the shaft, keep it
covered — **signed and dated each cycle.** Nothing in either repo or the roadmap
touches the *delivered-but-not-yet-installed* window, and it has real teeth:
skipped preservation is one of the most common ways a manufacturer **voids the
warranty**, which ties straight into the built warranty/closeout module
(ADR 0005).

This is a **recurring checklist run against a piece of equipment** — exactly the
shape the compliance-log machinery already has (`subject_kind`, `recurrence`,
one append-only ledger, one signature model, one PDF engine). The compliance
templates today are `subject_kind: "location"` (excavation, discharge, main
segment); the only thing different here is the subject (a **tag**) and the
cadence (**periodic**, not daily/per-shift/per-event).

## Decision

**Model the preservation log as a recurring template in the compliance family,
run against a tag. The only schema change is additive: extend the `recurrence`
enum.**

1. **Shape — reuse the compliance template exactly.** `subject_kind: "tag"`
   (preservation is per equipment tag), `tag_type: null` and `phase: null` (it
   applies to any stored equipment and is *not* a checkout phase), `recurrence`
   set to a periodic cadence. Same four response types, same ledger, same
   signatures. A tank leak test needed a new phase; this needs none — a recurring
   log lives outside the checkout-phase sequence.

2. **Schema — one additive enum extension.** The `recurrence` enum
   (`create_checklist_templates`, `1789000003`) is today
   `["daily", "per_shift", "per_event"]`. Add **`weekly`** and **`monthly`** — a
   plain additive enum change (appending never invalidates existing records), no
   reset, the same shape as the segment/tank enum migrations. Nothing else in the
   schema changes.

3. **No effect on required phases.** A tag's required *checkout* phases are the
   phases that have a **one-time** (`recurrence` blank, `phase` set) template for
   its tag_type. The preservation log has `recurrence` set and `phase` null, so
   it is invisible to that derivation — exactly like the compliance logs. A
   tag's checkout standing is unchanged; the preservation log is a separate
   recurring record beside it.

4. **Seed placement — own file + post-enum loader.** The preservation template
   lives in a new `seed/preservation_templates.json` loaded by a new loader that
   runs **after** the recurrence-enum migration. It cannot go in
   `compliance_templates.json`, because the early loader `1789000009` reads that
   file *before* the enum is extended (the same ordering reason the tank and
   segment templates get their own post-enum loaders).

5. **Warranty tie-in (ADR 0005) — provenance, not a stored link.** The
   append-only preservation ledger is the *evidence* that preservation was
   maintained; a gap in the cycles is the manufacturer's warranty-void trigger.
   Both the preservation checks and the `warranties` records hang off the same
   tag, so no foreign-key link is added — consistent with ADR 0005's "record the
   facts, derive the rest." A "preservation current / lapsed" signal (and any
   warranty-risk alert) is future premium derivation over the ledger, never a
   stored status.

6. **Execution deferred (Phase 5).** The recurring-log **execution UI** is not
   built — it is Phase 5 work shared with the already-seeded compliance logs. The
   preservation template seeds now (the domain content is captured), and its
   recurring execution lands with the rest of Phase 5. Until then it is data,
   like the compliance templates.

## Alternatives rejected

- **A dedicated `preservation` collection.** Rejected — it is a checklist run
  against a tag, which is exactly the compliance-template shape. Forking a
  collection would duplicate the ledger, signatures, and PDF engine for no gain.
- **A stored "preservation status" field or a warranty→preservation FK.**
  Rejected (derived-status doctrine + ADR 0005) — the ledger is the record;
  currency is derived; the warranty connection is provenance the dispute turns
  on, not a stored pointer.
- **Putting the template in `compliance_templates.json`.** Rejected — the early
  loader `1789000009` reads that file before the `recurrence` enum is extended,
  so a `weekly`/`monthly` template there fails on a fresh database. Own file +
  post-enum loader.
- **One template with per-item cadences** (rotate shaft weekly *inside* a monthly
  log). Rejected (flat-template / "an if-statement means two templates" rule) —
  if a manufacturer mandates a distinct weekly item separate from the monthly
  ones, that is a second template, not branching within one.

## Consequences

- One additive `recurrence` enum migration (`weekly`, `monthly`); a
  `preservation_templates.json` + loader; **no required-phases impact and no new
  tag_type or phase.**
- The delivered-but-not-yet-installed window becomes a signed, dated, append-only
  record — the provenance a warranty dispute (ADR 0005) turns on.
- Recurring execution awaits Phase 5, shared with the compliance logs.
- **Two templates seeded** (implemented in `1789000032_seed_preservation_templates.js`):
  a **weekly** log (shaft rotation, protection intact, heaters energized, quick
  visual) and a **monthly** log (oil, rust/preservative, condensate, lubrication,
  desiccant, photo) — split by cadence, not branched, per the flat-template rule.
- Remaining open domain call (for the maintainer): the exact item list and turn
  counts per manufacturer practice.
