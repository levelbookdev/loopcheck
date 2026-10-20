# A current specification and more field forms: what they show LoopCheck

*Working note, 2026-10-19. Structural findings from a second batch of a general
contractor's records: a current process-control and startup specification for a
large water treatment facility, an integrator's loop-check and electrical
acceptance forms from a current job's quality plan, and startup, punch, RFI and
training records from small water and wastewater jobs between 2007 and 2009,
the contractor's 2017 house log templates, and a large contractor's quality
program (inspection and test plan, completion, calibration and receiving
procedures and forms), and the test forms attached to a public owner's 2012
bid set. Descriptive, not normative: it decides nothing and authorizes no build. Findings
that change core go through an ADR, per the docs-as-code rule in
[CLAUDE.md](../../CLAUDE.md).*

Source documents are internal company material and stay out of this repo, as in
[the 2026-10-11 note](2026-10-11-historical-startup-records.md). No project,
owner, company, vendor, or person is identified here. The source review is kept
privately, outside this repo.

One lead turned out to be material already reviewed: a 2007 job's startup-plan
folder is a copy of the same forms library the July reviews covered. Only what
is new against that and the 2026-10-11 note is recorded.

---

## Confirmed: already modeled

- **The specification prescribes the ledger.** The contractor keeps "master
  logbooks for each phase of installation, startup and testing". Each entry
  carries the signal, loop or control-strategy tag, equipment identification,
  description, sign-off dates, and contractor and engineer signatures. That is
  the per-tag × phase record with roles as template data
  ([ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md) §9, M6.3).
- **The warranty start moves with the operational test.** "If equipment and
  material does not perform satisfactorily during the 30-day operational
  period, then the warranty period start shall be delayed." Direct evidence for
  the basis provenance of
  [ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md).
- **Submittal review is tag by tag against the specification's instrument
  list**, with action codes and per-tag comments on part numbers, ranges and
  accessories. Confirms the 2026-10-11 note's finding 9, and makes the
  specification's instrument list a real import source for per-tag range, a
  partial answer to which instrument-index formats must be importable.
- **A small plant's startup plan** is organized by system, prints specified
  values beside blank observed values with specification citations, and
  schedules its "7-day" full-system test as five working days. Confirms M5.2
  and `spec_reference`, and is a reminder that a duration test's elapsed time
  comes from its own timestamps, never a scheduled duration.

## New: findings with no home yet

### 1. The phase gate is the engineer's acceptance of the paperwork

Each phase must be "fully and successfully completed and all associated
documentation submitted and approved prior to the next phase", unless the
engineer grants a written exception in advance. The engineer approves the test
forms before a phase starts, and gives written notice of acceptability within
10 days of receiving results.

LoopCheck gates a phase on its checks passing (M6.3). It has no appended event
for the engineer accepting a phase's documentation, which is what actually opens
the next phase here, and no record of the 10-day clock. The shape is ADR 0012's
open→resolve pair: submission opens, acceptance resolves. Under hard constraint
4 the gate would be derived from those events, never stored.

### 2. Witnesses can test outside the forms, and readiness costs money

The specification reserves the owner and engineer "unstructured testing" time in
each witnessed period, to test "previously undefined normal and abnormal
aspects" with scenarios that "may not be available prior to the testing period".
The contractor documents them. It also requires 21 days' notice of any system
test, and back-charges the engineer's labor and travel and the owner's travel
when they arrive for a witnessed test the contractor is not ready for.

The first is witnessed evidence with no template. Every LoopCheck check runs
against a template (hard constraint 5), so there is no home for it. The second
makes the record of when readiness was declared, and whether the witness
agreed, worth money; it adds to the 2026-10-11 note's finding 1 (14 days there,
21 here).

### 3. A duration test's interruptions need a classification

A 30-day availability test requires 99.8% and defines what counts as downtime:
backed-up network devices are excused for up to a day, a non-redundant
controller counts after an hour, field sensors are excused while the system
keeps operating as specified, peripherals have repair windows of 8 hours to 3
days, each software-caused erroneous command is charged an hour, and **the same
component failing twice is a system failure**. Any qualifying failure restarts
the 30 days. A 100-hour factory test restarts on any component failure.

[ADR 0012](../adr/0012-open-resolve-duration-tests.md) handles the reset. What
it cannot show is why an interruption did or did not reset the clock. The rules
are specification-specific, so each interruption needs a classification and its
basis as appended data, or a disputed restart cannot be proved.

### 4. The loop is the signed unit, and its tags have roles

A current integrator's loop-check sheet is one per **loop number**, with four
blocks: transmitter, receiver, final control element and controller. Each block
has its own tag, make and model, serial, range, continuity and leak checks, and
calibration at 0/25/50/75/100%. The final control element adds positioner
action, normally open or closed, air-to-open or air-to-close, and **position on
loss of air and on loss of power**; the controller adds proportional band, reset
and derivative. One "loop check complete" certification closes the sheet. A
2007 sheet from a different integrator is also per loop, calibrated at
10/50/90% of span, with one technician signature and no witness.

This bears on the open question of whether the loop or the instrument is the
primary unit: on paper, the loop is what gets signed, and its tags play roles.
`tags.loop_numbers` ([ADR 0002](../adr/0002-capture-side-fields-before-crews-log.md))
can group tags but cannot sign a loop or give a tag a role. M6.1 and ADR 0018 §8
already cover fail position and tuning. Calibration point sets vary by form, so
`calibration_points`
([ADR 0016](../adr/0016-purpose-built-instrument-calibration-records.md)) must
not assume five points.

### 5. Electrical acceptance is keyed by circuit

The same quality plan's control-wire, twisted-shielded-pair and insulation
resistance reports, and a 2007 testing firm's insulation and ground-fault
reports, run one row per circuit: origination, destination, wire size and count,
readings conductor-to-conductor and to ground, test voltage and duration, with
the instrument, temperature, humidity, tester and witness in the header. The
cable forms carry a **"ready to terminate"** or "date terminated" column, so the
insulation test gates termination. A torque log runs by equipment number and
location, with performer and witness.

The subject is a cable run between two tagged endpoints, and a job has hundreds.
It has no P&ID tag and nothing to hang a QR code on (hard constraint 6). Either
these come in as typed attached evidence linked to the end tags (ADR 0018's
report index), or cable acceptance is declared out of scope. Test temperature
and humidity belong with the test-equipment record of
[ADR 0004](../adr/0004-test-equipment-and-punch-evidence-links.md).

### 6. Devices exist before their tags

On one small chemical-system job, 4 of 23 RFIs were about instrument tags. A
level switch on the P&ID had **no tag number** and no wiring destination.
Pressure indicators on the P&ID were missing from the specification's
instrument schedule, which listed different numbers for what looked like the
same service. The electrical subcontractor raised each one first, and the
general contractor re-issued them.

This adds a P&ID-against-schedule case to the 2026-10-11 note's finding 3 and
ADR 0018 §11. It also shows a device installed before it has a tag: LoopCheck
would need a provisional, location-named tag that a later appended event renames
or links to the assigned one.

### 7. Permanent identification and decommissioning come at punch

Two small-plant punch lists, one grouped by responsible party and closed by date
and initials, both end with permanent identification still owed: equipment tags
for new valves and flow meters, instrument tags and nameplates to the
specification, pump labels, conduit and pull-box labels. On a rehabilitation
job the electrical subcontractor also owed **a written list verifying all
equipment decommissioned**, with labels on major items and on abandoned pipe.

Two gaps. There is no seed item for "permanent identification installed per
specification", although the QR tag often goes on before the permanent plate.
And a tag's life on rehabilitation work can end in decommissioning, which the
owner wants verified and listed; ADR 0018 §16's `equipment_events` is the
natural home for a `decommissioned` event.

### 8. Training is one session over many tags

A 2007 training record is one sheet for a whole pump station: two pumps and five
instruments of five types. It quotes three specification paragraphs with their
own session counts, hours, audiences and attendance rules, and is signed by the
manufacturer's representative, the contractor and the engineer. The current
specification starts training only after acceptable **preliminary O&M data**
and completed checkout and startup, with schedules 30 and 7 days ahead and
separate operations and maintenance curricula. An older one puts the 7-day
operational test after training.

[ADR 0013](../adr/0013-training-as-a-signable-milestone.md)'s per-tag training
milestone does not fit a multi-subject session whose facts are audience,
sessions and hours. The prerequisite mixes a closeout fact
([ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md)) with a
phase; M6.3 can express the phase half, and whether it can see a closeout fact
is open.

### 9. A generic checklist applied where it does not fit

The 2007 job's generic six-item construction-phase inspection is printed for a
level sensor, including "operates within allowable limits for vibration", with
no not-applicable column. More evidence for M5.1's no-ambiguous-blanks rule.

A single instrument pressure-test record lists every instrument tag the test
covered under one medium and pressure, signed by the reporter only: one event,
many tags, the same shape as finding 8.

## From a large contractor's quality program

### 10. Hold and witness are different obligations, and each party has its own

The quality program writes its inspection and test plan as one row per
inspection (specification section and paragraph, inspection or test, frequency,
acceptance criteria, required records) with **a separate code column for each
party**: the contractor's QC, its QA, the engineer or third party, and the city
inspector. Six codes: approval before work, continuous, **hold** ("advance
notification and signature acceptance is required prior to continuing work"),
periodic, record review, and **witness** (required to be present).

A hold stops the work until someone signs; a witness only has to be there.
`witness_required` ([ADR 0002](../adr/0002-capture-side-fields-before-crews-log.md))
is one flag per template and cannot tell the two apart, or say whose point it
is. Roles are already template data (ADR 0018 §9), so the plan suggests a point
type per party role, with "held, awaiting acceptance" derived from the record
under hard constraint 4.

### 11. Mechanical completion ends in a custody transfer

The completion procedure hands care, custody and control of a system, or a
single component, to the owner in three steps. The project engineer completes a
13-item checklist against a written system boundary (weld, bolt, calibration,
test and electrical records, equipment settings, O&M manuals, redline
as-builts, survey, punch list and walkdown, each with a date and a responsible
party); the quality manager reviews it; the construction manager concurs; and a
notice of completion goes to the owner for approval and acceptance.

It extends finding 1. M6.3's system-subject gate fits the checklist itself. Not
covered: the review, concurrence and acceptance chain; closeout deliverables
([ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md)) sitting
inside a completion gate; and the end state, which is a transfer of custody
rather than a pass, the same hand-off as the spare-parts custody point in the
2026-10-11 note.

### 12. Calibration: as-found is the evidence, and some classes owe none

The instrument calibration and checkout procedure:

- inspects each instrument on receipt against the instrument index and data
  sheet (model, tag, range, signal, wetted materials, connection, damage,
  accessories, listing label);
- bench-checks it at 0, 50 and 100% before installation, and **forbids
  adjusting a device unless it is out of tolerance**;
- requires test equipment no worse than a quarter of the instrument's reference
  inaccuracy, with a traceable calibration under a year old;
- sends an instrument back to the shop when its field error exceeds its
  reference inaccuracy plus the test equipment's;
- loop-checks at 0, 50 and 100% simulation with the control system as the
  primary checking instrument, and leaves controllers at estimated start-up
  tuning;
- **exempts whole device classes from field calibration**: factory-calibrated
  flow meters, pressure gauges checked at zero only, level switches actuated
  but not calibrated, relief valves tagged and sealed.

Three bearings. The as-found reading is the evidence and an adjustment is a
separate event, which matters to
[ADR 0016](../adr/0016-purpose-built-instrument-calibration-records.md). A
class that owes no field calibration is phase non-applicability with a stated
reason ([ADR 0009](../adr/0009-per-tag-phase-applicability.md)), not a blank.
And the quarter-ratio rule is a property of the test equipment record
([ADR 0004](../adr/0004-test-equipment-and-punch-evidence-links.md)). This is a
third point set beside finding 4's five and three.

The same program's calibration procedure requires that work accepted with an
instrument later found out of calibration be reviewed under a nonconformance.
Freezing the test equipment's sticker due date onto each check (ADR 0004) is
what lets that review find every affected check.

### 13. Calibration records come in three shapes

An analog instrument records specified against actual input and output. A
switch records up to four set and reset pairs against specification: setpoint
and deadband, not a point table. A control valve records fail position, bench
set, travel, and input, output, positioner and stem travel at 0, 50 and 100%,
plus **the tags of its own open and closed limit switches**. Each names its test
equipment by model and serial; none has a witness line.

The switch shape is one ADR 0016 should expect. The valve's limit switches are
child tags under the valve's tag, which bears on finding 6.

### 14. Damage before checkout, classified for the claim

An instrument damage report records, per tag, whether the damage was obvious on
delivery, concealed until unpacking, from the factory or from field handling;
whether it can be repaired; and whether the manufacturer's guarantee applies,
with the carrier's signed freight bill and photos attached. Which of the four it
was decides who pays. It happens to the tag before any checkout does; ADR 0018
§16's `equipment_events` is the nearest home.

### 15. The house tag register carries reconciliation status

The contractor's 2017 equipment-log template is a tag register (area, P&ID,
tag, equipment, drawings, location, vendor, specification section, pad
required, dimensions verified) whose legend marks rows "information missing"
or "conflicting, to be confirmed". Reconciling the tag list is a standing
column in the house form: more evidence for import validation that reports
those states (ADR 0018 §11, finding 6).

### 16. A pressure test has a readiness walkdown and a release

The program's piping pressure test report, keyed by P&ID and line isometric,
opens with a pre-test release walkdown of about twenty satisfactory /
unsatisfactory / not-applicable items: blinds and relief valves, restrained
expansion joints, a calibrated gauge whose range falls between 1.5 and 4 times
the test pressure, welding and inspection complete, and **any open
nonconformance or RFI inside the test boundary closed**. The test records gauge
number and calibration date, ambient and medium temperature, and start and
finish times; three parties sign acceptance; and the system is then released,
with dates, for painting, heat trace and insulation.

The readiness gate is M6.3's prerequisite shape at the scale of one test, with
open punch inside a boundary as a blocking fact, and the release to other
trades is the event that follows acceptance.

## From an owner's bid set

### 17. The owner's own forms: the cable test belongs to the loop

A public owner's 2012 bid set for a treatment-plant repair attaches the two test forms
the contractor must use. Both are headed by **loop number**, and both end in the
same two-line witness block: the owner's representative and the contractor's
representative, each with a date.

The signal cable continuity and insulation test lists every conductor and shield
in the loop by pair or triad, records continuity between conductors and
insulation resistance of each to ground, and fails a conductor that reads more
than **2 ohms away from the average of its own cable**. A failure must be
corrected "before continuing with the loop test". The form states no test
voltage and no insulation minimum.

The transmitter calibration test, one block per transmitter, records loop,
equipment number, serial, make and model, service, range and indicator scale,
then for each input point at **0, 10, 50, 90 and 100%** of range: expected and
actual output in mA with percent deviation, and **expected and actual indicator
reading** with its own percent deviation. The allowed deviation is a blank per
transmitter. There is one reading per point, with no as-found and as-left pair.

Four bearings:

- **Finding 5's cable problem has an answer for signal wiring.** The owner keys
  the cable test to the loop, which has a tag and a QR code, and makes it a
  prerequisite of the loop check: an M6.3 prerequisite inside one loop. Power
  and control circuits are still keyed by circuit.
- **An acceptance limit can depend on sibling readings.** "Within 2 ohms of the
  cable's average" cannot be written as the fixed `expected_min` and
  `expected_max` of [ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md)
  §7. Either the comparison is derived over a group of lines, or the line is
  `informational` and the judgment is the tester's.
- **One input point, two measured outputs.** The transmitter's output and the
  indicator's reading share an input, which is a loop check and a calibration
  on one row. `calibration_points`
  ([ADR 0016](../adr/0016-purpose-built-instrument-calibration-records.md))
  holds one measured value per row. This is also a fourth point set, beside
  finding 4's five and three and finding 12's three.
- **The witness comes with the owner's form.** The contractor and integrator
  forms in findings 4 and 13 have one technician signature or none; the owner's
  forms have two dated signatures. Who must sign is a property of the template
  the owner prescribes, which is ADR 0018 §9's roles as template data.
