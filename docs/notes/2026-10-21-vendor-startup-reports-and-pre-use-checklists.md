# Vendor startup reports and pre-use checklists: what they show LoopCheck

*Working note, 2026-10-21. Structural findings from a fourth batch of a general
contractor's records: one 2020-23 repair job that replaced the internal
mechanisms of several 105-foot secondary clarifiers, read through its startup
and commissioning plan (with the equipment manufacturer's final mechanical
checklist and the electrical subcontractor's test forms bound in) and seven of
the manufacturer's field service reports; and the contractor's blank pre-use
inspection checklists for construction equipment. Descriptive, not normative:
it decides nothing and authorizes no build. Findings that change core go
through an ADR, per the docs-as-code rule in [CLAUDE.md](../../CLAUDE.md).*

Source documents are internal company material and stay out of this repo, as in
[the 2026-10-11 note](2026-10-11-historical-startup-records.md),
[the 2026-10-19 note](2026-10-19-specification-and-field-forms.md) and
[the 2026-10-20 note](2026-10-20-closed-job-records.md). No project, owner,
company, vendor, or person is identified here. The source review is kept
privately, outside this repo.

---

## Confirmed: already modeled

- **The startup sequence is LoopCheck's phase fold.** The plan's flow diagram
  runs construction ready → pre-commissioning (mechanical installation check,
  motor operation, rotation, megger) → the manufacturer's mechanical checklist
  → a dry functional test of at least four hours → a seven-day operational
  performance test on process fluid. Commissioning starts only after
  pre-commissioning "has been signed off by the manufacturer's representative,
  owner's representative and contractor's startup manager": three parties, as
  in [ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md) §9.
- **The vendor's visit is a narrative report, not a form.** Each of the seven
  field service reports is one visit: the unit's serial, the dates on site, the
  purpose and a prose account. The report template has "Action Items" and
  "Recommendations" sections, and **all seven leave them blank**; the punch
  list and the findings live in the prose. That is
  [ADR 0017](../adr/0017-vendor-field-service-reports.md)'s shape (a `summary`
  plus the attached report) rather than a structured vendor form.
- **Every check cites its reference.** The manufacturer's final mechanical
  checklist has four columns: check, reference (an erection drawing and a named
  section of the instruction manual), installer sign-off, date. The electrical
  subcontractor's duct bank form cites a specification paragraph on each line.
  That is `template_items.spec_reference`.
- **The number belongs to the unit, not the template.** The drive's torque
  overload was tested on two mechanisms of the same model on the same job. One
  report records no alarm, shutdown at 60% and shutdown at 100%; a later one
  records an alarm at 53% and motor shutdown at 58%. The check is the same and
  the setpoints are not. That is `confirm_per_spec`.
- **Several readings, one limit, one line each.** Drive level was measured at
  four points, A to D, against one ¾-inch tolerance; rake-arm level was "within
  ½ inch" for both arms. ADR 0018 R1 keeps one template line per reading. The
  subcontractor's insulation resistance forms go the other way, "only the
  lowest reading to be recorded", which is the information loss R1 avoids.
- **Test instruments are named on the record.** The megger and insulation
  resistance forms carry the instrument's ID, serial, model and calibration
  due date. That is [ADR 0004](../adr/0004-test-equipment-and-punch-evidence-links.md).
- **Electrical acceptance is keyed by circuit and cable tag**, with one
  phase-to-phase and phase-to-ground set per parallel run, as in the
  2026-10-19 note's finding 5.
- **Readiness costs money.** One report is filed with "(Not Ready)" in its
  name: the trip was booked to inspect a finished mechanism, the contractor
  said it would not be ready, and the vendor's technician spent the two days on
  site going over questions and counting parts. Another technician "was
  informed that I had to witness the 4 hour operational test" on arrival. Both
  add to the 2026-10-19 note's findings 2 and 10.
- **A vendor punch list gates operation.** The checkout report lists four
  punch items (oil levels, a missing second manifold seal, skimmer adjustment,
  actuators not installed) and closes: "When the punch list items are complete,
  the clarifier is ready for full operation." The next visit records each one
  done. That is ADR 0018 §6 (`assigned_party`, `blocks_phase`), with closure
  evidence in a later visit's report.
- **Sign-off columns exist; executed sign-offs do not.** The manufacturer's
  checklist is bound into the plan four times, one per mechanism, each with its
  serial suffix. Every initial, date and signature box is empty, including the
  manufacturer's acknowledgment of receipt. That is the 2026-10-11 note's
  finding 8, again.
- **Plans are cloned, inside one job too.** The plan was written for the first
  clarifier and copied for later ones: a 2022 cover page names the sixth unit,
  and every copy's body still names the first. A later revision also drops the
  three named signatories of the pre-commissioning gate down to "signed off".
  That extends the 2026-10-20 note's finding 5 from between jobs to between
  units.
- **Damage before checkout is reported with photos** (coating rubbed off in
  shipping, a broken sight glass with the oil gone), as in the 2026-10-19 note's
  finding 14.

## New: findings with no home yet

### 1. One mechanism, three names

The plant numbers its clarifiers. The manufacturer's serial number carries a
per-mechanism suffix. The person who filed the reports used a third label, and
the three disagree. A report filed as "Clarifier 1" describes clarifier 2 in
its body. Reports filed as "Clarifier 5" inspect a unit the vendor calls by a
different number and suffix. The plan's four checklists carry suffixes A to D,
while the reports use other suffixes on the same base serial.

The serial is the number the manufacturer's warranty is keyed to (finding 2).
This adds a vendor's numbering to ADR 0018 §16 (the asset behind a position
as an appended event) and to the 2026-10-11 note's finding 3 (tags reconciled
by hand). Here the vendor's own documents also disagree with one another.

### 2. The warranty is conditional on returning a checklist

The final mechanical checklist instructs: "the installer/erector must sign and
date this CHECK LIST, and return one copy of this CHECK LIST for each clarifier
mechanism with drive unit furnished to the [manufacturer's] Project Management
Department **to ensure warranty coverage**", with a line for the
manufacturer's representative to acknowledge receipt.

[ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md) records
when a warranty clock starts and on what basis. It does not record a
precondition for the warranty to exist at all. The closest existing shape is a
`closeout_requirements` row (required → received → accepted) per mechanism,
where "received" is the manufacturer's acknowledgment. On this job the
acknowledgment line is blank on all four copies.

### 3. A visit's purpose changes, and one visit serves two

ADR 0017's `purpose` takes one value. On this job:

- two visits were **pre-installation**: checking delivered parts against the
  packing slips and bill of materials. They found hardware never shipped, a
  weir hole pattern that did not match the existing troughs (the engineer would
  not approve modifying the parts, so new ones were ordered) and seam plates of
  the wrong width. None of `installation_verification`, `startup_assistance`,
  `warranty_service` or `training` names receiving, and the 2026-10-19 note's
  finding 6 (devices exist before their tags) is the same window;
- one visit was planned as a checkout and became a parts count (the "Not
  Ready" visit above);
- the last visit was booked as operator training and also verified the
  previous checkout's punch list. Its file name calls it a mechanical checkout.

The file names held the planned purpose and the outcome together. A single
`purpose` holds one of the two.

### 4. Duration tests are observed while they run

[ADR 0012](../adr/0012-open-resolve-duration-tests.md) pairs an opening record
with a resolving one. The plan's tests are watched in between:

- the launder trough hydraulic leak test has a required duration, start and
  end times, an initial-test or retest box, and **up to six timed intermediate
  inspections**, each initialed as "no leakage" or "leakage (describe)", then
  performed-by, contractor-witness and owner-acceptance signatures;
- the dry functional test runs at least four hours with an **hourly** drive
  motor amperage check;
- the seven-day operational test is observed by the contractor "for one hour
  daily".

The open→resolve pair has no place for the readings in between, and the
2026-10-19 note's finding 3 (classifying a duration test's interruptions)
concerns the same span.

### 5. Energizing has a gate on paper, and it is not LoopCheck's to enforce

The electrical subcontractor's pre-energizing checklist (final continuity,
covers in place, conductors made safe, the lockout/tagout system on site,
hazard analysis posted, a power-up meeting for all trades) ends: "It is
mandatory that you contact your Superintendent upon completion of this
checklist prior to proceeding with the Energizing Sequence. This form MUST be
emailed ... prior to energizing." The energizing sequence that follows is an
ordered list: the main device first, then each feeder one at a time,
verifying voltage and rotation at each load end. Every activity on both forms
has **two "checked by" columns**. The torque form has "performed by" and
"verified by".

The shape is [ADR 0019](../adr/0019-shutdown-runbook-execution.md)'s, with
ordered steps and a hold point. The gate is an authorization to energize. Under
the LOTO safety framing in [CLAUDE.md](../../CLAUDE.md), LoopCheck may record
that the checklist was completed and who checked it, but it never says that a
circuit may be energized. A second checker per line is not a witness; the
2026-10-19 note's finding 10 (hold and witness are different obligations) is
the nearest home.

### 6. Witness tiers are chosen per form instance

The subcontractor's forms each carry three signature tiers: its own QC, then
the general contractor "if required" and the owner "if required". Whether
either witness is owed is decided when the form is used, not when it is
designed. LoopCheck freezes `witness_required` from the template (ADR 0002).
The forms also carry their own numbers and revisions, and two are labelled as
attachments to the subcontractor's inspection and test plan. That is a
template provenance LoopCheck does not record.

### 7. Pre-use equipment checklists are outside LoopCheck's subject

The contractor's safety folder holds blank pre-use checklists for construction
equipment: forklift (an item list and a daily form with a Monday-to-weekend
grid and an hour-meter reading), scissor and boom lift, scaffold, crane, a
towable generator, and two bought-in backhoe and loader forms. Their shapes
echo LoopCheck's: four response vocabularies (Y/N/N/A; P/F; S/U/N/A; ✓, R for
replace or repair, and N/A), "no items are to be left blank", a checklist that
"must remain visible on the lift", a work-area section where a ticked box
means a hazard *is* present (the inversion in the 2026-10-20 note's finding 7),
and a generator checklist cloned from the forklift's that still says
"forklift".

The subject is a contractor's machine with a fleet number, not plant
equipment with a P&ID tag, and the record serves site safety, not turnover.
They inform Phase 5's recurrence shapes at most. The equipment ledger they
belong to is another tool's, not LoopCheck's.
