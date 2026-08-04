# ADR 0018 — Multi-vendor startup: staged checkout, explicit resolution, and vendor evidence as the GC's master ledger

**Status:** proposed · **Date:** 2026-08-04
**Design capture only — no migration, no UI in this ADR.** It fixes the shapes
so the post-1.0 milestones M4–M6 ([ROADMAP.md](../ROADMAP.md)) inherit one
model instead of ten independent ones, and so a future agent does not
improvise a stored-status or forms-designer answer to any of them.

Source: field observations from a multi-vendor plant startup, taken from a
review of a full compiled vendor startup report package (equipment vendor
forms, field service reports, I/O check reports, clean water test checklists).
No project, company, vendor, or person is identified anywhere in this record.

**Provenance — read this before trusting the Context section.** This ADR was
written from a **summary** of those observations. The source package was read
directly afterwards, on 2026-08-04, and the reading is recorded in
[`0018-review-notes.md`](0018-review-notes.md). Every observation was confirmed;
comments **R2, R6, R7, R8 are folded in below**, **R1 reversed a recommendation**
in this ADR's open questions, and **R3–R5 remain open** for the maintainer. The
Context section below is left as originally written rather than retrofitted —
what the ADR knew when, and from what, is itself part of the record.

## Context

LoopCheck's engine was designed against a single-party mental model: a crew
runs a checklist against a tag, the record is signed and frozen, standing is
derived. A real multi-vendor plant startup breaks that model in ten specific,
observable ways — and every one of them shows up as *ambiguous evidence years
later*, which is precisely what the append-only ledger exists to prevent.

What the compiled package actually looked like:

1. **The vendors never used a shared system.** Every equipment vendor arrived
   with its own paper or PDF form, filled it out, and left. The GC's ledger has
   no representation of that work beyond a filename.
2. **The same tag was touched in five different phases with different scope** —
   dry checks, I/O checks, clean water / wet-mech, seeding, performance —
   and the compiled package interleaved them with no per-tag-per-phase view.
   "Pump will be checked during clean water with vendor rep on site" was a
   recurring, load-bearing annotation with no place to live.
3. **Blank checkboxes everywhere.** A blank is unreadable evidence: it could
   mean pass-and-forgot, not-applicable, not-performed, or deferred. On paper
   there is no way to tell, and no way to ask two years later.
4. **Punch items had no ball-in-court.** Coordination happened in email because
   the list itself could not say who owed what, which phase an item blocked, or
   that an item was in nobody's scope at all.
5. **Measured values lived as prose.** Megger readings, per-leg voltage, amp
   draw against nameplate — recorded as numbers on a form with the acceptance
   limit stated somewhere else, or nowhere.
6. **Instrument configuration died inside vendor PDFs.** The 4–20 mA span, the
   transmitter range, the delay, the logging interval — configured at startup,
   captured in a vendor's report, and unrecoverable by the time the instrument
   is replaced.
7. **One tag number appeared for two different valves** in a vendor report.
   On paper this is undetectable. Equipment also got pulled, rebuilt, and
   reinstalled mid-startup, and nothing prompted re-verification.
8. **The contractor countersignature block was blank on every vendor form**,
   and a "customer" signature line was signed by the wrong party. Nothing
   listed the missing countersignatures before the package was compiled.
9. **Phase entry had informal prerequisites** — a clean-water pre-run checklist
   (tanks cleaned, floats set, permeate recycle loop configured) that gated a
   whole phase but existed only as a conversation.
10. **Visits ended incomplete.** "Need to finish startup on mixer and pumps:
    amp reading, auto/manual, performance test, FLS testing" is a real
    end-of-visit state, and the follow-up visit had no structural link back.

These are not ten features. They are one theme: **the ledger must be able to
say exactly what happened, who owed it, and what it did not cover** — and it
currently cannot say several of those things without the reader guessing.

The constraints that shape every answer below: append-only records (#2),
derived-never-stored status (#4), no forms designer / exactly four response
types (#5), and a no-install field tier (#1). Several requirements press
directly on those walls; each is resolved *within* the wall or explicitly
flagged, never silently around it.

## Decision

### 1. Phases stay one global vocabulary; per-project configuration is the template library

The observation asks for phases "configurable per project." LoopCheck already
answers that question a different way, and the existing answer is better: **a
subject's required phases are derived from which templates exist for its type**
(ARCHITECTURE §9), minus `tags.phases_na` (ADR 0009). A project configures its
phases by configuring its template library — no stored map, nothing to drift.

So: **no per-project `phases` collection.** Instead the shared phase enum gains
the process-plant stages the observations name and the current six do not
cover, additively, in the established pattern (an enum-opening migration, then
a seed loader):

- `wet_commissioning` — clean water / wet-mech runs.
- `process_seeding` — biological or process seeding runs.

The observed "dry checks" and "I/O checks" already map onto `installation` +
`energization` and `point_to_point` + `loop_check`; adding synonyms for them
would fork the vocabulary for no gain. A project that runs no seeding simply
authors no seeding template, and no tag derives the phase as required.

**Consequence to accept:** the vocabulary is global, so a project sees phase
names it does not use in shared pickers. That is the same trade the service
phases already made (ADR 0006) and is cheaper than a per-project map.

### 2. "Deferred to phase X" is an appended fact, not a status

A deferral is a decision someone made, at a time, for a reason — exactly the
kind of thing this ledger exists to hold. It is **not** a status field on a
tag.

- `checks.result` gains **`deferred`**. A deferral is an ordinary append-only
  check: signed, timestamped, attributable, with its lines recorded.
- `checks.deferred_to_phase` (select over the phase enum, nullable) names where
  the scope went. `checks.notes` carries the why ("vendor rep on site during
  clean water").
- The standing fold gains one state, following the ADR 0012 precedent that
  added `running`:

  > any pass wins → else any fail → else any unresolved `pending` = *running*
  > → else any `deferred` whose target phase has no later record = *deferred*
  > → else any record = incomplete → else not started

  A deferred phase is honestly neither passed, failed, nor untouched, and it
  must not read as red on the readiness matrix — the same false-red problem
  ADR 0009 solved for inapplicable phases, one step further.

**Deferral is not `phases_na`.** `phases_na` means the phase never applied to
this tag. `deferred` means it applies, it is owed, and it moved. Conflating
them would let owed scope disappear.

### 3. Per-tag-per-phase is a rollup, not a new record shape

`checks.phase` already makes every check per-tag-per-phase. The rollup view the
observation asks for is **`readiness.html`**, which already renders tag × phase
with completion dates. This ADR does not add a second matrix; it extends the
existing one with the `deferred` cell state, the vendor-evidence indicator
(§5), and per-cell drill-down to the phase's checks. Building a parallel
rollup would duplicate a shipped page.

### 4. Every line resolves explicitly — but the gate is at signature, not at capture

Today `check.html` writes every line, answered or not, and an unanswered line
lands with a blank `result` (ARCHITECTURE §6). That was a deliberate choice: a
crew pulled off mid-checklist should still leave a record. It is also exactly
the ambiguous blank the observations condemn. Both are true, so the resolution
is to separate the two moments:

- **`check_items.result` gains `not_performed` and `deferred`**, joining
  `pass` / `fail` / `na`. A blank is no longer a legitimate final state — it is
  an unfinished one.
- **`check_items.na_reason`** (text) is **required when `result = "na"`**,
  server-enforced by the `check_items` createRule. "N/A" with no reason is the
  second most ambiguous mark on a paper form.
- **`incomplete` survives, and keeps its meaning** at the check level: a run
  that was started and abandoned. Capture is never blocked — hard constraint #1
  means a laborer on a dead-zone phone must always be able to submit what they
  have.
- **The gate lands where ambiguity becomes permanent:** a check may not be
  **signed** (ADR 0010 `signatures`), and a scope may not be **frozen** into a
  `turnover_packages` snapshot, while any included `check_item` carries a blank
  result. The build route rejects the freeze and names the offending
  check/line; the sign page refuses and links to the correction check.

This keeps the field tier permissive and makes the *deliverable* strict, which
is where the evidence value actually is.

### 5. Vendor evidence extends `service_visits` — the GC's ledger indexes the vendor's paper

Vendor techs will never use this app. That is a permanent premise, not a
adoption problem to solve. LoopCheck's role is to be the GC's master ledger
that *points at* the vendor's own record and captures the handful of structured
facts a dispute turns on.

`service_visits` (ADR 0017) is already exactly this collection — append-only,
tag XOR system, vendor company, rep name, purpose, summary, report via
polymorphic `attachments`, idempotent `client_token`. It gains, additively:

| Field | Type | Why |
|---|---|---|
| `time_on_site` / `time_off_site` | text (HH:MM) | Backcharge and schedule disputes turn on hours on site; the vendor's own form records them. |
| `date_end` | date, nullable | Multi-day visits; `date` becomes the start. |
| `result` | select: `complete` / `incomplete` / `deferred` / `informational` | The visit's own outcome, distinct from any check it produced. |
| `open_items` | text | The verbatim end-of-visit open list ("amp reading, auto/manual, performance test, FLS testing") — the seed for the continuation record in §10. |
| `summary` | text (exists) | The vendor's own narrative, **verbatim** (R6). |
| `phase` | select (phase enum), nullable | Which startup phase the visit served, so the rollup can show it in the right column. |
| `check` | relation → checks, nullable | Optional link when the GC logged a LoopCheck check covering the same work. |
| `continues` | relation → service_visits, nullable | The follow-up visit chain (§10). |

**Validation:** `result` is required and is **always entered explicitly by the
person logging the visit** — never derived, defaulted, or inferred from
`summary`/`open_items` text, by the UI or by any future import path (**R7**: a
real service order in the source simultaneously checks "equipment not released
for use" and states in prose that the unit is ready for normal operation; no
parser and no person should be resolving that at import time). `time_off_site`
without `time_on_site` is rejected. The existing tag-XOR-system + same-project
createRule is unchanged. The attached report stays non-constitutive (ADR 0017
§2) and a visit with no attachment stays loudly flagged — a vendor visit with no
report is an evidence gap, and the UI must nag rather than imply the PDF exists.

**The narrative is evidence** (**R6**). `summary` holds the vendor's own words
**verbatim, never paraphrased or summarized on entry**, and surfaces on the tag
page rather than only in the project ledger. In the source package the single
most dispute-relevant text is five paragraphs of a vendor's technical dissent
about another trade's wiring — neither a check result nor a punch item, and
worthless the moment someone condenses it. It enters the turnover manifest as
frozen text.

**Turnover:** the frozen manifest gains a **vendor report index, keyed by
tag** — for every tag in scope, every `service_visits` record with its vendor
company, rep, dates, hours, result, open items, verbatim narrative, and the
attachment digest of the report file. This is the single highest-value addition
to the package: it is the table that says "here is every vendor who touched this
tag, and here is their signed paper." The index carries each visit's date
**relative to the phase it evidences** and flags a visit materially older than
that phase (**R8**: the source package compiles one inspection report dated more
than two years before the rest of the set, presented as though contemporaneous).
A warning, not a rejection — an old report may be perfectly valid, and the
reader decides.

**This unparks the ADR 0017 UI** (DECISIONS D7), which was parked pending "a
real job requests it." These observations are that request.

### 6. Punch items gain ball-in-court, phase gating, and scope-gap — and checks gain as-left condition

`punch_items.assigned_party` exists but its vocabulary
(`contractor`/`vendor`/`owner`/`engineer`) collapses the parties a real
coordination meeting distinguishes. It becomes:

`gc` · `subcontractor` · `vendor` · `controls_integrator` · `electrical` ·
`owner` · `engineer` · `unassigned`

**This is a breaking change to a published v1 collection** — `contractor` is
retired in favor of `gc` + `subcontractor`. It needs the ADR-0003 contract
version bump, which is why the work is sequenced after M3's v1 reconciliation
(DECISIONS D12). Migration maps existing `contractor` → `gc`.

Also on `punch_items`:

- **`blocks_phase`** (select over the phase enum, nullable) — the phase this
  item blocks. "A pump fault that prevented full clean water testing" is then
  answerable as a query, and `readiness.html` can mark the blocked cell.
- **`scope_gap`** (bool) — the item is required work that is in *nobody's*
  scope. Scope-gap items render prominently and separately in `punchlist.html`
  and stay pinned until `assigned_party` moves off `unassigned`. They do not
  quietly sort into a party's list, because the whole failure mode is that
  nobody reads a list they do not think is theirs.

And on `checks`:

- **`as_left_condition`** (text) — "valve left in closed position," "breaker
  left racked out," "HOA left in Hand." Cheap to capture at the end of any
  check, high dispute value, and it belongs to the check because it describes
  the state the crew left behind, not a defect.

### 7. Typed values refine the `value` response type — they do not add a fifth

Hard constraint #5 fixes four response types. Requirement 5 does not need a
fifth: a megger reading is a `value` line. What it needs is the acceptance
limit stored *beside* the reading instead of in a spec section nobody opens.

- `template_items` gains **`expected_min`**, **`expected_max`** (number,
  nullable), **`expected_text`** (the human statement, e.g. "≥ 1 MΩ per kV +
  1 MΩ"), and **`comparison`** (select: `between` / `min` / `max` /
  `equals` / `informational`). `unit` and `confirm_per_spec` already exist and
  are unchanged — `confirm_per_spec: true` with blank limits stays the honest
  "the project spec supplies this number" state (ARCHITECTURE §9).
- `check_items` gains **`value_numeric`** (number, nullable) alongside the
  existing text `value`. The **text stays the frozen human record** ("3.2 mils
  TIR", "480/478/481 V") because free-form readings must survive; the numeric
  is the comparable companion, written when the entry parses cleanly.
- The line's pass/fail is **derived** from `value_numeric` against the frozen
  limits, never stored on the check item. The limits themselves **freeze onto
  `check_items`** (`expected_min`/`expected_max`/`expected_text`/`comparison`
  copied at submit), the same freezing pattern as `prompt` — a template edited
  next year must not retroactively change whether a reading passed.
- A value that does not parse, or a line with `comparison: informational`,
  derives nothing and the tech's explicit `result` stands. Capture is never
  blocked by an unparseable reading.

This closes the gap `invariants.md` names as desired invariant #3 ("units and
calculation methods are explicit") for value lines, without a forms designer
and without a fifth response type.

**Nameplate data belongs on `tags`**, where `manufacturer` / `model` /
`serial_number` already live. It gains `hp`, `voltage`, `full_load_amps`,
`service_factor`, `phase_count`, `rpm`, `frame`, `nameplate_note` — all
capture-side facts in the ADR 0002 sense, all CSV-importable via header
synonyms. Amp draw derives its comparison against `tags.full_load_amps`.
(`service_factor` was missing from this list until the source reading — every
motor nameplate block in the package carries an S.F., and it is what makes an
over-nameplate amp reading arguable rather than automatically a failure. One
nameplate in the source is dual-voltage with amps recorded as `24.8/12.4`,
which a naive numeric parse would read as a single value — a concrete case for
the §7 rule that an unparseable reading derives nothing and the tech's explicit
result stands.)

### 8. Instrument configuration is its own append-only ledger

Configured settings are neither a calibration nor a checklist. A calibration
(ADR 0016) asks "does it read true?" — configuration asks "what is it set to?"
They change on different schedules and for different reasons; folding settings
into `calibration_points` would misrepresent both.

New append-only collection **`instrument_settings`**:

`project` · `tag` (required) · `configured_at` · `configured_by` ·
`vendor_company` (nullable — the vendor rep who set it) ·
`input_type` (e.g. `4-20mA`, `HART`, `pulse`, `discrete`) ·
`range_low` / `range_high` / `range_unit` (the engineering range: 0–500 gpm) ·
`signal_low` / `signal_high` / `signal_unit` (the electrical span: 4–20 mA) ·
`damping_seconds` · `delay_seconds` · `logging_interval` ·
`setpoints` (text: the human list) · `firmware_version` · `notes` ·
`superseded_by` (self-relation, nullable) · `client_token` (idempotent retry).

`updateRule: null`, `deleteRule: null`. A reconfiguration is a **new record**
that the prior may point at via `superseded_by`; the **current settings are
derived** as the latest record with nothing superseding it — never a stored
"current" flag. Public create, like calibrations, so the field tier can capture
it accountlessly.

**Turnover:** the frozen package gains a **per-tag instrument settings table**
— the current configuration for every instrument in scope at freeze time, with
its provenance (who set it, when, which vendor). This is the table that makes a
replaced transmitter re-configurable from the binder instead of from a vendor's
archived email.

### 9. Signature roles are template data; countersignature QC is derived

ADR 0010 named "required-role semantics" as one of its explicitly open gates
(DECISIONS D6). The observations resolve what that should mean, so this work
**requires unfreezing ADR 0010** and cannot land before open question #5 is
answered.

- **`checklist_templates.required_signature_roles`** (text, comma-separated
  role keys) — e.g. `vendor_tech,subcontractor,gc_witness`. It **freezes onto
  the check** at execution (`checks.required_signature_roles`), exactly like
  `witness_required` already does (ADR 0002). A template edited later must not
  change what a signed check required.
- `signatures.signer_role` gains `vendor_tech`, `subcontractor`,
  `gc_witness`, and `controls_integrator` alongside the existing vocabulary.
- **Witnessing becomes a role, not a text field.** `checks.witnessed_by` stays
  as capture-time attribution and is not removed; a witness who actually
  attests writes a `signatures` record with role `gc_witness`, which carries
  the name, the timestamp, and the content binding the free-text field cannot.
- **The QC view is derived, not stored:** for a package or a check, required
  roles minus roles with a signature bound to the current `content_hash` =
  **missing countersignatures**. `turnover.html` lists them before the freeze,
  which is the direct answer to "the contractor countersignature block was
  blank on every form."
- **Signing in the wrong capacity** — the observed "customer" line signed by
  the wrong party — is a human failure the app can only make visible: the
  signing surface states the role's meaning in plain words and the QC list
  shows role-by-role who signed, so a mis-role is legible instead of buried.
  The app records; it never adjudicates who was entitled to sign.

### 10. Continuation chains reuse the linked-pair pattern, forward in time

ADR 0012 established that a record which opens now and resolves later is a
**linked pair of append-only checks**, because resolving in place would mutate
an immutable record. An incomplete visit is the same shape pointing forward.

- **`checks.continues`** (relation → checks, nullable) — a follow-up check
  points at the incomplete check it continues. Deliberately a **distinct
  relation from `resolves`**: `resolves` closes a test that was *expected* to
  be open (a 48-hour leak test, a bac-t sample); `continues` picks up work that
  was *supposed* to finish and did not. Collapsing them would make "running
  correctly" and "abandoned mid-run" indistinguishable in the fold, which is
  the same error `pending`-vs-`incomplete` already avoided.
- **`service_visits.continues`** (§5) does the same for the visit ledger.
- **Pre-population:** opening a continuation from an incomplete check
  pre-fills the new check's lines from the prior record — answered lines
  carried forward as read-only context, unresolved lines presented blank and
  awaiting an explicit state (§4). This is a UI behavior over two frozen
  records; nothing is copied into storage that would drift.
- The standing fold is unchanged: the continuation is an ordinary check and
  its result folds in normally (any pass wins). The chain is provenance, not
  arithmetic.

### 11. Tag validation now; the asset/position split is a separate decision

The cheap, high-value half lands with M5:

Validation runs **three ways** (**R2**), because the source's worst tag failure
is invisible to a register check alone:

- **Non-existent tag warning.** Anywhere a tag number is typed rather than
  picked — vendor visit capture, CSV import of a vendor's tag list, the
  `open_items` free text — the UI resolves it against the project's tag
  register and warns loudly on a miss, offering "create this tag" or "fix the
  number." A warning, never a block: a real tag missing from the register is
  itself a finding worth recording.
- **Self-consistency within one report.** A tag claimed **twice inside the same
  report, against two different descriptions**, is a warning. In the source one
  flow-control-valve tag is listed as two different valves and one analyzer tag
  as two different instruments — both tags exist in the register and both
  resolve cleanly, so a register check passes and the defect survives. This is
  "one tag number pasted for two different units" in its actual form, and only
  comparing a report against itself catches it.
- **Duplicate serial detection.** A derived check across `tags.serial_number`
  within a project surfaces two tags claiming one serial. Not a unique index —
  blank serials are the norm and a genuine duplicate is a finding to
  investigate, not a write to reject.
- **Tag-collision detection.** The `(project, tag_number)` unique index already
  makes two *records* impossible; the observed failure is one tag number
  **claimed by two different equipment items** in vendor paperwork. Surfaced as
  a mismatch warning when a vendor visit's recorded manufacturer/model/serial
  disagrees with the tag's own nameplate data.

**Deferred to its own ADR:** the true **asset-vs-position** split — a `tag` is a
position on the P&ID; the physical machine with a serial number is an asset
that can be pulled, rebuilt, and reinstalled, possibly in a different position.
Modelling that properly means a new `equipment_assets` collection and an
append-only installation ledger (asset → position, with install/remove events),
and it touches the identity of every record that points at a tag. That is a
larger change than the other nine combined and it must not be improvised inside
a validation task. The **re-verification prompt** — "this position's asset
changed on {date}; phases passed before that date were passed by a different
machine" — is the reason the split matters and the first thing the new ADR must
specify. See open question #12.

### 12. Phase-entry gates warn; they never block

A clean-water pre-run checklist (tanks cleaned, floats set, recycle loop
configured) is real and worth recording. Making it *block* is not.

- A gate is an **ordinary check with a system subject** at a template whose
  `phase` is the phase being entered and whose new
  `checklist_templates.gate_for_phase` (select, nullable) names it. No new
  collection, no new record shape, no conditional logic inside a template —
  hard constraint #5 is untouched.
- The derivation: a system's gate for phase P is **satisfied** when its latest
  gate check for P folds to pass. `readiness.html` and the phase's capture
  entry point show an unsatisfied gate prominently.
- **It warns, it does not prevent.** This is the LOTO principle (ADR 0007)
  applied outside safety: the app records, it never authorizes. A crew that
  runs a phase with an unsatisfied gate has made a decision; the ledger's job
  is to record that they did, visibly, not to stand in the doorway. Hard-
  blocking would also break the field tier the moment a gate check is owed by
  someone who is not on site.

## What all of this adds to the frozen turnover package

ADR 0010's manifest gains, per scope:

1. **A vendor report index keyed by tag** (§5) — every visit, its structured
   facts, and the attachment digest of the vendor's own signed report.
2. **A per-tag instrument settings table** (§8) — the current derived
   configuration with provenance.
3. **A per-tag-per-phase standing grid** including `deferred` cells and their
   target phase (§2).
4. **A missing-countersignature QC block** (§9) — required roles vs. roles
   signed against the current hash, computed *before* the freeze is allowed.
5. **A completeness assertion** (§4) — the freeze fails while any included
   check item carries a blank result, so a frozen package can never contain an
   ambiguous blank. This is the single strongest evidence improvement in this
   ADR.
6. **As-left conditions and scope-gap punch items** rendered as their own
   sections rather than buried in the punch list (§6).

Each addition is an allowlisted set of immutable fields entering the
`sha256-canon-v1` canonical bytes, so **every one of them is a hash-affecting
change** and must land before the first real package is signed, or behind a
`sha256-canon-v2`. That is the sharpest sequencing constraint in this ADR.

## Alternatives rejected

- **A per-project `phases` collection.** Rejected (§1) — it is a stored map
  that drifts from the template library, the exact thing ARCHITECTURE §7
  already rejects for required-phases.
- **`deferred` as a field on the tag, or as a `phases_na` entry.** Rejected
  (§2) — the first is stored status; the second erases owed scope by
  conflating "moved" with "never applied."
- **A second per-tag-per-phase rollup page.** Rejected (§3) —
  `readiness.html` is that page; a parallel matrix is drift by construction.
- **Blocking submission until every line is answered.** Rejected (§4) — it
  breaks the field tier for a crew that gets pulled, and it converts a
  recoverable partial record into no record at all. The gate belongs at
  signature and freeze.
- **A fifth response type for measured values.** Rejected (§7) — hard
  constraint #5. Limits are template *metadata* on the existing `value` type.
- **Storing the derived pass/fail of a value line.** Rejected (§7) — derived
  from the reading and the frozen limits, like every other status.
- **Replacing `check_items.value` with a numeric field.** Rejected (§7) —
  "480/478/481 V" and "3.2 mils TIR" are real readings that a number cannot
  hold. The text is the record; the numeric is a companion.
- **Instrument settings inside `calibrations` or as checklist lines.**
  Rejected (§8) — different fact, different cadence; ADR 0016 already rejected
  flattening paired calibration data into checklist lines for the same reason.
- **A `settings_current` flag or a mutable settings record.** Rejected (§8) —
  stored status, and a configuration history is exactly what the observation
  says is lost today.
- **A `signed` / `countersigned` boolean on checks.** Rejected (§9) — already
  rejected by ADR 0010 for the same reasons; the QC list is derived.
- **Removing `checks.witnessed_by` in favor of signature roles.** Rejected
  (§9) — it is capture-time attribution on an append-only record and cannot be
  retrofitted; both coexist, with the signature carrying the weight.
- **One relation for both `resolves` and `continues`.** Rejected (§10) — it
  would make "running as designed" and "abandoned mid-run" the same shape in
  the standing fold.
- **A unique index on `tags.serial_number`.** Rejected (§11) — blanks are
  normal and a duplicate is a finding to surface, not a write to reject.
- **Building the asset/position split inside a validation task.** Rejected
  (§11) — it changes the identity of everything pointing at a tag and needs
  its own ADR.
- **Hard-blocking a phase on an unsatisfied gate.** Rejected (§12) — the app
  records, it never authorizes (ADR 0007's principle outside safety), and a
  hard block strands the field tier.
- **Any vendor-facing account, portal, or integration.** Rejected — vendors
  will not use this app, which is the premise of §5, and ADR 0017 already
  rejected vendor scheduling/contracts/billing as a different domain.

## Consequences

- **Contract impact is real and mostly breaking.** The `punch_items
  .assigned_party` revocabulary (§6) is a breaking change to a v1 collection;
  the `checks.result`, `check_items.result`, `checks.phase`, and
  `signatures.signer_role` enum additions are additive but contract-visible;
  `instrument_settings` is a new collection. All of it needs the ADR-0003
  version bump, which is why M4–M6 sit **after** M3's v1 reconciliation
  (DECISIONS D12).
- **The turnover manifest changes are hash-affecting** (see above). Either they
  land before any real package is signed, or `sha256-canon-v1` is retired in
  favor of a v2 and old packages verify under the old scheme. This is the
  strongest argument for keeping ADR 0010 frozen until this ADR is accepted —
  the two must be decided together.
- **ADR 0017's parked UI is unparked** (§5), and ADR 0012's parked open→resolve
  UI gains a sibling it should be built alongside (§10). DECISIONS D7 and D8
  are amended rather than reversed: the "real job asks for it" trigger fired.
- **Four of the ten items are cheap and self-contained** (§6 punch fields, §7
  nameplate fields, §11 validation warnings, §5 vendor visit fields) and could
  ship independently. Six are structural.
- **The standing fold now carries five derived states** — pass, fail, running,
  deferred, incomplete, plus not-started and N/A. That is near the ceiling of
  what a field UI can render legibly, and it is a hard stop: no sixth state
  without retiring one.
- **Nothing here creates a forms designer, a stored status, or a conditional
  template.** Every addition is either capture-side input data (ADR 0002's
  pattern), an appended immutable fact, or a derivation over the two.

## Conflicts with existing decisions — flagged, not overridden

| Requirement | Tension | Resolution proposed here |
|---|---|---|
| Configurable phases (§1) | ARCHITECTURE §7 rejects stored required-phase maps | Global vocabulary + template-library configuration; no per-project map |
| No ambiguous blanks (§4) | ARCHITECTURE §6 deliberately records unanswered lines | Blank stays legal at capture; illegal at sign/freeze |
| Typed values (§7) | CLAUDE.md constraint #5: exactly four response types | Limits are metadata on `value`; no fifth type |
| Signature QC (§9) | DECISIONS D6 freezes ADR 0010 | **Blocks on open question #5** — ADR 0010 must be unfrozen first |
| Vendor evidence UI (§5) | DECISIONS D7 parks the ADR 0017 UI | D7's trigger condition met; D7 amended by D21 |
| Continuation UI (§10) | DECISIONS D8 parks the open→resolve UI | Same; D8 amended by D21 |
| Punch party vocabulary (§6) | `docs/API.md` publishes `assigned_party` as v1 | Breaking; requires the D12 version bump — sequenced post-M3 |
| Asset vs. position (§11) | `tags` is the identity of every check subject | Deferred to its own ADR; open question #12 |

## Open questions for the maintainer

1. **Phase vocabulary.** Are `wet_commissioning` and `process_seeding` the
   right two additions, or does the observed sequence need distinct `dry_check`
   and `io_check` phases rather than mapping onto the existing four? The
   mapping choice determines whether existing seeded templates need re-phasing.
2. **`deferred` at the check level vs. the line level.** This ADR puts it at
   both (§2 and §4). If a whole-check deferral is always the real case, the
   line-level value could be dropped to keep the response vocabulary smaller.
3. **Numeric parsing of multi-value readings.** "480/478/481 V" is one line
   holding three per-leg values. Does per-leg voltage deserve three template
   lines (simple, more taps), or a structured multi-value reading (fewer taps,
   more model)? ~~Recommendation: three lines — it stays inside the four
   response types and each leg gets its own limit.~~ **Recommendation reversed
   2026-08-04 after reading the source** ([R1](0018-review-notes.md#r1--per-leg-readings-the-adrs-recommendation-is-reversed--open-recommendation-changed)):
   one vendor form carries **three triplets — nine numbers** — on what it treats
   as one or two lines. Three template lines per triplet turns that into nine
   lines on a glove-sized phone form, which is not "more taps," it is a
   different form. This question is now genuinely **undecided**; a repeatable
   value group on one `template_item` is the leading candidate. Note that
   per-leg *imbalance* is the thing most worth deriving, so the cheapest option
   (one free-text line, no numeric) quietly gives up the prize.
4. **Asset/position split** — worth doing at all, or is the re-verification
   prompt achievable with a simpler "nameplate changed on this tag" event?
   (Open question #12.)
5. **Hash versioning.** Accept ADR 0010 *after* folding these manifest
   additions in (one canonical scheme), or accept it now and plan
   `sha256-canon-v2`? Recommendation: fold first — no real packages are signed
   yet, so the cheap moment is now.

*Questions 6–8 were raised by the source reading, not the summary. Full
reasoning in [`0018-review-notes.md`](0018-review-notes.md) R3–R5.*

6. **Pass with exception** ([R3](0018-review-notes.md#r3--pass-with-exception-is-a-real-answer-the-state-vocabulary-has-no-home-for--open)).
   The source answers lines "see notes", and in two cases with both a checkmark
   *and* "see notes" — it works, and there is a caveat that became a punch item.
   Five states have no home for that. Recommendation: **do not add a state**;
   render a `pass` carrying a note **and** a linked punch item differently, as a
   derivation. Keeps the vocabulary at its ceiling and puts the caveat on the
   standing plate rather than inside a note field.
7. **A reason vocabulary for `not_performed`** ([R4](0018-review-notes.md#r4--not_performed-needs-a-small-reason-vocabulary-not-just-a-free-text-note--open)).
   The source records four sections as tested for logic but not live-tested
   because "conditions were not available" — not deferred, not N/A, not failed.
   Recommendation: a short closed vocabulary — `conditions_unavailable` ·
   `access_blocked` · `equipment_unavailable` · `out_of_scope` · `other` — so
   the package answers "why not" without a paragraph. Pair it with a turnover QC
   flag for a **failed line carrying no linked punch item** (the source has
   exactly one such orphan failure, appearing in no action-item list anywhere).
8. **Structural vs. situational N/A** ([R5](0018-review-notes.md#r5--required-na_reason-will-be-heavier-than-the-adr-assumes--open)).
   §4 requires `na_reason` on every N/A. The source marks two lines N/A on
   *every* unit of a type — a property of the equipment subtype, not of the
   check, where the honest fix is a template split (ADR 0009's reasoning, one
   grain finer). Recommendation: keep the rule simple and server-enforced, and
   add a template-page hint when a line is N/A on every tag of its type. Note
   honestly in the build task that this rule will be felt.
