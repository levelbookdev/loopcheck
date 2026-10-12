# Historical startup and commissioning records: what they show LoopCheck

*Working note, 2026-10-11. Structural findings from a review of a general
contractor's past startup and commissioning records: about ten water and
wastewater jobs, from a single-unit equipment replacement to a multi-year
treatment plant startup. Descriptive, not normative: it decides nothing and
authorizes no build. Findings that change core go through an ADR, per the
docs-as-code rule in [CLAUDE.md](../../CLAUDE.md).*

Source documents are internal company material and stay out of this repo, as in
[DATA_MODEL_PLAN.md](../DATA_MODEL_PLAN.md) Rev 1 and
[ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md). No project,
owner, company, vendor, or person is identified here. The source review is kept
privately, outside this repo.

---

## Confirmed: already modeled

These records add weight to decisions already made. None needs new work.

- **The per-tag × phase matrix is the integrating document.** Contractors keep
  an equipment testing and documentation log (spec, area, P&ID, type, tag, then
  one column each for calibration, loop check, mechanical alignment,
  installation check, functional test and certificate, with `NR` for not
  required). That is `readiness.html`
  ([ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md) §3) and `tags.phases_na` ([ADR 0009](../adr/0009-per-tag-phase-applicability.md)).
  The paper version has no dates and no sign-off columns.
- **The per-equipment binder** (test log, drawings, a per-tag package from
  initial checkout through functional test and certificate, functional tests by
  type, loop status reports, calibration reports) matches the turnover compiler
  output already confirmed in DATA_MODEL_PLAN Rev 1.
- **Signature blocks name integrator, contractor and owner separately**, for the
  unwitnessed and the witnessed pass. That is ADR 0018 §9's roles as template
  data.
- **Punch items carry a ball-in-court and a gate** ("required for startup",
  "required for the 10-day test"). That is ADR 0018 §6 (`assigned_party`,
  `blocks_phase`).
- **Vendor commissioning certificates fix warranty start.** One read "for the
  purposes of the warranty, the commissioning date shall be the date noted
  herein", signed by the contractor's startup manager; owner acceptance had
  still not happened more than a year and a half later. That is exactly the
  basis provenance
  [ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md) records.
- **Stored-equipment maintenance** (oil, rust, condensate, lubrication, rotate
  the shaft, cover) appears as a contractor QC blank, matching
  [ADR 0015](../adr/0015-stored-equipment-preservation-log.md). A spare-parts
  storage record signed over to the owner is evidence for
  [open question 3](../open-questions.md#3-where-does-equipment-preservation-change-ownership)
  (who owns preservation once custody changes).
- **A failed operational acceptance is a real event, on the critical path.**
  The same pump station's first startup attempt failed in a day. A field
  directive reconfiguring telemetry, an RFI and PLC rewiring followed, then a
  second attempt and the 10-day operational test. The ledger already holds this
  shape: the failed check stays, the retest is a new record, and any pass
  satisfies the phase.

## New: findings with no home yet

### 1. Two passes per point, and the owner enforces the order

A loop status report lists every I/O point (loop tag, ISA tag, equipment tag,
I/O type, I/O address) across nine stages: electrical installation; motors and
pumps; calibration; field wiring; panel wiring; local operation; I/O checkout to
the PLC; I/O checkout to the HMI; analog loop check at 0/25/50/75/100%. **Each
stage takes two sets of initials, unwitnessed and witnessed**, and the header
takes a sign-off for each pass. A cut-down variant for vendor-furnished panels
keeps six stages and adds a vendor column.

The owner on that job read the specification's two-part rule (unwitnessed, then
witnessed) as covering functional tests too, after its witnesses found
themselves watching troubleshooting. Its letter required witness requests **14
days ahead, with the unwitnessed results attached** and procedures with
setpoints, and reserved the right to fail a test and back-charge standby time.
The contractor complied at first; file dates suggest the median lead time across
92 later notices was about six days, with roughly a quarter meeting 14
(inferred from file dates, not send dates).

What LoopCheck cannot say today: that a witnessed check had an unwitnessed
predecessor, and how far ahead the witness was notified. Both are facts about
existing records, so a design would derive them rather than store them (hard
constraint 4). ADR 0012's linked pair and ADR 0018 §10's continuation chains
are the nearest existing patterns.

### 2. I/O points are addressed, and some have no tag

I/O checkoffs are keyed by **bus, drop, rack, slot and point** (or rack, slot
and channel), with the PLC point name, field terminals, and panel IP addresses
in the header. Spare points appear as rows with no equipment tag, and a
remaining-loops list carries "soft I/O" points with no physical address.

The tag reference block (G10 in DATA_MODEL_PLAN) carries `plc` but no I/O
address, and a spare point has no P&ID tag to hang a QR code on (hard
constraint 6). Open: whether an I/O point is a tag, a child of a tag, or
outside LoopCheck's subject model.

### 3. Tag reconciliation is done by hand

One workbook joined an I/O list (4,233 rows at its final revision) against the
instrument and valve schedules and found **119 I/O tags missing from the valve
schedule**. Elsewhere a functional test's filename named a different tag from
the form inside it, and tag typos carried from the I/O list into the checkoff.
This is field evidence for ADR 0018 §11 (tag validation now). A CSV import that
reports tags present in one list and absent from another would have done this
job.

### 4. The test medium drives the schedule

One pump station's baseline schedule allowed **23 working days** from loop
checks to operational acceptance: 13 for loop checks, 10 for training, startup
and operational acceptance. The actual window, from the first loop check to
startup complete, ran about **103 working days** (148 calendar) after the owner
moved loop checks **from simulated to actual water recirculation**. The
contract had no control narrative, and the owner's narrative arrived after the
first plan was submitted.

*Corrected 2026-10-12.* This paragraph first said 28 days became 136. Those are
a later schedule narrative's figures, which count loop checks at 18 days; the
numbers above are read from the baseline and update schedules themselves.

Other records make the same point. An owner's startup considerations tabulate
the test medium (water, air, sludge) per equipment and phase, require an 8-hour
continuous operational test that restarts the next calendar day after a
failure, and treat a supporting-system failure as a pause rather than a
restart. Integrator checklists run in two stages: point validation and
simulation in the PLC, then the same points with water. A startup alignment
meeting split each pump into field verification (part A) and controls
verification (part B).

Whether a check ran simulated or live is evidence a dispute turns on, and the
ledger records it only as free text today. If it ever becomes a field, it is
template data, not a fifth response type (hard constraint 5).

### 5. The integrating report joins checkout and closeout

A contractor-written summary commissioning report carries a per-tag matrix of
NETA testing, calibration, configuration report, loop check, I/O check,
operational testing, **O&M received and training completed**, plus a dated
history of deficiencies and how each was resolved. Closeout facts
(`closeout_requirements`, [ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md))
and checkout standing sit in one matrix in the deliverable an owner keeps. The
turnover compiler should expect to join them.

A separate turnover tracker keys O&M manuals, training, warranties,
certificates and spare parts **by specification section** with submittal
numbers, and the O&M table of contents was negotiated volume by volume with the
owner's comments.

### 6. Punch lists carry two parties' views

A shared owner and contractor punch list (472 items) gives each item an owner
priority, an owner status, a contractor status and step, a ball-in-court, and a
timing gate: before startup of each process, before occupancy, before the
15-day test, before final. Its pivot views are open, **buy-off needed**, and
**disputed**; 33 items carried both sides' notes.

ADR 0018 §6 covers the party and the gate. Not covered: an owner view of an
item that disagrees with the contractor's, and "buy-off needed" as a state.
Under hard constraint 4 both would be derived from appended events, never
stored as status fields.

### 7. The owner's issues log, and how it decays

An owner-supplied issues log (item, area, equipment tag, submittal reference,
issue, resolution, ball-in-court, author, status, severity 1 to 4, date
reported, date completed, days out) ran to 1,231 items over 28 months, with a
median of 29 days to close and the ball mostly with the general contractor and
the electrical subcontractor.

Its defects are the ones derived status prevents: days out with the sign
reversed, severity written two ways for the same level, status typed into the
author column. Its 1-to-4 severity does not map onto A/B/C. An import or export
of an owner's log needs an explicit mapping, not an assumed one.

### 8. Sign-off columns exist; executed sign-offs do not

The same pump station's startup plan took seven submissions over eleven months
before it was accepted as noted, and its demonstration sheet grew from 318 test
rows to 476; one reviewer log alone held 51 comments. The as-built draft gives
every row manufacturer, owner and contractor sign-off and date columns. **Every
one is empty.** The executed proof is scanned vendor field reports and two
signed installation certificates, none of it tied to a row.

So the plan is negotiated in detail and executed with no row-level record.
Recorded attestations bound to a check ([ADR 0010](../adr/0010-signatures-and-turnover-package.md))
with the roles named as template data (ADR 0018 §9) are the piece that fills
this gap; the plan's row count says how many checks a job like this needs.

### 9. The approved submittal is not the installed configuration

On that job the approved pump submittal had the wrong cable count, found only
when the cables were pulled; the RFI took about six months to resolve. Cable
supports, guide-rail brackets and identification markings followed the same
pattern, two to six months each.

An installation check that passes against the approved submittal can still be
wrong. Whether a check records which submittal revision it verified against,
and how a mismatch is raised, has no home yet; under hard constraint 4 a
mismatch would be an appended finding, never an edit to the check.
