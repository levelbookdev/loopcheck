# Closed-job records: what they show LoopCheck

*Working note, 2026-10-20. Structural findings from a third batch of a general
contractor's records: the closed files of small water and wastewater repair
jobs from 2021 to 2026 (an aeration diffuser replacement in six basins, a
conveyor replacement in a dewatering building), a 2015-16 commissioning plan for
a design-build potable water job with three pump stations and a reservoir, the
contractor's blank 2014 construction quality plan, and a federal job's daily
quality control reports. Descriptive, not normative: it decides nothing and
authorizes no build. Findings that change core go through an ADR, per the
docs-as-code rule in [CLAUDE.md](../../CLAUDE.md).*

Source documents are internal company material and stay out of this repo, as in
[the 2026-10-11 note](2026-10-11-historical-startup-records.md) and
[the 2026-10-19 note](2026-10-19-specification-and-field-forms.md). No project,
owner, company, vendor, or person is identified here. The source review is kept
privately, outside this repo.

---

## Confirmed: already modeled

- **The master test log is the readiness matrix, and the owner's acceptance
  checks the box.** The 2015-16 plan keeps a master equipment test log per
  startup system, one column per test or document "in sequence from left to
  right", and a box is checked "as tests are completed or documents accepted"
  by the owner. Every item "will be signed off individually for each test".
  That is `readiness.html`
  ([ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md) §3). That the
  box waits on the owner's acceptance, not the test, adds to the 2026-10-19
  note's finding 1.
- **The per-station table puts closeout facts in the per-tag matrix.** Each
  station's test documentation table runs one row per tag: electrical acceptance
  testing, calibration, configuration report, loop check, I/O check, functional
  test, **O&M received** and **training completed**, with `NA` where a column
  does not apply. More evidence for the 2026-10-19 note's findings 8 and 11:
  closeout facts sit inside the gate ([ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md),
  [ADR 0009](../adr/0009-per-tag-phase-applicability.md)).
- **The summary commissioning report carries "a history of deficiencies
  identified and their resolution"** beside the test results. The same plan
  confirms the 2026-10-11 note's finding 5.
- **A reliability test restarts on failure.** A continuous 72-hour system
  reliability test must run "without equipment/system failures or nuisance
  equipment shut downs", and is repeated whenever "malfunctions or deficiencies
  cause shutdown or partial operation". That is
  [ADR 0012](../adr/0012-open-resolve-duration-tests.md). "Nuisance" is not
  defined, which is the 2026-10-19 note's finding 3: the restart needs a
  classification and a basis.
- **The duration test is the milestone.** On the conveyor job the end of the
  7-day operational test was substantial completion, the date the closeout and
  acceptance clocks then ran from.
- **The manufacturer's warranty runs from final acceptance, jointly signed.**
  The diffuser warranty excludes labor and liquidated damages and requires
  notice of shipping damage within 14 days. That is the basis provenance of
  [ADR 0005](../adr/0005-warranty-closeout-clock-start-provenance.md).
- **Spare parts leave by custody transfer.** A two-signature spare parts
  transfer form and the owner's own critical-spares transmittal. More evidence
  for [open question 3](../open-questions.md#3-where-does-equipment-preservation-change-ownership).
- **Preliminary O&M data is accepted by submittal status code**, on the owner's
  status codes (accepted, accepted as noted, rejected, returned incomplete,
  revise and resubmit, and an `F` the form leaves undefined). That is the prerequisite the 2026-10-19
  note's finding 8 found ahead of training.

## New: findings with no home yet

### 1. The signed unit can be the equipment's whole I/O list

The plan's I/O checklist is one sheet per pump or per site. Each row gives the
point's name, tag, type (DI, DO, AI, AO or "hard wired") and I/O address, with
a continuity column. Analog rows are checked at 0, 25, 50, 75 and 100%.
Hard-wired rows (overload, high temperature, high pressure, the elapsed time
meter) have no address. **One witness block closes the sheet**, with the
owner's and the contractor's names, signatures and dates.

This confirms the 2026-10-11 note's finding 2 (addressed points, some with no
address). It also adds a third candidate for the signed unit, beside the
2026-10-19 note's finding 4: there the loop was signed, and here the pump's
whole I/O list is, with every point's tag inside it.

### 2. One simulated input, three readings

The operational readiness protocols simulate a 4-20 mA signal at the
transmitter and record the reading **at the transmitter, at the local operator
terminal and at SCADA**, at 0, 25, 50, 75 and 100% (4, 8, 12, 16 and 20 mA),
with a witness and date per row.

This extends the 2026-10-19 note's finding 17 from two measured outputs per
input point to three.
[`calibration_points`](../adr/0016-purpose-built-instrument-calibration-records.md)
holds one measured value per row, and it is a fifth point set.

### 3. A loop's tolerance is computed from its parts

"Specified accuracy tolerances for each analog network are defined as the
root-mean-square-summation of individual component accuracy requirements",
taken from the contract or, failing that, the manufacturer's published
accuracy.

This is a second limit that cannot be written as ADR 0018 §7's fixed
`expected_min` and `expected_max`, beside the 2026-10-19 note's "within 2 ohms
of the cable's average". The limit comes from the accuracies of the loop's
member tags. Either the limit is derived from data held on those tags, or it is
`informational` and computed off the record. Either way it bears on the
2026-10-19 note's finding 4, the loop as the signed unit: the limit belongs to
the loop, and its inputs belong to the tags.

### 4. The contractor's own plan disagrees with itself on a tag

In the reservoir section, the level transmitter is one tag number in the test
documentation table and the readiness protocol, and a different number in the
I/O checklist, for the same tank-level point.

The 2026-10-11 note's finding 3 found tag errors between documents. This one is
inside a single document, in the plan that defines the tests. An import that
cross-checks a plan's tables (ADR 0018 §11) would catch it before a crew scans
a label printed from the wrong one.

### 5. Plans are cloned between jobs, and carry the old job's party

One paragraph of the 2015-16 plan, the reliability test's restart clause, names
the joint venture of **a different job**, from whose plan the section was
copied. The blank 2014 quality plan's manufacturer certificate still carries a
2010 date line. The 2026-10-11 review saw the same habit in a de-named
startup plan.

Templates in LoopCheck are versioned and frozen into checks (ARCHITECTURE §9).
The finding argues for keeping party names out of template text: party names
should be bound per project, as roles already are
([ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md) §9), so that a
template copied to a new project cannot carry the last project's names.

### 6. Two manufacturer certificates, before and after operation

The contractor's forms have two manufacturer certificates per tag:

- a **certificate of proper installation**, keyed by serial and tag number, with six check-applicable statements: installed to the manufacturer's recommendations, inspected and adjusted, lubricated, connections to standard, safety equipment installed, and (only for a complete one-manufacturer system) performance-tested;
- a **certificate of proper operation** after functional testing, recording design against four test points and certifying yes or no that the unit "operates within the allowable limits for vibration", with the controls and the start, stop and interlock logic tested. It is signed by the manufacturer's representative and witnessed by the contractor, the engineer and the owner.

Both are third-party attestations per tag at two phase boundaries.
[ADR 0017](../adr/0017-vendor-field-service-reports.md) holds vendor reports as
evidence. Whether a certificate is a check signed by a vendor role or an
attachment to one is open. The "allowable limits" are defined nowhere in the
plan, so the yes or no carries no basis.

### 7. A yes/no checklist where "no" is sometimes the pass

The diffuser manufacturer's installation audit is one checklist per basin: 53
yes, no or not-applicable questions in six sections (piping, supports, purge,
diffuser installation, startup inspection with the basin flooded, signatures).
For most items **yes** is the good answer. For others ("Are there any leaks?",
"Are there any inactive units?", "Are there signs of wear from a metallic
hammer?") **no** is the good answer. One support-alignment item is answered
"no" with no comment, and the form cannot say whether that is a deficiency or
a slip.

LoopCheck's pass/fail/N/A response type (hard constraint 5) has no polarity
problem. Transcribing or importing a vendor form like this one does: each
item's polarity has to be mapped, and the unmapped "no" is exactly what
M5.1's no-ambiguous-blanks rule exists to stop.

The same audit records the as-left state only. Six diffusers leaked at their
retainer rings and were re-tightened on site, and a sub-header hole was
field-repaired before the leak test. Both are in the comments, while the item
answers record the condition after correction. This is the 2026-10-19 note's
finding 12 again: the as-found is the evidence, and here it survives only as
prose. The subject is a basin, a process unit with a name and no P&ID tag.

### 8. Acceptance by sample, of a population with no tags

The diffuser manufacturer's factory QC sheets test **25 membranes per sheet**:
target and measured air flow, flux rate, dynamic wet pressure and a good/bad
uniformity call. Each sheet ends with average, minimum, maximum, lower and upper
tolerance and **percent compliance**. The basins hold many hundreds of identical
diffusers, none tagged, and the sheets are dated months before installation.

The subject is a production lot, and acceptance is statistical. It is another
subject with no tag, beside the 2026-10-19 note's cable runs (finding 5). It is
also a third kind of limit: a band applied to a sample, reported as a compliance
rate. Typed attached evidence against the system (ADR 0018's report index) is
the nearest home.

### 9. Phased startup: one system at a time, each accepted as a submittal

The six basins were brought into service one by one over a summer. Each basin's
startup testing went to the engineer as **its own numbered submittal** and came
back with a review disposition, and the manufacturer's field service report and
the O&M followed after the last basin.

The phase gate per system is M6.3. That the owner's acceptance of each system's
startup arrives through the submittal channel, with a disposition code, gives
the 2026-10-19 note's finding 1 its concrete form: the acceptance event is a
submittal return.

### 10. A deferred submittal item comes back as a non-compliance

On the conveyor job, the supplier's resubmittal deferred the spiral
certification and the operation manual "under separate cover". A year later the
owner's notice of non-compliance on the delivered conveyor cited rust, missing
shop primer and **the missing factory test data**. The contractor's response
pair (the owner's notice, then the corrective action) went through two
corrective actions: an on-site treatment first, then a return to the factory,
with a third-party weld inspection in between.

Two bearings. The notice happens to the equipment before any checkout, so ADR
0018 §16's `equipment_events` is the nearest home, beside the 2026-10-19 note's
finding 14. And a deferred submittal item is an open obligation that later
blocked acceptance: a `blocks_phase` item
([ADR 0018](../adr/0018-multi-vendor-startup-evidence-model.md) §6) with
nothing to raise it today.

### 11. A nonconformance is resolved by disposition, not by pass

The blank 2014 construction quality plan's nonconformance report closes with a
**disposition**: rework mandatory, or acceptable as is. When rework is
mandatory, inspection of the rework is mandatory too. The report is signed by
the resident engineer, an authorized inspector and the customer, and a running
nonconformance log sits beside it. The same plan keeps an as-built log and a
subcontractor monitoring report.

"Acceptable as is" closes an item without a passing check. A punch item in
LoopCheck closes on evidence
([ADR 0004](../adr/0004-test-equipment-and-punch-evidence-links.md)). An
accepted deviation, signed by the engineer, is a different resolution, and the
record of who accepted it is the evidence. It is the same open→resolve shape as
[ADR 0012](../adr/0012-open-resolve-duration-tests.md), with the resolution
typed.

### 12. Three phases of control, reported daily

A federal job's daily contractor quality control reports record, per definable
feature of work, which of the three phases of control occurred (preparatory,
initial, follow-up), keyed to **schedule activity IDs**. A QC meeting agenda
runs the same list.

The preparatory and initial phases are inspection points before and at the
start of work, the 2026-10-19 note's finding 10 (hold and witness) in a
federal vocabulary. The schedule activity ID is a second key beside the tag. It
is the one that ties a check to the schedule, and LoopCheck has no field for it.

### 13. Who may be the commissioning authority is a contract fact

The same job's quality manager wrote to the owner asking it to accept the
contractor's own commissioning authority, although the request for proposals
had listed qualifying certifications. The letter attached the certification
bodies' rules and a third party's proposal.

The commissioning authority's qualification is a precondition for every
witnessed test it leads. ADR 0018 §9's roles say who signs, but nothing records
that the person in a role was accepted for it.
