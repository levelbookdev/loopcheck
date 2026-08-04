# ADR 0018 — Multi-vendor startup: staged checkout, explicit resolution, and vendor evidence as the GC's master ledger

**Status:** **accepted** (2026-08-04) · **Date:** 2026-08-04

> **Accepted 2026-08-04** by maintainer decision, after four readings of the
> source package and eighteen of this ADR's twenty-two review comments being
> decided. Acceptance settles the **design**: the structural answers in §§1–16
> and every decided review comment are now normative, and a future session must
> not re-open them without new evidence.
>
> **What acceptance does NOT do.** It authorizes no build. The M4–M6 milestones
> remain post-1.0 ([D20](../DECISIONS.md#d20--the-multi-vendor-startup-track-is-post-10-m4m6)),
> and it performs no API contract bump — the breaking `punch_items
> .assigned_party` revocabulary and every additive enum still need the D12 bump
> at M3. An accepted ADR is a settled design, not a published contract version
> and not a licence to migrate.
>
> **Still open, deliberately** — four review comments (R14, R17, R19, R20) and
> two of this ADR's own questions (**1**, phase vocabulary; **2**, `deferred` at
> check vs. line level). None blocks acceptance: all four comments are additive
> QC refinements, and both questions are build-time choices for the milestone
> that implements them. R20 needs no schema at all.
>
> **The turnover manifest fold (§15) is now cleared to ship** — but its
> precondition stands: confirm no `turnover_packages` record carrying real
> signatures exists on any live instance first, or the additions go behind
> `sha256-canon-v2`.
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
[`0018-review-notes.md`](0018-review-notes.md). Every observation was confirmed.
Four readings have now happened — a summary, a text-layer pass, a corrected
render pass, and a full render of the valve reports and clean-water checklists.
Comments **R2, R6, R7, R8, R21 and R22 are folded in below**; **R3–R5, R9–R13,
R15, R16 and R18 were decided** and appear as §4, §5, §11, §12 and §§13–14;
**R1 proposed reversing a recommendation and was decided against**; **R14, R17,
R19 and R20 remain open** for the maintainer.
The Context section below is left as originally written rather than retrofitted —
what the ADR knew when, and from what, is itself part of the record. Three of
its ten bullets are now known to be imprecise in detail while correct in
substance; the review notes carry the corrections.

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

  **It stays free text, and the friction is deliberate** (**R5**, resolved
  2026-08-04). R4 gave `not_performed` a closed vocabulary because its reasons
  recur. `na`'s do not: after `out_of_scope` and `satisfied_by_other_evidence`
  moved to `not_performed`, what remains under `na` is "this line does not apply
  to this subject" — which is either **structural** (the line should not be on
  this `tag_type`'s template) or a genuine one-off. Giving it a picker would make
  the structural case *cheap*, and cheap is exactly wrong: the friction is the
  pressure that gets the template fixed. A closed vocabulary here would let six
  identical N/As per unit, across dozens of units, become one tap and stay
  forever.

  **The systemic case is answered by a template hint, not an exemption**
  (R5 option (c)). The template page flags a line that is `na` on **every tag of
  its type** in a project — "consider a template split" — derived on the fly,
  nothing stored. This is ADR 0009's reasoning one grain finer: an inapplicable
  *phase* is `phases_na`, and an inapplicable *line* is a template that wants
  splitting. The hint keys on the repetition, not on the reason text, so junk
  reasons ("n/a", "-") cannot defeat it.

  **Carve-out, adopted:** `template_items` gains **`conditional`** (bool), and
  `na_reason` is **waived on flagged lines**. A prompt that already states its
  own condition — the source's "(if applicable: …)" lines — is self-explaining,
  and a typed reason there buys nothing. The `result` is still explicitly `na`;
  only the prose is waived. This is metadata, not a forms designer: no branching,
  no conditional logic engine, the same class of template flag as §12's
  `gate_for_phase`.

  **Rejected — requiring the reason only when siblings differ** (R5 option (b)).
  It makes the capture rule depend on data the device may not have: the field
  tier is offline-capable, and a rule that changes based on other tags' state is
  unpredictable to the person it is being enforced against. Server-enforceable
  and always-the-same beats clever.
- **A note is never an answer**
  ([R3](0018-review-notes.md#r3--pass-with-exception-is-a-real-answer-the-state-vocabulary-has-no-home-for--decided--derived-not-a-state-adr-4)).
  A line carries a `result`, and separately may carry a `note`; prose in the
  response position is not a response. The source answers several lines with a
  bare **"see notes" and no mark at all** — a cross-reference standing *in place
  of* an answer, which reads as resolved and is not. Worse, one such pointer
  **dangles**: the notes it refers to say nothing about that line. So a line with
  a note and no `result` is a **blank**, and the gate below treats it as one. The
  capture UI cannot produce this shape (result control and note field are
  separate), which is the point — the failure is native to paper.
- **A caveated pass is a derivation, not a state** (**R3**, resolved 2026-08-04,
  open question 6). No `pass_with_exception`. Five states stay five. A `pass`
  line instead renders as **pass with exception** — on the standing plate and as
  its own turnover section — when it carries a **linked consequence**: a
  `punch_items` record (§6) or a `restrictions` record (§13). The source's
  vendors already write this by hand, marking a line with *both* a checkmark and
  "see notes."

  **The trigger is a link, not a note.** Notes are common and mostly benign; a
  badge that fires on every noted pass is a badge nobody reads. **And the
  restriction trigger is what makes this complete** — the source's clearest
  caveated pass has no punch item *and never will*, because the equipment is
  defective, the workaround is permanent, and nobody owes work. R3's original
  recommendation (pass + note + punch item) would never have fired on it; §13 is
  what closes that hole.

  **Residual risk, named and accepted:** a caveat written as prose with nothing
  linked stays invisible to the derivation. Deliberately **not** mitigated by
  nudging on every `pass` carrying a note — a warning that fires on benign notes
  is one that gets clicked through, which is precisely the failure this ADR
  keeps finding in the source.
- **`not_performed` carries a reason from a closed vocabulary** (**R4**, resolved
  2026-08-04, open question 7). `check_items.not_performed_reason` (select),
  server-required when `result = "not_performed"`:

  `conditions_unavailable` · `access_blocked` · `equipment_unavailable` ·
  `satisfied_by_other_evidence` · `out_of_scope` · `other`

  `other` requires free text in the note — an escape hatch that costs a sentence
  is an escape hatch people use honestly. `satisfied_by_other_evidence` takes an
  optional **`satisfied_by`** relation to the `check_item` that did the
  demonstrating; without the pointer it is a nicer-sounding blank.

  **This absorbs R15**, and reclassifies it. The source marks such a line
  **N/A** ("verified — by a different test"), but the honest answer is
  `not_performed` + `satisfied_by_other_evidence`: the check *applies*, it simply
  was not the test that was run. People reach for N/A when nothing better
  exists — the same no-home-for-this-fact pattern as R9. So `na_reason` keeps
  its narrower job and does not grow a third meaning.

  **`out_of_scope` complements §6's scope-gap punch item, it does not replace
  it.** The line records why the check was not performed; the punch item records
  that someone still has to own the work. Recording only the line lets the scope
  gap vanish along with it.

  **QC pairing:** a `fail` line carrying no linked punch item is flagged at
  **sign/freeze**, beside the blank-result gate below — not at turnover, which
  is far too late, because in the source the page carrying the orphan failure had
  already been signed.

  Both new fields enter the manifest allowlist and land in the **§15 fold**; the
  caveated-pass derivation needs no new hashed field, since punch items and
  restrictions are already in it.
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
| `phase` | select (phase enum), **required unless `result = 'informational'`** | Which startup phase the visit served, so the rollup can show it in the right column. **Resolved 2026-08-04 (open question 12, [R12](0018-review-notes.md#r12--service_visitsphase-is-nullable-the-source-argues-it-must-be-required--decided--required-unless-informational-adr-5)): required, not nullable.** On four source reports the phase exists *only* as a five-word free-text note, because the vendor form has no phase field — so a human must assert it at capture, and a nullable field on a capture screen is one that does not get filled. An unphased visit lands in no column of the §3 rollup, which is a silent hole rather than a visible gap. The `informational` escape covers the visit that genuinely serves no phase (a warranty callback, a sales call). |
| `check` | relation → checks, nullable | Optional link when the GC logged a LoopCheck check covering the same work. |
| `continues` | relation → service_visits, nullable | The follow-up visit chain (§10). |

**A visit's evidence is many-to-many with tags** (resolved 2026-08-04, open
question 11, [R11](0018-review-notes.md#r11--vendor-evidence-is-many-to-many-with-tags-not-one-to-one--decided--service_visit_tags-join-adr-5)).
`service_visits` stays **one visit, one vendor, one trip, `tag` XOR `system`** —
that is what a visit *is*, and the visit count is a number backcharge and
schedule arguments actually use. The many-to-many lives in a join:

**`service_visit_tags`** — `service_visit` (relation, required) · `tag`
(relation, required) · `page_range` (text, nullable) · unique on
`(service_visit, tag)`.

The source forces this. The unit of record differs per vendor: one vendor's
service order covers **two machines** as numbered operations under a single
signature block; another's form covers **four positions** in parallel columns
with one comment block and one signature line; the system supplier's covers
**every tag touched that week**. So "attach the report to the tag" is not 1:1
for the majority of vendors, and splitting one PDF into four visit records
fabricates four trips that never happened.

`page_range` answers the second half, which matters as much: *which part* of a
thirty-tag document is the evidence for this tag. Without it the attachment is
technically present and practically unusable. It is free text (`"12–15"`) — no
parsing, no validation beyond non-empty; a human wrote it and a human reads it.

The visit's own `tag`/`system` remains the **primary** subject (the one the trip
was booked against); the join carries every tag the report evidences, including
the primary. §5's turnover vendor report index is keyed off the join, not the
primary subject, which is what makes it complete.

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

**A missing vendor report is a finding only where one was expected** (**R16**,
resolved 2026-08-04). The source has the gap in both directions: one valve is
confirmed in a phase record with **no vendor inspection report anywhere in the
package** while six sibling valves each have one, and three of the reports that
do exist cover tags the phase record never mentions.

The expectation is **declared by the GC's template, never inferred from what
arrived** — R22's principle from §9, and it applies here for the same reason.
A rule that derives "was a vendor report expected?" from the reports on hand
reports nothing missing in the worst case, where a whole equipment type was
never visited at all.

- **`checklist_templates.vendor_report_expected`** (bool), freezing onto the
  check as `checks.vendor_report_expected` exactly as `required_signature_roles`
  does (§9) — a template edited next year must not change what a signed check
  expected. This is the fourth flag of its kind, beside `gate_for_phase` (§12),
  `required_signature_roles` (§9) and `conditional` (§4); all template metadata,
  none of it a forms designer.
- **The QC is derived** and lists, beside the missing countersignatures in the
  same block, every check whose frozen `vendor_report_expected` is set and whose
  tag has no `service_visits` record for that phase. Shown before the freeze;
  **warns, never blocks** (D24).
- **A template-quality hint closes the loop**, exactly as R5's does: when most
  tags of a type carry vendor visits for a phase whose template does *not* set
  the flag, the template page suggests setting it. That is how the flag gets set
  without an upfront authoring pass nobody will do.

**Rejected — "flag every tag in scope with no vendor report."** Most tags never
involve a vendor at all; the rule would fire on nearly every row and train
people to skip the QC block, which is the same noise failure §4's blank gate and
R3's badge trigger were shaped to avoid.

**Rejected — a separate reverse-direction rule.** A vendor report naming a tag
outside the register is already §11's non-existent-tag warning, now with R13's
normalization in front of it. A vendor report covering tags outside this
package's *scope* is ordinary — vendors do not visit per-system — and is not a
finding.

**On the tension with R5.** R5 rejected a rule whose applicability depended on
sibling tags' data; this one embraces it. The difference is the moment, not the
principle: **that** rule was enforced at capture, against a person in the field
whose device may be offline and to whom an unpredictable rule is hostile.
**These** are computed server-side at package build and on the template page,
where the whole project is in hand and nobody is standing in a dead zone.

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
- **A multi-value reading is one template line per value** (maintainer
  decision, 2026-08-04, resolving open question #3). Three-phase amps are three
  lines, not one line holding three numbers. The tap count is identical, it
  needs no schema beyond what §7 already adds, and each leg carries its own
  limit and its own derived verdict. Vendor forms compress these onto one row
  because paper is narrow; a phone is not.
  **Known consequence — imbalance is not derived.** Three independent lines each
  pass their own limit, and nothing notices that one leg is 8% low. If a
  template ever needs a real imbalance criterion ("all three within 2% of each
  other"), the cheap answer is an optional `group_key` on `template_items` so
  the derivation can recognize the three as a set — deliberately **not built
  ahead**. Until then, imbalance is a human read, and a tech who sees it flags a
  punch item like any other finding.

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

### 8. Configuration is its own append-only ledger — instruments **and final control elements**

Configured settings are neither a calibration nor a checklist. A calibration
(ADR 0016) asks "does it read true?" — configuration asks "what is it set to?"
They change on different schedules and for different reasons; folding settings
into `calibration_points` would misrepresent both.

**Scope covers final control elements, not only transmitters**
([R21](0018-review-notes.md#r21--configuration-data-lives-on-final-control-elements-not-only-instruments--folded-into-adr-0018-8)).
Every valve report in the source captures the same class of fact on an
actuator — fail position on loss of input signal, function, control-signal type,
feedback-signal type. **Fail position is the single clearest case for this whole
collection**: configured once, recorded only in a vendor PDF, first thing anyone
needs when the actuator is replaced, and getting it wrong has process
consequences rather than paperwork ones. The collection keeps the name
`instrument_settings` — a tag is a tag and the record shape does not differ.

New append-only collection **`instrument_settings`**:

`project` · `tag` (required) · `configured_at` · `configured_by` ·
`vendor_company` (nullable — the vendor rep who set it) ·
`input_type` (e.g. `4-20mA`, `HART`, `pulse`, `discrete`) ·
`range_low` / `range_high` / `range_unit` (the engineering range: 0–500 gpm) ·
`signal_low` / `signal_high` / `signal_unit` (the electrical span: 4–20 mA) ·
`damping_seconds` · `delay_seconds` · `logging_interval` ·
`setpoints` (text: the human list) · `firmware_version` · `notes` ·
`superseded_by` (self-relation, nullable) · `client_token` (idempotent retry) ·
and for final control elements: `fail_position` (e.g. `close` / `open` /
`last`) · `control_function` (`on_off` / `modulating`) ·
`control_signal` · `feedback_signal`.

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
- **Required roles come from the GC's template, never from the vendor's paper**
  ([R22](0018-review-notes.md#r22--missing-countersignature-has-two-failure-modes-and-one-has-no-block-to-leave-blank--folded-into-adr-0018-9)).
  The source shows two failure modes, not one: a contractor block **left blank**
  on one vendor's form, and on another vendor's form **no such block at all** —
  it ends at "inspected by" and never contemplated a countersignature. A QC that
  derived "who still owes a signature" from what the attached document contains
  would report nothing missing for the second case, which is the worse one. The
  missing-countersignature list is therefore computed against the frozen
  `required_signature_roles` **independently of any attached vendor document**.
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

  **Resolution normalizes first, in three tiers** (**R13**, resolved
  2026-08-04). An exact-match register check reports the source's real
  disagreements as "non-existent tag," which is true and useless — the tag
  exists and the reader is being asked to spot a one-character difference.

  1. **Exact match** — resolves silently, as today.
  2. **Normalized match** — offered as a **candidate** ("did you mean …?"), one
     tap to accept. This catches an omitted separator or zero-padding, e.g. a
     float tag written `LSH01130` against a register holding `LSH-01130`.
  3. **Numeric-core match under a different prefix** — surfaced as a **question,
     never a candidate to accept**. The prefix says what the device *is* (ISA
     convention: an on/off valve prefix is not a flow-control-valve prefix), so
     the source's `XV`-vs-`FCV` disagreement on the same number is two parties
     describing the equipment differently, not a typo. A human answers that.

  Anything else stays the miss above.

  **The normalization is pinned exactly**, for the same reason ADR 0010 pins its
  canonical form: uppercase → strip all non-alphanumerics → strip leading zeros
  from each maximal digit run. Unpinned, "did you mean" behaves differently in
  the core, the sidecar, and an importer, and a matching rule nobody can predict
  is worse than none.

  **Never auto-correct, and never rewrite the stored value.** The ledger keeps
  what the human or the vendor actually wrote, verbatim — the same principle as
  R6's narrative and §7's frozen `value` text. Normalization exists to *find*
  candidates, never to silently agree with one. On CSV import, candidates are a
  **review step**, never a bulk rewrite.

  Normalized forms are **derived, not stored**. If a stored normalized column
  ever becomes necessary for import performance it must be server-maintained on
  write and never read as authoritative — deliberately **not built ahead**.
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

**RESOLVED 2026-08-04 — see §16**, which answers this with an append-only
`equipment_events` ledger and a derived re-verify marker rather than a second
identity. The paragraph below is left standing as the original deferral: it was
right that the *heavy* version must not be improvised inside a validation task,
and the source reading then removed the reason to build the heavy version at
all — the actuators in it carry **no serial number**, so a serial-keyed asset
model has a hole in it on day one.

~~**Deferred to its own ADR:**~~ the true **asset-vs-position** split — a `tag`
is a position on the P&ID; the physical machine with a serial number is an asset
that can be pulled, rebuilt, and reinstalled, possibly in a different position.
Modelling that properly means a new `equipment_assets` collection and an
append-only installation ledger (asset → position, with install/remove events),
and it touches the identity of every record that points at a tag. That is a
larger change than the other nine combined and it must not be improvised inside
a validation task. The **re-verification prompt** — "this position's asset
changed on {date}; phases passed before that date were passed by a different
machine" — is the reason the split matters and the first thing the new ADR must
specify. ~~See open question #12.~~

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
- **The gate reconciles against the punch list — by derivation, with no new
  field** (**R18**, resolved 2026-08-04). A gate condition and a punch item are
  routinely the same fact recorded twice: in the source, a tank-cleanliness item
  is raised as a contractor punch item at one phase and re-appears six weeks
  later as a line on the next phase's gate, with nothing connecting them. R18
  proposed a gate-line → punch-item relation. **Rejected — the pieces already
  exist.** `punch_items.blocks_phase` (§6) names the phase an item blocks, and
  `source_check` / `closing_check` (ADR 0004) already tie punch items to the
  checks that raised and cleared them. Three derivations close the loop:

  1. **Before the gate is run** — the phase's capture entry point and
     `readiness.html` list open punch items with `blocks_phase = P` on the
     subject *beside* the unsatisfied gate. That is the lookahead answer to
     "what will stop us next week," and it needs nothing new.
  2. **At the moment the gate passes** — when a gate check for P folds to pass
     while open `blocks_phase = P` items remain, prompt to close them, offering
     **the gate check itself as `closing_check`**. That is precisely what ADR
     0004 designed that field for, and it is the moment the divergence is
     cheapest to catch.
  3. **After** — a gate that folds pass with open blocking items **warns**, and
     the warning names them. Never blocks: D24 and the bullet above.

  **Why not a line-level link.** `check_items` is the highest-volume collection
  in the product; a relation there would be paid on every line of every check to
  serve a correspondence a human standing at the gate makes instantly from a
  list of two or three items. It would also put the work at **gate capture** —
  the moment we least want friction, because it is the one that happens in the
  field.

  **Residual, named:** with a nine-line gate and a dozen blocking items the
  mapping does get murky. If that proves real, the cheap answer is a nullable
  `blocks_template_item` on `punch_items` — set when the item is raised *from* a
  gate line, where the association is already known. Deliberately **not built
  ahead**.

  R18's goal was to make the gate a derivation rather than a second checklist.
  This reaches it by having the gate **read** the punch list, not link to it.

### 13. An accepted operating restriction is its own appended record — not a sixth state

**Decided by the maintainer 2026-08-04, resolving open question 9**
([R9](0018-review-notes.md#r9--an-accepted-operating-restriction-has-no-home-in-the-model--decided--restrictions-record-adopted-adr-13)).

A system is accepted with a permanent limit configured around a fault nobody
will fix. That is not `fail`, not a clean `pass`, not a punch item (no work is
owed), and not `deferred` (no later phase clears it). A **`restrictions`**
collection holds it.

| Field | Type | Why |
|---|---|---|
| `project` | relation, required | Same-project rule as every other collection. |
| `tag` / `system` | relation, **XOR** | Same subject rule as `checks` and `service_visits`. |
| `summary` | text, required | What the restriction *is*, in operating terms ("limit drive speed to X Hz"). |
| `reason` | text, required | The fault it works around. A restriction with no stated cause is folklore. |
| `limit_min` / `limit_max` | number, nullable | The limit as data. |
| `unit` / `comparison` | as §7 | Reuses `between` / `min` / `max` / `equals` / `informational` verbatim — one limit vocabulary in the product, not two. |
| `limit_text` | text | The human statement, mirroring §7's `expected_text`, for limits that do not reduce to a number. |
| `scope` | select: `permanent` / `phase` | The source carries both: a speed cap that never lifts, and a phase run with one of a redundant pair unavailable. |
| `until_phase` | select (phase enum), nullable | Required when `scope = phase`; the phase the restriction expires with. |
| `established_by_check` / `established_by_visit` | relation, nullable | Provenance — the record where it originated. At least one required. |
| `lifted_by` | relation → `restrictions`, nullable | Supersession, §10's linked-pair pattern. |
| `client_token` | text | Idempotency, as elsewhere. |

**It is appended, never edited, and never deleted.** Lifting a restriction is a
**new record** that points back via `lifted_by` — the same shape §10 uses for
continuation, and for the same reason: "this limit was removed in March" is a
fact worth as much as the limit itself.

**The active set is derived**, never stored: a subject's active restrictions are
those with nothing pointing at them through `lifted_by`, minus phase-scoped ones
whose `until_phase` is complete. Constraint #4 is untouched.

**It does not add a sixth derived state, and this is the point.** The standing
fold is unchanged and stays at its declared ceiling. A restricted subject still
derives `pass`; the standing plate renders the pass **with an active-restriction
badge beside it**, exactly as R3 recommends rendering a caveated pass. The
restriction is a *fact attached to the subject*, not a verdict about a phase.

**Three boundaries, because the whole value is in keeping them apart:**

- **vs. a punch item (§6)** — a punch item is **outstanding work someone owes**,
  with ball-in-court. A restriction is **a condition of acceptance nobody owes
  work on**. If work is owed, it is a punch item; if the answer is "we operate
  around it," it is a restriction. Keeping these apart is what makes the open-
  punch count mean something.
- **vs. as-left condition (§6)** — as-left is the state equipment was left in at
  the end of a visit (a valve left closed). It is per-visit and transient. A
  restriction constrains **operation**, and persists until lifted.
- **vs. `phases_na` / `deferred` (§§1–2)** — those say a phase does not apply or
  has moved. A restriction says the phase **completed**, and here is the
  permanent condition of that completion.

**Turnover and O&M.** Active restrictions enter the frozen manifest as their own
per-subject section. This is the half that matters most: the source's restriction
is recorded inconsistently across two pages of a submittal, and an operator who
exceeds the limit in year three reproduces a fault whose diagnosis exists only in
a note cell. A restriction is the one artifact in this ADR whose **primary reader
is not the GC at turnover but the operator years later**, and the manifest is how
it gets there.

**Rejected: a `wont_fix` / `accepted` punch resolution.** It would put something
that is not outstanding work on the outstanding-work list, and make "open punch
items" — a number people actually manage against — permanently unreliable.

### 14. Template version is an index onto already-frozen content, not a preservation mechanism

**Decided by the maintainer 2026-08-04, resolving open question 10**
([R10](0018-review-notes.md#r10--template-revision-is-not-captured-on-the-instance--decided--monotonic-version-adr-14)).

**What checking ADR 0010 changed.** R10 assumed the questions could be lost when
a template is edited. They cannot: `check_items.prompt` already **freezes a copy
of living template text** at submit (ARCHITECTURE §9, ADR 0002's pattern), §7
extends the same freezing to the limits, and ADR 0010's manifest allowlist for a
check already covers its **ordered `check_items`** (`prompt`, `response_type`,
`value`, `result`). A template edited next year cannot retroactively change what
a signed check asked. **The content problem is solved and was solved before this
ADR.** So option (b) — freeze the resolved items onto the check — is not a
decision to take; it is a description of what already happens. Option (c) —
forbid editing a template with signed checks — is rejected: it would freeze the
template library the moment a job goes live, which is the opposite of how a
library improves.

What is genuinely missing is the **index**, and it is small:

- `checklist_templates` gains **`version`** (integer, default 1), incremented by
  the server on any change to the template's items — text, order, addition, or
  removal. Editing a template's *name* does not bump it.
- `checks` gains **`template_version`** (integer), copied at submit alongside the
  existing frozen prompts.
- It enters ADR 0010's per-check manifest allowlist. The ADR's own rule is that
  what is omitted is what can be tampered without detection, and a version claim
  nobody hashes is worth nothing as evidence.

**What the index buys that frozen prompts do not.** The frozen items say what
*was* asked. They cannot distinguish **"this check predates that line"** from
**"this check skipped that line"** — because a line added to the template later
is simply absent from the old check either way. That is precisely the class of
ambiguity this ADR exists to kill, and it is unanswerable without knowing which
revision the check was complete *for*. Secondary, and cheap once the field
exists: grouping checks by revision for QA, and flagging a check run against a
template that has since moved on when deciding whether to re-run.

**Sequencing — this is the one item that cannot wait.** A version cannot be
retrofitted onto already-signed checks: the information does not exist anywhere
to reconstruct. It is also **hash-affecting**, so it lands with the other
manifest additions in the single fold that open question 5 recommends —
`sha256-canon-v1` is retired into `v2`, or, better, the fold happens before any
real package is signed and v1 is simply defined to include it. **Decide and land
this together with open question 5, not after it.**

### 15. One fold into `sha256-canon-v1`, before any package is signed

**Decided by the maintainer 2026-08-04, resolving open question 5.**

Every manifest addition in this ADR is hash-affecting. The choice was to absorb
them all into `sha256-canon-v1` now, or accept ADR 0010 as it stands and retire
v1 into a `v2` later. **The fold happens now, in one pass, into v1.**

**Why v1 rather than v2.** A hash scheme version exists to protect *history* —
it lets old packages keep verifying under the rules they were sealed with. There
is no history to protect: **no real package has been signed.** Minting a v2 to
carry additions that no v1 package ever saw would leave a version boundary that
records nothing, and every future reader would have to learn a distinction that
never mattered. The cheap moment is the one where the cost is zero, and it does
not come back.

**Precondition, and it is a real one.** ADR 0010's builder and canonicalizer are
**already shipped and running** (`pb_hooks/turnover.pb.js`,
`turnover_canon.js`, with a golden-vector self-check on load). So this is a code
change, not a documentation change. Before the fold lands, **confirm no
`turnover_packages` record carrying real signatures exists on any live
instance.** If one does, this decision inverts on the spot and the additions go
behind `sha256-canon-v2` — a signed package that stops verifying is the one
outcome this whole ADR exists to prevent. Test packages are discarded, not
migrated.

**Scope of the fold** — the eight additions listed above **plus any field
decided before the fold ships**, landing together, with the **golden vector
regenerated** as the acceptance test. Partial folds are forbidden: each one
alone would change the canonical bytes, so shipping them piecemeal means several
silent breaks instead of one deliberate one. *Added after this section was
written:* `check_items.not_performed_reason` and `satisfied_by` (§4, R4), and
`checks.vendor_report_expected` (§5, R16), which freezes onto the check like
`required_signature_roles` and so enters the per-check allowlist. The
caveated-pass derivation (§4, R3) and the gate/punch reconciliation (§12, R18)
add no hashed field — punch items and restrictions are already in the manifest,
and both are derivations. R16's QC line lands inside the QC block that is
already addition 4, not as a new manifest entry.

**D6 is amended rather than reversed** (DECISIONS D25). D6 froze ADR 0010 on the
reasoning that "accepting it now hardens hash/attestation semantics that are hard
to change once real records exist." That reasoning **argues for this fold, not
against it** — the allowlist is precisely the thing that becomes unchangeable, so
it is the thing to get complete while it is still free. D6 conflated two
separable questions:

- **the canonical form and manifest allowlist** — unfrozen by this decision,
  because delay makes it strictly more expensive and never cheaper;
- **acceptance of ADR 0010 as a whole** — a separate act, on separate gates:
  the "not a qualified e-signature" wording (C4), required-role semantics, and
  the API v1 contract bump (D12). ~~This decision leaves it blocked.~~ *(It did
  not stay blocked — see below.)*

~~So ADR 0010 stays **Proposed** with a completed allowlist. That is a coherent
state: the bytes are settled, the legal and contract questions are not.~~

**Overtaken 2026-08-04: ADR 0010 is now Accepted** (DECISIONS **D26**). The two
gates this section left standing were closed the same day — C4's wording was
already shipped on both signing pages, and required-role semantics are §9 of
this ADR. A third gate that D6 *assumed* was met turned out not to be: the
golden vector was a `console.log`, not a test. It is now enforced at the build
route and asserted by `scripts/smoke_test.sh`. The **API v1 contract bump is
explicitly not a precondition** of acceptance and remains M3 work. See ADR
0010's acceptance block.

**Unblocks §9.** The Conflicts table below recorded signature-role QC as
"blocks on open question #5." It no longer does.

### 16. The asset behind a position is an appended event, not a second identity

Resolves [open-questions #12](../open-questions.md). §11 deferred the
asset-vs-position split to its own ADR on the grounds that it "changes the
identity of every record pointing at a tag." That was the right instinct about
the *heavy* version of the design, and the source reading then removed the
reason to build the heavy version at all.

**What killed the obvious design.** An `equipment_assets` collection keyed on
serial number fails immediately: in the source, **actuator serial number reads
"N/A" on all six valve reports**. An entire equipment class has no identity to
key on. A model with a hole that size on day one is not a model.

**What the requirement actually is.** Not "track assets through their life" —
that is asset management, and the product refuses to be an ERP. It is: *a phase
passed by a machine that was subsequently pulled apart must not read as
current.* In the source, a pump was found with a frozen impeller, removed,
rebuilt with new seals, and re-installed **between the clean-water and seeding
phases**, with a standing action item to confirm the rebuild. Every clean-water
result logged against that position describes a machine that no longer exists in
that state. Nothing anywhere says so.

That requirement is a **derivation over dates**, which is what this product does
everywhere.

New append-only collection **`equipment_events`**:

`project` · `tag` (required) · `occurred_at` · `kind`
(`replaced` / `rebuilt` / `reinstalled` / `relocated` / `nameplate_corrected`) ·
`serial_before` / `serial_after` (**both nullable** — the actuator case) ·
`performed_by` · `vendor_company` (nullable) · `note` · `client_token`.
`updateRule: null`, `deleteRule: null`. Public create, like the other field
ledgers.

**The derivation.** For each tag, `last_event = max(occurred_at)`. Any phase
whose standing derives entirely from checks **older than `last_event`** renders
with a **re-verify marker naming the event and its date**. It is a marker, not a
downgrade — the pass stays in the ledger exactly as any-pass-wins requires, and
nothing is stored. The frozen turnover package carries the same marker, which
produces the honest sentence an owner is owed: *this phase passed on the 12th;
the machine was rebuilt on the 19th.*

**Why this shape:**

- **It is one more append-only event ledger on a tag** — the same grammar as
  `loto_events`, `calibrations`, and `service_visits`. No new subject kind, no
  change to the exactly-one-subject rule, no identity scheme, and no edit to any
  record that points at a tag.
- **It works when there is no serial.** The *event* is the fact; serials are
  optional metadata on it. An actuator swap with nothing to key on is still
  recordable and still raises the marker.
- **It is derived, never stored.** No "needs re-verification" flag; it falls out
  of comparing check dates to event dates.
- **It does not foreclose the heavy version.** If spares pools or rotating
  equipment ever matter, these events are the substrate that model would be
  built on — they already record what changed and when.

**What it deliberately gives up, and this is a real loss:** you cannot ask
"where has serial X been installed over time," or follow one physical machine
between positions. That is asset management. It belongs in an ERP or a
materials-tracking product, not a commissioning tracker, and the refusal is
consistent with the rejected-ideas list. Recorded as a conscious trade rather
than an oversight.

**Sizing.** One small collection, one derivation, one marker in two views — a
scope item inside **M5.3**, not its own milestone and not its own ADR.

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
7. **Active operating restrictions, per subject** (§13) — the limit as data with
   its cause and provenance. The one section whose primary reader is the
   operator years later rather than the GC at turnover.
8. **`template_version` on every included check** (§14) — the index that says
   which revision of the questions a frozen answer set was complete for.

Each addition is an allowlisted set of immutable fields entering the
`sha256-canon-v1` canonical bytes, so **every one of them is a hash-affecting
change** and must land before the first real package is signed, or behind a
`sha256-canon-v2`. That is the sharpest sequencing constraint in this ADR, and
it is resolved by open question 5 below: **one fold, now, into v1.**

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
  (DECISIONS D12). **`restrictions` (§13) and `service_visit_tags` (§5) are two
  further new collections**, and `checklist_templates.version` +
  `checks.template_version` (§14) two further additive fields; all join the same
  queue and none breaks anything already published. **`service_visits.phase`
  becoming required (§5) is the one tightening change** — harmless now with no
  data, and it must land before the ADR 0017 UI ships or it is a backfill.
- **Open question 5 is now the critical path, not a loose end.** Three separate
  manifest additions are hash-affecting — the vendor report index (§5), active
  restrictions (§13), and `template_version` (§14) — and §14's cannot be
  retrofitted at all. They should be folded into one canonical scheme in a
  single pass, before any real package is signed, rather than each retiring
  `sha256-canon-v1` in turn.
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
  without retiring one. **§13 respects the ceiling deliberately**: an accepted
  operating restriction is a record attached to the subject, rendered as a badge
  beside an unchanged `pass`, not a new state. Anything else arriving in this
  space should take the same route.
- **Nothing here creates a forms designer, a stored status, or a conditional
  template.** Every addition is either capture-side input data (ADR 0002's
  pattern), an appended immutable fact, or a derivation over the two.

## Conflicts with existing decisions — flagged, not overridden

| Requirement | Tension | Resolution proposed here |
|---|---|---|
| Configurable phases (§1) | ARCHITECTURE §7 rejects stored required-phase maps | Global vocabulary + template-library configuration; no per-project map |
| No ambiguous blanks (§4) | ARCHITECTURE §6 deliberately records unanswered lines | Blank stays legal at capture; illegal at sign/freeze |
| Typed values (§7) | CLAUDE.md constraint #5: exactly four response types | Limits are metadata on `value`; no fifth type |
| Signature QC (§9) | DECISIONS D6 freezes ADR 0010 | ~~Blocks on open question #5~~ **Unblocked 2026-08-04 (§15):** D6 is amended by D25 — the manifest allowlist and canonical form are unfrozen for one fold; ADR 0010's *acceptance* stays blocked on its own gates |
| Vendor evidence UI (§5) | DECISIONS D7 parks the ADR 0017 UI | D7's trigger condition met; D7 amended by D21 |
| Continuation UI (§10) | DECISIONS D8 parks the open→resolve UI | Same; D8 amended by D21 |
| Punch party vocabulary (§6) | `docs/API.md` publishes `assigned_party` as v1 | Breaking; requires the D12 version bump — sequenced post-M3 |
| Asset vs. position (§11) | `tags` is the identity of every check subject | **Resolved (§16)** — an appended `equipment_events` fact + derived re-verify marker; `tags` stays the only identity. Asset-history tracking is a conscious loss |

## Open questions for the maintainer

1. **Phase vocabulary.** Are `wet_commissioning` and `process_seeding` the
   right two additions, or does the observed sequence need distinct `dry_check`
   and `io_check` phases rather than mapping onto the existing four? The
   mapping choice determines whether existing seeded templates need re-phasing.
2. **`deferred` at the check level vs. the line level.** This ADR puts it at
   both (§2 and §4). If a whole-check deferral is always the real case, the
   line-level value could be dropped to keep the response vocabulary smaller.
3. ~~**Numeric parsing of multi-value readings.**~~ **RESOLVED by the
   maintainer, 2026-08-04: one template line per leg.** See §7's
   multi-value clause. The path: the ADR recommended three lines; the source
   reading reversed that recommendation on the grounds that one vendor form
   carries three triplets — nine numbers — on what it treats as one or two
   lines ([R1](0018-review-notes.md#r1--per-leg-readings-the-adrs-recommendation-is-reversed--decided--original-recommendation-upheld));
   the maintainer upheld the original recommendation. **The reversal
   under-weighted that the tap count is identical either way** — nine readings
   are typed whether they sit in one line with three boxes or three lines with
   one box each. The vendor form's compact layout is a paper constraint, not a
   phone one. Three lines needs no new schema, no value-group concept, and
   gives each leg its own limit and derived verdict.
4. ~~**Asset/position split**~~ **RESOLVED 2026-08-04: the simpler event.**
   §16 adds an append-only `equipment_events` ledger and a derived re-verify
   marker; no second identity, no `equipment_assets` collection. The source's
   actuators carry no serial number, which is what killed the serial-keyed
   model. See [D27](../DECISIONS.md#d27--the-asset-behind-a-position-is-an-appended-event-not-a-second-identity)
   and open question #12. *(This entry was stale — the decision landed in §16
   without the question list being updated.)*
5. ~~**Hash versioning.**~~ **RESOLVED by the maintainer, 2026-08-04: fold
   first, into `sha256-canon-v1`, before any real package is signed.** See
   §15.

*Questions 6–8 were raised by the source reading, not the summary. Full
reasoning in [`0018-review-notes.md`](0018-review-notes.md) R3–R5.*

6. ~~**Pass with exception**~~ **RESOLVED 2026-08-04: option (c), a derivation —
   and the trigger is a *linked consequence* (punch item **or** §13
   restriction), not a note. See §4.**
   ([R3](0018-review-notes.md#r3--pass-with-exception-is-a-real-answer-the-state-vocabulary-has-no-home-for--decided--derived-not-a-state-adr-4)).
   The source answers lines "see notes", and in two cases with both a checkmark
   *and* "see notes" — it works, and there is a caveat that became a punch item.
   Five states have no home for that. Recommendation: **do not add a state**;
   render a `pass` carrying a note **and** a linked punch item differently, as a
   derivation. Keeps the vocabulary at its ceiling and puts the caveat on the
   standing plate rather than inside a note field.
7. ~~**A reason vocabulary for `not_performed`**~~ **RESOLVED 2026-08-04: the
   closed vocabulary, with `satisfied_by_other_evidence` added and R15 absorbed
   into it. See §4.**
   ([R4](0018-review-notes.md#r4--not_performed-needs-a-small-reason-vocabulary-not-just-a-free-text-note--decided--closed-vocabulary-adr-4)).
   The source records four sections as tested for logic but not live-tested
   because "conditions were not available" — not deferred, not N/A, not failed.
   Recommendation: a short closed vocabulary — `conditions_unavailable` ·
   `access_blocked` · `equipment_unavailable` · `out_of_scope` · `other` — so
   the package answers "why not" without a paragraph. Pair it with a QC flag for
   a **failed line carrying no linked punch item**.

   **Example corrected 2026-08-04 (third reading).** This question previously
   cited a PID-tuning line as the orphan failure; that line is marked **pass**,
   and its note describes a defect plus a workaround — an instance of open
   question 6, not this one. The real orphan failure is the line confirming
   **automatic recovery from simulated power-loss events**, and it is a stronger
   case: its note cell is **empty**, it is arguably the most consequential line
   on that page, and the page was **signed as a whole** immediately afterwards
   with the failure on it, appearing in no action-item list anywhere in the
   package.

   **Consequence for where the flag fires.** An orphan failure that survives a
   signature is not caught by a turnover-package check — turnover is far too
   late, and the signature already happened. The flag belongs at **sign/freeze**
   time alongside §4's blank-result gate: §4 already refuses to sign a check
   carrying a blank line, and a **failed line with no linked punch item is the
   same class of defect** — a line whose consequence has nowhere to go. Whether
   that hard-blocks the signature (as blanks do) or warns loudly is the open
   part; §4's gate is the precedent, and the field evidence says a warning would
   have been clicked through.
8. ~~**Structural vs. situational N/A**~~ **RESOLVED 2026-08-04: (a) + (c) plus the conditional carve-out** — see [R5](0018-review-notes.md#r5--required-na_reason-will-be-heavier-than-the-adr-assumes--decided--a--c--the-conditional-carve-out-adr-4). *(Entry left below as originally written.)*
   §4 requires `na_reason` on every N/A. The source marks two lines N/A on
   *every* unit of a type — a property of the equipment subtype, not of the
   check, where the honest fix is a template split (ADR 0009's reasoning, one
   grain finer). Recommendation: keep the rule simple and server-enforced, and
   add a template-page hint when a line is N/A on every tag of its type. Note
   honestly in the build task that this rule will be felt.

*Questions 9–12 were raised by the third reading (2026-08-04, from rendered
pages). Full reasoning in [`0018-review-notes.md`](0018-review-notes.md)
R9–R12; seven further refinements to decisions already made are recorded there
as R13–R19 and need no question here.*

9. ~~**An accepted operating restriction**~~ **RESOLVED by the maintainer,
   2026-08-04: a `restrictions` collection — see §13.** The reasoning below
   stands as written; §13 carries the settled shape.
   ([R9](0018-review-notes.md#r9--an-accepted-operating-restriction-has-no-home-in-the-model--decided--restrictions-record-adopted-adr-13)).
   The source accepts a system with a permanent speed cap configured around an
   unresolved equipment fault: not a fail, not a clean pass, not a punch item
   (nobody will ever fix it), not a deferral (no later phase clears it). The
   Consequences section above declares five derived states the hard ceiling, so
   this cannot be a sixth. Recommendation: a **`restrictions` record** attached
   to tag or system carrying a typed limit (value + unit + comparison, reusing
   §7's shape), the check that established it, and a required narrative —
   derived onto the standing plate and into turnover, no new `result` state.
   The alternative of a `wont_fix` punch resolution abuses the punch list to
   hold something that is not outstanding work, and makes the open-punch count
   unreliable. **This is the largest gap the third reading found:** the model
   can say a thing passed or failed, and cannot say "it passed, and here is the
   permanent condition of that pass."
10. ~~**Template revision on the instance**~~ **RESOLVED 2026-08-04: a monotonic
    `version`, and the premise was half wrong — ADR 0010 already freezes the
    item text, so this is an index, not a preservation mechanism. See §14, and
    land it with question 5.**
    ([R10](0018-review-notes.md#r10--template-revision-is-not-captured-on-the-instance--decided--monotonic-version-adr-14)).
    `template_version` / `revision` appears nowhere in this ADR or
    `ARCHITECTURE.md`, while the source's own checklist form carries a revision
    marker in its header. If a template line is added, reworded, or removed
    after a check is signed, the frozen answers no longer reproduce the
    questions. Recommendation: a monotonic `version` on `checklist_templates`
    copied onto `checks` at capture — and check whether ADR 0010's manifest
    already freezes item text, in which case the version is just the index and
    most of the work is done. **Must be decided before M5:** a version cannot be
    retrofitted onto already-signed checks.
11. ~~**Vendor evidence is many-to-many with tags**~~ **RESOLVED 2026-08-04: a
    `service_visit_tags` join with an optional `page_range`; `service_visits`
    stays one visit, one trip. See §5.**
    ([R11](0018-review-notes.md#r11--vendor-evidence-is-many-to-many-with-tags-not-one-to-one--decided--service_visit_tags-join-adr-5)).
    §5 assumes one report evidences one subject. In the source one vendor's
    service order covers two machines under a single signature block, another
    vendor's form covers four positions in parallel columns, and the system
    supplier's covers every tag touched that week. `tag XOR system` cannot say
    "this report proves these four tags," and splitting the PDF into four visit
    records fabricates four visits. Recommendation: a `service_visit_tags` join
    carrying an optional `page_range` per tag — keeping `service_visits` honest
    about what a visit was, and answering *which part* of a thirty-tag document
    proves a given tag.
12. ~~**Should `service_visits.phase` be required?**~~ **RESOLVED 2026-08-04:
    required unless `result = 'informational'`. See §5.**
    ([R12](0018-review-notes.md#r12--service_visitsphase-is-nullable-the-source-argues-it-must-be-required--decided--required-unless-informational-adr-5)).
    §5 has it nullable. The source's argument for required: on four vendor
    reports the phase exists **only** as a five-word free-text note, because the
    form has no phase field — so a human must assert it at capture, and a
    nullable field does not get filled. An unphased visit lands in no column of
    the §3 rollup. Recommendation: required **unless `result =
    'informational'`**, which covers the warranty-callback case honestly.
