# ADR 0008 — VFD rotation & parameter check: a specialized capture UI on the ordinary ledger

**Status:** accepted · **Date:** 2026-07-10
Adds the VFD Rotation & Parameter Check module: a `has_vfd` flag on tags,
four seeded rotation templates, a dedicated glove-sized capture page with
live guidance, and a per-project rotation board / printable vendor report.
Free tier.

## Context

A motor that runs backward in Hand is not necessarily wired backward. On a
VFD-driven motor, the drive's reference configuration (e.g. an "Inverse
Reference" parameter) can reverse rotation in one control mode only —
software, not copper. The failure mode this module digitizes is real:
a crew sees reverse rotation, concludes "swap the leads at the MCC," and
performs a LOTO-and-relanding exercise that *introduces* a hardware fault
on top of a software setting. The diagnostic is the **pair** of
observations, not either one alone:

| Hand | Auto | Meaning |
|------|------|---------|
| Forward | Forward | Correct — pass. |
| Reverse | Reverse | Hardware — phase sequence is wrong at the motor. Swap leads at the MCC (LOTO). |
| Reverse | Forward | Software — do NOT swap leads. Check the VFD reference/direction parameter. |
| Forward | Reverse | Software — same class of fault, inverted in the Auto path. |
| any Untested | | Incomplete — no conclusion yet. |

(The spec that prompted this module named only the Reverse/Forward case;
the symmetric Forward/Reverse case is the same class of fault and is
treated identically — a mismatch between control modes is by definition
not a wiring problem, because the copper doesn't know which mode started
the motor.)

Separately, vendors require the commissioning record to show the loaded
VFD parameters (max/min speed, accel/decel ramps) verified at
dry-mechanical checkout. The existing energization templates have a
pass/fail line for "VFD parameters loaded per approved submittal" but
never capture the actual values.

## Decision

### The record is an ordinary check — no new collection, no new result value

A rotation check is written as a standard `checks` + `check_items` record:
same append-only enforcement, same exactly-one-subject rule, same frozen
prompts, same `performed_by` free text, photos through the polymorphic
`attachments` collection. ADR 0006 already rejected forking the checklist
engine per subject kind; forking it per *check kind* would be the same
mistake. One ledger, one immutability guarantee, one future PDF engine.

The four-outcome guidance (pass / hardware fail / software conflict /
incomplete) maps onto the ledger like this:

- **Stored `result` stays pass / fail / incomplete.** Both the hardware
  case and the software-conflict case store `fail` — both block startup,
  which is what `result` means to every existing consumer (system
  readiness, punch links, the future turnover PDF).
- **The hardware-vs-software distinction is DERIVED** from the two
  direction values frozen into the check's `check_items`, by the pages
  that render it (the capture page, the rotation board, the report).
  Hard constraint #4: derive, don't store. The distinction is a *reading*
  of the two facts; the facts themselves are what the ledger holds.

### Two templates per tag_type, not one template with an if

Whether the VFD parameter lines appear is conditional on `has_vfd` — and
the house rule (hard constraint #5) is that a template needing an
if-statement is two templates. So the seed library gains four:

- `pump_centrifugal.rotation` / `motor.rotation` — Hand/Auto direction only
- `pump_centrifugal.rotationVfd` / `motor.rotationVfd` — plus VFD max
  speed (Hz), min speed (Hz), accel ramp (s), decel ramp (s)

All at phase `energization` (the first time the motor spins under power).
The capture page picks the variant by the tag's `has_vfd` flag. Direction
is captured as `value` items ("forward" / "reverse" via big buttons —
free-text storage, constrained entry), VFD parameters as `value` items
with units. No new response types.

These are the first templates for tag_type `motor`, so a bare motor tag's
derived required phases go from none to `energization` — which is exactly
right.

The existing energization templates keep their rotation-bump and
"parameters loaded" lines: the bump at initial energization (possibly
uncoupled) and the two-mode rotation verification with recorded parameter
values are different events, and real programs perform both.

### `tags.has_vfd`, a capture-side boolean

One additive field on `tags` (the ADR 0002 precedent: capture at import
time so nothing needs retro-tagging). It is nameplate-class fact, not
status. The equipment-schedule CSV import gains header synonyms for it
(`has_vfd`, `vfd`) plus `vendor`/`manufacturer` → the existing
`manufacturer` field and `system_group` → `system_number`.

### A dedicated capture page, because the guidance is the point

The generic `check.html` renderer stays untouched. The rotation check
gets its own page (`rotation_check.html`) whose live color-coded guidance
— "do NOT swap leads" shown *while the tech is standing at the drive* —
is the module's reason to exist. Specialized UI, standard record shape.
A per-project board (`rotation.html`) groups equipment by system, chips
each tag by its **latest** rotation check (derived, never stored), prints
cleanly as the vendor/owner's-rep deliverable (free tier, like
`cutover.html`), and exports CSV.

## Consequences

- The API contract is touched only additively: `tags.has_vfd` (bool).
  No enum changes, no new collections, no rule changes.
- Consumers that read only `checks.result` see a software conflict as a
  plain fail — safe (it does block startup) but undifferentiated; the
  differentiated reading requires the check's items, which the rotation
  pages fetch anyway for the parameter values.
- A correction (re-test after the parameter is fixed) is a new rotation
  check; the board reads the latest one. The failed record stays in the
  ledger — that history is evidence the conflict was found and resolved
  in software, with the leads never lifted.

## Rejected

- **A fourth `checks.result` value, `conflict`.** Additive to the enum but
  contract-breaking in semantics: every consumer of `result` would need to
  learn that `conflict` blocks startup. The distinction is derivable from
  the frozen items; storing it duplicates derived truth (constraint #4)
  and bumps the API contract for no query the module actually needs.
- **A dedicated `rotation_checks` collection.** Typed columns and cheap
  queries, but it forks the ledger: a second immutability enforcement, a
  second frozen-copy pattern, a second thing the Phase 3 PDF engine must
  learn. Rejected for the same reason ADR 0006 rejected forking the
  engine per subject kind.
- **`vendor` as a new tags field.** The CSV column maps to the existing
  `manufacturer` nameplate field; `warranties.vendor_name` already covers
  the warranty-holder sense of "vendor."
