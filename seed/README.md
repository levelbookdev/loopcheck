# LoopCheck Seed Library

Domain seed content for LoopCheck: checkout checklist templates (tag_type × phase),
compliance log templates (recurring, location-subject), and a generic wet-tap/tie-in
shutdown runbook. The seed migration (`pb_migrations/1789000009_seed_templates.js`)
loads the checkout and compliance files directly on first startup; the runbook stays
JSON-only until Phase 4 builds the shutdown collections.

## Files

| File | Contents |
|---|---|
| `checkout_templates.json` | Equipment checkout templates: centrifugal pump, MOV, flow instrument, level instrument, control panel — across the six checkout phases; plus the rotation-check pairs (ADR 0008, loaded on existing databases by the guarded `1789000017_seed_rotation_templates.js`); plus the **mechanical acceptance** forms — Uncoupled Motor Run Test (`pump_centrifugal`/`motor`, at `energization`), Mechanical Alignment Report (`pump_centrifugal`, at `installation`), and the gate seat-leakage line on the MOV energization template |
| `compliance_templates.json` | Recurring compliance logs: competent-person excavation, dewatering discharge, AWWA C651 disinfection/flushing/bac-t |
| `service_templates.json` | Service cutover templates (water main replacement): 48-hour notice, locate/pothole, new service, meter, tie-over, restoration — `subject_kind: "service"`, loaded by `1789000014_seed_service_templates.js` |
| `training_templates.json` | Training milestone templates (ADR 0013): O&M/HMI training for pumps and control panels — `subject_kind: "tag"`, `phase: "training"`, `witness_required: true`, loaded by `1789000022_seed_training_templates.js` |
| `segment_templates.json` | Segment acceptance templates (Phase 6, ADR 0014): hydrostatic test, C651 disinfection, and bac-t collection for pressure/force mains; low-pressure air, mandrel/deflection, and manhole vacuum for gravity sewers — `subject_kind: "segment"`, keyed by `segment_type` via `tag_type`, loaded by `1789000025_seed_segment_templates.js` |
| `tank_templates.json` | Tank/basin acceptance: the 48-hr **Leak Test** — a `tag` subject with `tag_type: "tank"` at the `leakTest` phase (enums added by migration `1789000027_N`), loaded by `1789000028_seed_tank_templates.js`. The OPEN half of an ADR-0012 open→resolve test (see the open→resolve note below) |
| `preservation_templates.json` | Stored-equipment **preservation logs** (ADR 0015): a **weekly** log (shaft rotation, protection, heaters) and a **monthly** log (oil, rust/preservative, condensate, lubrication, desiccant) for the delivered-but-not-yet-installed window — recurring `subject_kind: "tag"` templates, `recurrence` weekly/monthly (enum added by migration `1789000031_Q`), loaded by `1789000032_seed_preservation_templates.js`. The append-only warranty-provenance ledger (ADR 0005) |
| `shutdown_runbook_tie_in.json` | Generic pressurized-main tie-in runbook: steps, offsets, roles, notification triggers |

## Template schema

```json
{
  "template_key": "pump_centrifugal.loopCheck",
  "tag_type": "pump_centrifugal",
  "phase": "loopCheck",
  "name": "Centrifugal Pump — Loop Check",
  "recurrence": null,
  "subject_kind": "tag",
  "items": [
    {
      "seq": 1,
      "text": "Run status feedback displays correctly at HMI",
      "response": "pass_fail_na",
      "unit": null,
      "confirm_per_spec": false,
      "spec_reference": null
    }
  ]
}
```

**Response types (deliberately only four):** `pass_fail_na`, `value` (numeric + `unit`),
`text` (short note), `photo_required`. No branching, no conditional logic — per the
design constraint, LoopCheck answers *whether the check was done, by whom, and what
they found*. The moment a template needs an if-statement, it's two templates.

**`confirm_per_spec: true`** flags items where the acceptance value is governed by the
project spec or a referenced standard (megger minimums, chlorine residuals, flushing
velocity, torque values). The template names the check; the project confirms the number.
These render in the UI with the value field blank and a "per Section __" prompt, and the
open-confirmation list below should be resolved against the contract documents before a
project goes live. This keeps the seed library honest — it never hardcodes a number that
a spec section overrides.

**Proposed, not implemented — acceptance limits beside the reading.**
[ADR 0018](../docs/adr/0018-multi-vendor-startup-evidence-model.md) §7
(*proposed*) would add `expected_min` / `expected_max` / `expected_text` /
`comparison` to `template_items`, so a `value` line can carry its acceptance
limit instead of leaving the number in the binder with no criterion. It adds
**no fifth response type** — constraint #5 stands, and `confirm_per_spec: true`
with blank limits stays the honest "the project spec supplies this number"
state. When it lands, the seed schema gains four optional keys per item and
this library's `confirm_per_spec` lines are exactly the ones that stay blank.

**`spec_reference`** (optional, per item) carries the *citation* for a
`confirm_per_spec` line: the governing **standard** where it is universal
(`"AWWA gate seat-leakage / spec"`), or a project spec section
(`"11312-2.03.B"`) filled per project. The seed populates it for lines whose
standard is universal and leaves it blank for project-specific sections. It is a
`template_items` column created with the collection (migration `1789000004`), so
the seed loader — which runs before Migration A — can set it; the loader maps
`item.spec_reference` straight through (ADR 0002).

**Mechanical acceptance forms are additional templates within existing phases,
not new phases.** The Uncoupled Motor Run Test sits at `energization` and the
Mechanical Alignment Report at `installation` — phases `pump_centrifugal` (and,
for the run test, `motor`) already own — so the required-phases map below is
**unchanged**. This mirrors how the rotation pair already shares `energization`.
Alignment is seeded for `pump_centrifugal` only (the represented coupled unit);
putting it on the catch-all `motor` would pull `installation` into every motor
tag's obligations. Blowers/mixers get their own alignment template when those
tag_types land. The alignment form's **witness** is captured per check via
`checks.witnessed_by` (multi-party witness), not a template line.

**Loop-check lines name their destination.** A signal can be right at the PLC and the
local OIT yet wrong at central SCADA (scaling, tag mapping, comms), so a loop check that
only says "reads correctly at HMI" hides a real failure mode. Each verification line in a
`*.loopCheck` template therefore names *where* it is verified — **PLC** (logic / origin of
truth), **local OIT / panel HMI**, **central SCADA** — and marks the non-universal layers
"(as applicable)", since a field instrument may have no local OIT and a simple panel may
have no central SCADA. The analog sweep is verified point-by-point at the PLC (where the
scaling originates), then confirmed at SCADA and OIT. This is authoring guidance, not a
schema change — it stays within the four response types. Two things it deliberately does
*not* try to encode structurally, because they would change the contract, not the content:
**I/O type** (DI/DO/AI/AO) is reflected in the line text where it aids the tech, never a
field; and **witness stays per-template** — there is no per-line "unwitnessed" flag.

## Phase model

Phase sets are per subject kind (ADR 0006). Equipment (tag subjects):

`installation → pointToPoint → energization → loopCheck → functional → performance`

Plus a **`training` milestone** (ADR 0013) — a signed, witnessed, dated
training *event* per equipment. It is a phase value but deliberately **not one
of the six checkout phases**: "checkout complete" stays the six-phase sequence,
and training is derived and shown *beside* it (the readiness matrix's "Training
Completed" column). Training templates live in `training_templates.json`
(`witness_required: true` — the forms are manufacturer/GC/owner signed),
loaded by `1789000022_seed_training_templates.js` after `1789000021` opens the
enum. A tag that owes no training marks `training` in `phases_na` (ADR 0009).

**Proposed, not loaded — two process-plant phases.**
[ADR 0018](../docs/adr/0018-multi-vendor-startup-evidence-model.md) §1
(*proposed*) would add `wetCommissioning` (clean water / wet-mech) and
`processSeeding` to the equipment phase set, because a real multi-vendor plant
startup runs those stages and the current six have no honest home for them. The
observed "dry checks" and "I/O checks" map onto `installation`/`energization`
and `pointToPoint`/`loopCheck` respectively and get **no** new phase — a new
*form* at an existing phase costs nothing, a new *phase* changes every affected
tag's derived denominator. Nothing here is authored yet, and the vocabulary is
still open ([open-questions #11](../docs/open-questions.md#11-what-is-the-right-startup-phase-vocabulary)).
Note also what ADR 0018 does **not** propose: a per-project phase list. A
project configures its phases by configuring this library.

Service connections (service subjects, ADR 0006):

`notice → locatePothole → newService → meter → tieOver → restoration`

A service's required phases derive the same way a tag's do: the phases that
have a `subject_kind: "service"` template. The notice template's photo line
is the load-bearing item — the timestamped door-hanger photo is the record
that ends a "we were never noticed" dispute.

Pipeline segments (segment subjects, Phase 6 / ADR 0014):

`hydro → disinfection → bac_t` (pressure), `air_test → deflection → vacuum` (gravity)

A segment's required phases derive by its **`segment_type`** exactly as a tag's
do by `tag_type`: the phases that have a `subject_kind: "segment"` template
whose `tag_type` (reused as the subject-type discriminator, ADR 0014 §2)
matches. `pressure_main` owes hydro + disinfection + bac-t; `force_main` owes
hydro only (pressurized wastewater, not potable — no disinfection/bac-t);
`gravity_sewer` owes air test + mandrel/deflection + manhole vacuum. A segment
is **accepted** when every required phase folds to pass — derived, never
stored, the same invariant as a tag's checkout standing.

**Bac-t is the open→resolve record (ADR 0012).** `segment_templates.json`'s
`segment.pressureMain.bacT` is only the **collection** half: signed at
collection with `result: "pending"`, its line items freeze the sample tap,
IDs, and chain-of-custody. The lab result returns later as a *separate* resolve
check (`result: pass|fail`, `resolves` → the open check, lab report attached),
never mutating the collection record. A failing sample loops back to a new
disinfection + new bac-t collection; the failure stays in the ledger.

**The Tank Leak Test is the second open→resolve form.** `tank_templates.json`'s
`tank.leakTest` is the OPEN half — a `tag_type: "tank"` template at the
`leak_test` phase capturing the fill, allowable-loss criterion, and timed
intermediate inspections, signed at start with `result: "pending"`. The 48-hr
final loss + pass/fail is the resolve check (`resolves` → the open check); a
mid-test leak resets as a new open event. The open→resolve **schema** (Migration
K: `pending` + `resolves`) is in place, but the open→resolve **execution UI** and
the derived **"running"** standing state are **not built yet** — shared with the
already-seeded bac-t. Until they land, both templates seed and can be run as
ordinary pass/fail checks, but the pending/resolve flow isn't executable. (The
tank tag_type and leak_test phase enums were added by migration `1789000027_N`.)

Required phases vary by tag_type — that mapping is data, not code:

```json
{
  "pump_centrifugal":      ["installation","pointToPoint","energization","loopCheck","functional","performance"],
  "valve_motor_operated":  ["installation","pointToPoint","energization","loopCheck","functional"],
  "motor":                 ["energization"],
  "instrument_flow":       ["installation","pointToPoint","loopCheck","functional"],
  "instrument_level":      ["installation","pointToPoint","loopCheck","functional"],
  "control_panel":         ["installation","pointToPoint","energization","functional"],
  "tank":                  ["leakTest"]
}
```

A tag's derived status = its check ledger evaluated against this map. A system is
startup-ready when every tag clears its required phases and open A-punch count is zero.

## Rotation-check templates (ADR 0008)

`pump_centrifugal` and `motor` each carry a rotation-check **pair** at the
energization phase: `*.rotation` (Hand/Auto direction only) and
`*.rotationVfd` (adds VFD max/min speed and accel/decel ramp values). Two
templates instead of one conditional template — the "if-statement means two
templates" rule; the capture UI picks the variant by the tag's `has_vfd`
flag. Direction is a `value` item constrained to forward/reverse by the UI;
the pass / hardware-fault / software-conflict reading is derived from the
recorded pair (both forward = pass; both reverse = swap leads; mismatch =
VFD reference parameter, do NOT swap leads), never stored.

## Compliance templates

Same schema, two field differences: `recurrence` is `"daily"`, `"per_shift"`, or
`"per_event"`, and `subject_kind` is `"location"` (an excavation, a discharge point,
a main segment) instead of `"tag"`. Nothing else changes — same ledger, same
signatures, same PDF engine.

## Runbook schema

See `shutdown_runbook_tie_in.json`. Steps carry `planned_offset_min` (T+minutes),
`planned_duration_min`, `responsible_party`, `hold_point` (requires witness ack before
proceeding), and optional `tag_ref` — a step like "Close 30-inch BFV" references the
actual valve tag with its own checkout history. Roles carry `notify_on` triggers.

## Open confirmations (resolve per project before first live use)

- [ ] Megger acceptance values and test voltage — per project spec / NETA ATS as referenced
- [ ] Motor alignment tolerance (TIR) — per manufacturer / spec section (also drives the Mechanical Alignment Report ≤ .005 TIR / ≤ .002 DP defaults)
- [ ] Uncoupled motor run — HP-keyed run duration (2 hr > 100 hp / 30 min 20–100 hp), allowable bearing temperature rise, vibration velocity, and the source-form speed–deflection defaults (3600/1.0, 1800/1.5, 1200/2.0, 900/2.5, 600/3.0, 300 rpm/3.5 mils) — per equipment spec / manufacturer
- [ ] Valve/gate seat-leakage acceptance — gates ≤ 0.1 gpm per foot of seating perimeter; non-seating (butterfly) service per its own standard — per AWWA / spec
- [ ] Chlorination method and residual/contact-time values — per AWWA C651 edition referenced by spec, and the spec's own overrides
- [ ] Flushing velocity minimum — per spec (C651 baseline vs. project value)
- [ ] Bac-t sample count/locations and lab turnaround — per district requirements
- [ ] Dewatering log fields — reconcile against the actual discharge permit conditions (turbidity limits, pH range, monitoring frequency)
- [ ] Excavation inspection items — reconcile against Cal/OSHA vs. Fed OSHA Subpart P as applicable, and company HASP
- [ ] Whether district operations personnel exclusively operate district-owned valves (usual, but confirm — it changes runbook `responsible_party` assignments)
- [ ] Service cutover: minimum cover over new services, service test pressure/duration (with-main vs. individual), and the required old-service kill method (corp closed+capped vs. crimped vs. removed) — per spec and district standard details
- [ ] Notice lead time — the templates say 48-hour; some districts require 72-hour or door-to-door contact for commercial services
- [ ] Segment hydrostatic test: test pressure, hold duration, and allowable makeup water — per AWWA C600 edition referenced by spec (the templates flag these `confirm_per_spec`)
- [ ] Segment disinfection: chlorine dose, contact time, residual minimum, flushing velocity — per AWWA C651 edition and the spec's own overrides (shares the distribution-main C651 confirmation above)
- [ ] Gravity sewer air test: starting pressure (groundwater adjustment) and minimum hold time per pipe size/length — per spec / referenced ASTM
- [ ] Gravity sewer mandrel: mandrel percentage of base ID, allowable deflection, and minimum time after backfill — per spec
- [ ] Manhole vacuum: test vacuum and minimum hold time per depth/diameter — per ASTM C1244 / spec
- [ ] `force_main` acceptance test set — confirmed as hydrostatic-only (no disinfection/bac-t); verify against district standard for reclaimed/pressure-sewer mains
- [ ] Tank/basin leak test — test level, stabilization/absorption period, allowable loss (makeup water or level drop over the 48-hr hold), and the intermediate-inspection schedule — per AWWA D110 (prestressed) / D115 (wire-wound) / D103 (steel) or spec

## Design constraints carried into CLAUDE.md

1. Checks and executed runbook steps are **append-only**. A re-test or re-run is a new record.
2. Runbook execution view: **zero navigation taps, glove-sized touch targets**. 2 AM, rain, schedule pressure.
3. Templates are flat ordered lists. No form designer, no branching. Ever.
4. CSV import (instrument index) stays in the free tier — it's the onboarding moment.
