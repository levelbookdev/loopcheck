# ADR 0013 — Training as a signable milestone check, not only a closeout deliverable

**Status:** proposed · **Date:** 2026-07-10

**Implementation status (CURRENT, 2026-07-12):** migration `1789000021`, the
training seed loader `1789000022`, and the tag/readiness derivations have landed
while this ADR still says Proposed. The feature is implemented; the decision
status was not advanced. References below to migration/seed/UI work waiting for
review are historical and require formal reconciliation.

Acts on the forms-library review
(§2.3 — source note retained in the private Bindery repo).
Depends on [ADR 0009](0009-per-tag-phase-applicability.md) (`phases_na`),
which shipped — without it, training would false-red every tag that owes no
training.

## Context

LoopCheck models training as a **closeout_requirement** type (`training` in
the req_type enum): a deliverable owed, advanced required → received →
accepted. But the real startup packages treat training as a **signed field
event**: the "Training Summary" sheet cites the spec's training
paragraphs, names the equipment, and terminates in Manufacturer / GC / Owner
signatures and a date. Operators sign that they were trained, on this
equipment, on this date.

Both framings are true and the review says so plainly:

- the **event** — "training complete, witnessed, dated on this equipment" —
  is a signed record that belongs in the same ledger as the other checks;
- the **deliverable** — the training materials/records handed to the owner —
  stays in closeout.

Today only the deliverable exists. The event — the thing an owner's inspector
and the "Training Completed" matrix column actually read — is not
capturable as a dated, provable, witnessed record. Routing it solely through
a closeout checkbox loses the signatures, the date, and the per-equipment
specificity the forms demand.

## Decision

**Training becomes a check** — the event — while the closeout `training`
requirement stays for the deliverable. Both, deliberately.

- Seed a **`*.training` template** per applicable tag_type (`subject_kind:
  "tag"`, `witness_required: true` — the forms are multi-party signed). It
  runs through the existing check-execution engine unchanged: signed, frozen,
  append-only, witnessed. No new execution surface.
- The template's `phase` is a new enum value **`training`**.
- **Training is a MILESTONE, not one of the six checkout phases.** The
  checkout-standing fold — "N of 6 phases passed / checkout complete" — stays
  the equipment-verification sequence (installation → … → performance).
  Training is derived and shown *alongside*, exactly as the readiness matrix
  places "Training Completed" beside the checkout columns rather than inside
  them. "Checkout complete" must not silently come to mean "…and everyone was
  trained"; those are different statements an owner tracks separately.
- **`phases_na` (ADR 0009) governs applicability.** A tag that owes no
  training (a spare, a duplicate, equipment the owner already runs) marks
  `training` in `phases_na`, and it drops out of the milestone reckoning —
  the exact dependency that made #2 land before #5.
- The closeout `training` requirement type is **kept**: the deliverable
  (materials, records, attendance sheets handed over) is a distinct fact from
  the event (people were trained). The readiness matrix already shows both a
  checkout side and a closeout side; training reads as an event on one and a
  deliverable on the other, which is how the real binder reads.

### Why a `training` phase value at all

A check needs a `phase` to sit in the ledger and to render; training fits none
of the six checkout phases, and the subject is still a tag (so `subject_kind`
is the wrong axis). A distinct `phase` value is the honest identifier. It is
an **additive** enum change — no existing value changes meaning — but it is a
contract change (docs/API.md lists the phase set), so it rides this ADR and a
contract note, not a silent migration.

### Milestone vs. sixth-of-seven — the fold change

Standing and required-phases derivations already enumerate the six checkout
phases explicitly (both `tag.html` and `readiness.html` carry the ordered
list). Training is added to a **separate milestone set**, not that list, so:

- "Checkout complete" = the six checkout phases pass (unchanged);
- "Training completed" = the tag's `training` check(s) fold to a pass —
  a separate derived line on the tag page and a separate column on the
  readiness matrix, dated;
- a tag with a `training` template but `training` in `phases_na` shows
  training N/A, not outstanding.

## Alternatives rejected

- **Training as a seventh checkout phase folded into "checkout complete."**
  Rejected — it redefines a clean, load-bearing statement ("the equipment
  passed its six verification phases") to also assert an operations activity
  that isn't equipment verification. The readiness matrix keeps them adjacent but
  distinct; so should we.
- **Training as only a closeout requirement (status quo).** Rejected — it
  cannot carry the signatures, the per-equipment date, or the witness the
  real Training Summary forms require; it is a checkbox where the field needs
  a signed, dated event.
- **A dedicated `training_events` collection.** Rejected — training is
  structurally a check (a signed, witnessed, dated record against a tag). A
  separate collection would fork the engine (its own append-only rules, its
  own standing) for something the check engine already does; the `*.training`
  template reuses all of it.
- **Deprecating the closeout `training` requirement in favour of the check.**
  Rejected — the deliverable and the event are genuinely different facts an
  owner tracks separately; keeping both matches the binder.

## Consequences

- The check-execution engine gains training for free — pick the `*.training`
  template, sign, witness, done; it lands in the append-only ledger like any
  check, with the multi-party witness the forms want (and the eventual
  signature capture of ADR 0010 when that lands).
- The readiness matrix (review #3) and tag page gain a dated "Training
  completed" milestone beside checkout standing — the readiness-matrix column, derived.
- `phases_na` earns its keep: training applicability is per-tag, no false red.
- Additive contract change (a `training` phase value); docs/API.md updated,
  v1 stands (no existing shape breaks).
- Buildable now (the engine exists) — but this is ADR-first; the migration +
  seed + fold change wait for review of the milestone-vs-phase decision below.

## Open questions for the maintainer

1. **Milestone vs. seventh phase.** I recommend milestone (keep "checkout
   complete" to the six). Confirm — it's the crux, and it drives whether the
   fold and the matrix treat training separately or inline.
2. **Which tag_types get a seeded `*.training` template?** All equipment, or
   only the operator-facing kinds (pumps, blowers, control panels — not, say,
   a hardwired float)? A conservative seed set plus `phases_na` for the rest,
   or a broad set — a `seed/` domain-review call for the maintainer.
3. **Does the training check need a distinct template shape** (attendance /
   trainer / topics), or is the standard four-response-type checklist enough
   (e.g., "Operations staff trained on start/stop and alarms — record
   attendees", "O&M walkthrough completed", photo of sign-in sheet)? Likely
   the standard shape suffices; confirm before authoring the template.
