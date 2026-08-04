# Review notes — ADR 0018 (Multi-vendor startup evidence model)

Source verification of [ADR 0018](0018-multi-vendor-startup-evidence-model.md),
performed 2026-08-04, **after** the ADR was written.

**Why these notes exist.** ADR 0018 was written from a *summary* of the field
observations, not from the source document. The compiled startup report package
was read directly afterwards, and this file records what that reading confirmed,
what it corrected, and what it newly raised — rather than silently rewriting the
ADR's Context section as though the source had been read all along. Provenance
matters here for the same reason it matters everywhere else in this repo: a
record that quietly improves itself is not a record. The same rule applies to
this file: **R1 was decided against and is left standing with its flaw named**,
not deleted.

**Verdict: the ten observations hold.** Every one is present in the source, and
several appear close to verbatim — the deferral annotation, the blank
countersignature block, the as-left condition, the instrument spans and logging
intervals, and a signed phase-entry pre-run checklist all read as written. The
ADR's structural answers are unchanged by the reading. What the source *did*
change is four refinements folded into the ADR (R2, R6, R7, R8) and three
questions the summary did not raise (R3–R5). R1 proposed reversing a
recommendation and was **decided against** by the maintainer.

**What was read.** A **73-page** compiled startup submittal covering five
independent vendors, in five mutually incompatible form formats: a rotary-lobe
pump vendor's four-page start-up report (×4 units), a blower vendor's seven-page
service order (×2 units), a valve-actuator vendor's inspection reports (×6
units), an MBR system supplier's three field service reports (dry checks, I/O
checks, clean water), and three clean-water checklists including a pre-run gate.
No project, company, or person is identified in these notes.

**Corrections — third reading, 2026-08-04.** Three claims in these notes were
wrong, and all three failed the same way: they were taken from the PDF's
**extracted text layer** rather than from rendered pages. In this package the
text layer misplaces checkbox and Y/N columns — marks collapse upward toward
the first rows of a table, and answer columns detach from their items — so a
filled form reads as a mostly-empty one. The source was re-read from rendered
page images and the corrections are marked at each site below.

| Claim as written | Correct | Where |
|---|---|---|
| "A 24-page compiled startup submittal" | **73 pages** — 24 was the tooling's page count, not the file's | fixed above |
| "14 of 20 checklist items blank on all four copies … including rotation direction and power consumption" | **3 of 20** — items 6, 12 and 20. Rotation direction (item 7) and power consumption (item 19) are both marked and initialled | §4 row in the confirmation table |
| "one clean-water logic line is answered a hard **N** — a PID loop not tuned" | The PID line is marked **Y**. The **N** is the line covering **automatic recovery from simulated power-loss events** | R4 |

The third correction is the one that matters beyond accuracy: **ADR 0018's open
question 7 is built on that example**, and the real line is both more
consequential and a cleaner illustration of the point. It is corrected there
too.

Nothing structural changes. The ten observations still hold, R2 / R6 / R7 / R8
stand as folded in, and R3–R5 remain open. Method note for whoever reads a
scanned or form-heavy source next: **render the pages.** A text layer is a
convenience, not the document.

**Independently re-verified from rendered pages, 2026-08-04.** A page renderer
was installed and the four checklist pages re-read as images. The corrections
above are confirmed exactly: twenty rows, blanks at items **6, 12 and 20** only,
rotation direction (7) and power consumption (19) both marked and initialled,
and the **Date column empty on every row**. The rendering also produced two
findings the text layer could not have surfaced — the four checklist pages are
byte-identical renders (**R14.1**) and the inapplicable equipment-type column is
left blank rather than marked N/A (**R5**).

The same reading also raised **eleven items the first two passes did not
reach** — [R9–R19](#third-reading--eleven-items-not-previously-raised) at the
end of this file. Four carry to the ADR as open questions 9–12; none overturns
a decision already made.

---

## R1 — Per-leg readings: the ADR's recommendation is **reversed** · **DECIDED — original recommendation upheld**

**Resolved by the maintainer, 2026-08-04: one template line per leg.** This
comment argued for reversing the ADR's recommendation; the maintainer upheld the
original. The argument below is left standing as written, with the flaw named
at the end — a review note that quietly edits itself to agree with the outcome
is worth nothing to the next reader.

**ADR location:** open question #3 (now resolved); §7 carries the settled rule.

The ADR recommended three template lines for a three-phase reading ("simple,
more taps... each leg gets its own limit"). The source contradicts the premise.
The blower service order records power consumption as **one line carrying three
values** (`Line U1 <a> A · V1 <a> A · W1 <a> A`) and then carries **two further
triplets in its comment column** — line-to-line voltages and a second set.
That is three triplets, nine numbers, on what the vendor treats as one or two
lines.

Under the ADR's recommendation that becomes nine template lines. On a glove-
sized phone form, at a motor control center, that is not "more taps" — it is a
different form. The trade is no longer close.

**Revised recommendation:** treat the structured multi-value reading as the
likely answer, or at minimum record open question #3 as genuinely undecided
rather than leaning to three lines. Two shapes are worth costing before the M5.2
migration:

- a repeatable value **group** on one `template_item` (`value_count: 3`,
  `value_labels: "U1,V1,W1"`), with `check_items` holding an ordered set of
  readings against one shared limit; or
- keeping one line and one free-text `value`, deriving a numeric only when the
  reading parses as a single scalar — accepting that per-leg imbalance cannot
  be checked automatically.

The first stays inside four response types (it is still a `value` line) but
grows `check_items` from one row per line to one row per reading. The second
costs nothing and buys nothing. Neither is chosen here.

**Note for whoever decides:** per-leg imbalance is precisely the thing worth
deriving — three legs within a few percent is a pass, one leg off is a finding —
so the "one free-text line" option quietly gives up the main prize.

---

### Where this comment was wrong

**The tap count is identical either way.** Nine readings get typed whether they
sit in one line with three boxes or three lines with one box each. This comment
counted *prompts* and called them taps, and treated the vendor form's compact
layout as evidence about phone ergonomics when it is evidence about paper being
narrow. Three lines needs no schema beyond what §7 already adds, introduces no
value-group concept, and gives each leg its own limit and derived verdict.

**What survives:** the imbalance point. Three independent lines each pass their
own limit and nothing notices one leg 8% low. ADR 0018 §7 now records that
consequence explicitly, with an optional `group_key` on `template_items` as the
cheap future answer if a template ever needs a real imbalance criterion —
deliberately not built ahead. Until then imbalance is a human read.

**Method note for future reviews:** this comment argued from a document's
*layout*. A vendor's form is evidence about what facts exist and what disputes
arise; it is not evidence about how a phone should collect them. Two different
questions, and this note conflated them.

## R2 — Tag validation must check a report against **itself** · **RESOLVED in ADR 0018 §11**

**ADR location:** §11, first bullet ("Non-existent tag warning").

The ADR validates typed tag numbers against the project's tag register. The
source's worst tag failure is invisible to that check: within a *single*
narrative report, one `FCV-` tag is listed as both the air-scour and the process
air flow control valve, and one `AE-` tag is listed as both the pressure
transmitter and the turbidity meter. Both tags exist in the register and both
resolve cleanly. The defect is that one tag is claimed **twice inside one
document, for two different pieces of equipment**.

This is the same failure the summary described as "one tag number pasted for two
different valves," and the register check does not catch it.

→ ADR 0018 §11 now requires the validation to run **three ways**: against the
register, against the tag's own nameplate data, and **against the rest of the
same report's tag list** (a tag claimed twice in one report with two different
descriptions is a warning, not a silent pass).

## R3 — "Pass with exception" is a real answer the state vocabulary has no home for · *open*

**ADR location:** §4, the `check_items.result` vocabulary.

The valve inspection reports repeatedly answer a line with **"see notes"**, and
in at least two cases with **both a checkmark and "see notes"** on the same
line. Reading the notes, that means: it works, *and* there is a caveat that
became a punch item (a burnt-out indicator lamp) plus a live technical dispute
about wiring.

ADR 0018's five states — pass / fail / na / not_performed / deferred — force
that into `pass` and hope someone reads the note. That is a milder version of
the exact ambiguity the ADR exists to kill: a reader years later sees a clean
pass with a note they may not open.

**Options:** (a) accept it — `pass` plus a note is honest enough, and the
punch item carries the defect; (b) add `pass_with_exception` — but the ADR
itself declares five states the legibility ceiling, so this would have to
retire one; (c) make it structural rather than a state — a `pass` line that
carries a non-empty note **and** a linked punch item renders differently
(derived, no new state, no vocabulary growth).

**Recommendation:** (c). It costs no enum value, it is derived, and it makes
the caveat visible on the standing plate rather than inside a note field. But
it is a real decision and the ADR should not absorb it silently.

## R4 — `not_performed` needs a small reason vocabulary, not just a free-text note · *open*

**ADR location:** §4.

The clean-water report states that four sections' gas detectors were tested for
internal logic but **"conditions were not available to trigger or live test"**
them. That is not `deferred` (nothing was moved to a later phase, and no
follow-up was named), not `na` (the check applies), and not `fail`. It is
"not performed, because the plant could not be put in the state required."

Separately, one clean-water logic line is answered a hard **N** — ~~a PID loop
not tuned~~ **corrected: the line confirming that the system recovers
automatically from simulated power-loss events, with no manual operator
action** — and appears in **no** action-item list in the package. A bare `fail`
with no punch item is exactly the leak the ball-in-court work is meant to close
(see R5's neighbour finding below).

**Correction, third reading 2026-08-04.** The PID line is marked **Y**, not N;
its *note* describes an unresolved equipment defect and prescribes a speed
limit as a workaround, which makes it an instance of **R3** (pass with
exception), not of this comment. The genuine bare failure is the power-loss
recovery line, and it is a stronger example in three ways: its note cell is
**empty**, so there is no prose for a reader to fall back on; it is arguably
the most consequential line on the page; and the page was **signed as a whole**
immediately afterwards. That last point sharpens the recommendation below — the
QC flag has to fire at **sign/freeze** time, not only in the turnover package,
because a signature over a set of lines is plainly not a signature over their
content.

**Recommendation:** a short closed vocabulary on `not_performed` —
`conditions_unavailable` · `access_blocked` · `equipment_unavailable` ·
`out_of_scope` · `other` — is cheap and makes the turnover package answer
"why not" without a paragraph. Combine with a rule that a `fail` line offers
punch-item creation (already the behavior in `check.html`) and that the
turnover QC flags a failed line with no linked punch item.

## R5 — Required `na_reason` will be heavier than the ADR assumes · *open*

**ADR location:** §4, "`na_reason` required when `result = "na"`".

The valve reports mark "check valve seat for debris or defect" and "check
ball/disc for defect" **N/A on every unit** — because they are the wrong valve
type for those lines. That is a *structural* N/A: it is a property of the
equipment subtype, identical on every unit, and typing a reason six times adds
nothing a reader could not infer.

The ADR's rule is right for *situational* N/A ("not applicable here, because
…") and wrong for structural N/A, where the honest fix is that the line should
not have been on that tag_type's template in the first place — the same
reasoning ADR 0009 used to reject line-level N/A for whole phases, one grain
finer.

**Options:** (a) require the reason regardless — simple, some friction; (b)
require it only when the same line is *not* N/A on sibling tags of the same
type (derived, clever, probably too clever); (c) require the reason, and add a
"this line is N/A on every tag of this type — consider a template split"
maintenance hint on the template page.

**Recommendation:** (a) + (c). Keep the rule simple and enforceable
server-side, and surface the structural case as a template-quality signal
rather than a per-check exemption. But note the friction honestly in the task:
this rule will be felt.

**The structural case also appears at column scale, and it appears as a
blank.** The pump vendor's form is one checklist serving two equipment types —
it has a `Pump` column and a `Grinder` column. On all four reports the entire
**Grinder column is blank down all twenty rows**, because the unit is a pump.
Nobody wrote "N/A"; the column is simply empty. So the honest reading is that
when a form is structurally inapplicable, the field response is **not** a
considered N/A — it is a blank, and it is a blank for a reason §4's gate does
not address (the tech had nothing to say, not something they skipped). That is
the strongest argument in the source for recommendation (c): the fix belongs in
the template library, where "this line does not apply to this tag_type" is
stated once, rather than in twenty per-check reason fields or twenty blanks.

## R6 — The vendor's own narrative is evidence and must be preserved verbatim · **RESOLVED in ADR 0018 §5**

**ADR location:** §5, the `service_visits` field table.

The ADR treats `summary` as a summary. In the source, one valve vendor's report
carries five paragraphs of **technical dissent** — an objection to how another
trade wired the units, a statement that it may be the cause of a recurring
failure, a record of what was agreed in a meeting, and an explicit "we have no
way of verifying" caveat. That is the single most dispute-relevant text in the
whole package, and it is neither a check result nor a punch item.

→ ADR 0018 §5 now states that `summary` holds the vendor's narrative
**verbatim, never paraphrased**, that it surfaces on the tag page rather than
only in the project ledger, and that it enters the turnover manifest as frozen
text.

## R7 — A visit's `result` must never be inferred from its narrative · **RESOLVED in ADR 0018 §5**

**ADR location:** §5, the `result` field.

The blower service order simultaneously carries a checked block reading
**"Equipment not released for use!"** (with its sub-items commented `n/a`) and
free text reading **"unit is ready for normal operation."** The form contradicts
itself. Whichever is true, no parser and no person should be deciding it from
the prose at import time.

→ ADR 0018 §5 now states that `result` is **always entered explicitly by the
person logging the visit** and is never derived, defaulted, or inferred from
`summary`/`open_items` text — including by any future import path.

## R8 — Report age relative to the phase it evidences · **RESOLVED in ADR 0018 §5**

**ADR location:** §5, turnover treatment.

One valve inspection report in the package is dated **more than two years
before** the rest of the set, and its narrative refers to a site visit from that
earlier period. It was compiled into the current startup package as though
contemporaneous. Nothing in ADR 0018 as written notices this.

→ ADR 0018 §5 now requires the vendor report index to carry each visit's date
**relative to the phase it evidences**, and to flag a visit materially older
than the phase it is offered as evidence for. Like every other flag in this
product it is a warning, not a rejection — an old report may be perfectly
valid, and the reader should be the one deciding.

---

## Findings that confirmed the ADR without changing it

Recorded so a future reader knows these were checked against the source, not
assumed:

| ADR section | Source evidence |
|---|---|
| §2 deferral | Two "will be checked during clean water with [vendor] rep" annotations, plus one "finish during clean water" |
| §4 blanks | ~~14 of 20~~ **3 of 20** checklist items blank on **all four** copies of one vendor's pump form — items 6, 12 and 20 (optional safety equipment, air relieved from piping, and the O&M inspection schedule: plausibly N/A, definitely-performed-or-not, and a deliverable rather than a field check — three meanings, one blank cell). Rotation direction and power consumption are both marked and initialled. Separately, the form's **Date column is blank on all twenty rows** of all four copies; only initials were entered, so nothing on the form dates an individual check |
| §5 vendor evidence | Five vendors, five incompatible formats, one of them a seven-page service order with on-site/off-site times **and break duration** |
| §6 ball-in-court | The MBR supplier's reports are *organized* by responsible party — three standing sections per report |
| §6 scope gap | Three separate instances, including an instrument explicitly "not in scope but would need to be set up before turning plant online" |
| §6 as-left | "Valve left in closed position." on every valve report |
| §7 typed values | Nameplate amps vs. actual amp draw on every pump report; one nameplate is dual-voltage (`24.8/12.4`), which a naive numeric parse would read as a single value |
| §7 nameplate | Make, model, serial, HP, RPM, voltage, **service factor**, phase, nameplate amps — service factor was missing from the ADR's field list and should be added |
| §8 settings | Spans, ranges, channel assignments, a delay in seconds, and a logging interval ("data entry every 2 min") — the exact field list |
| §9 signatures | Contractor countersignature blank on four reports; one "customer" signature signed by the equipment supplier rather than the GC or owner |
| §10 continuation | One vendor's form has literal "Follow-up assignment necessary for:" and "Follow-up order issued for:" fields; the MBR supplier's action items carry across three sequential visit reports |
| §11 duplicate serial | One pump serial appears on two reports with different motor and gear-reducer serials; one "unit position" value appears on all four |
| §11 asset vs. position | A pump found with a frozen impeller, removed, rebuilt with new seals, and re-installed — mid-startup, between the clean-water and seeding phases. Open question #12 is live on a real job, not hypothetical |
| §12 gates | A signed, dated "Clean Water Pre-Run Check list" with Y/N + note per line — the gate form exists and someone already signs it |

One further confirmation worth stating plainly: the phase sequence in the source
is **dry checks → I/O checks → clean water / wet-mech → seeding → performance**,
with seeding recorded as "To be Scheduled." That is ADR 0018 §1's premise, and
the I/O check report maps cleanly onto `point_to_point` + `loop_check` while the
dry check report maps onto `installation`. Open question #11 can probably be
closed in favour of the two additive phases.

---

# Third reading — eleven items not previously raised

The third reading (2026-08-04, from rendered pages) produced the three
corrections recorded at the top of this file, and eleven items the first two
passes did not reach. **None of them overturns anything in ADR 0018.** Four are
structural and carry to the ADR as open questions 9–12; seven are refinements to
decisions already made. All are ordered by value, and all are **open**.

## R9 — An accepted operating restriction has no home in the model · **DECIDED — `restrictions` record adopted (ADR §13)**

**Resolved by the maintainer, 2026-08-04: option (b), a `restrictions` record.**
ADR 0018 gains §13. The comment below stands as written; the only thing worth
adding after the fact is that the decision turned on the boundary against punch
items — a restriction is a **condition of acceptance nobody owes work on**, and
putting it on the punch list would have made the open-punch count unreliable.

**ADR location:** §4 result vocabulary, §6 punch items, §7 typed values.

A blower type in the source exhibits a mechanical fault above a speed threshold.
The vendor never fixes it. Instead the controls PID is configured to cap the
speed below the threshold, and the system is accepted that way. The clean-water
checklist line "blower PID loop is tuned and consistent" is marked **pass**, with
the fault and the cap described in its note.

This is not any of the five states:

- **not `fail`** — the system is accepted and running;
- **not `pass`** — the equipment is defective and the acceptance is conditional;
- **not a punch item** — nobody intends to remove it, and it appears on no punch
  list in the package;
- **not `deferred`** — no later phase clears it, ever.

It is a **permanent operating limit created at commissioning**, and its whole
value is downstream: an operator who raises that blower above the threshold in
year three reproduces a fault whose diagnosis exists only in a note cell inside
a submittal PDF. The restriction is also recorded **inconsistently** in the
source — one page names one threshold, another page three pages away names a
different one — which is what an unstructured fact looks like after two
transcriptions.

Two more instances in the same package: a phase run to completion with one of a
redundant pump pair unavailable (a *temporary* restriction, correctly scoped to
that phase), and a confirmed shutdown limit recorded as a checklist note.

**Why this is hard here.** ADR 0018's Consequences declare five derived states
the legibility ceiling and "a hard stop: no sixth state without retiring one."
So this cannot be state number six.

**Options:** (a) accept the R3 answer — a `pass` carrying a note plus a linked
punch item renders differently — but the defining feature here is that there
*is* no punch item and there never will be, so R3's derivation never fires;
(b) a `restrictions` record attached to tag or system, with a typed limit
(value + unit + comparison, reusing §7's shape), the check that established it,
and a required narrative — derived into the standing plate and into turnover,
no new `result` state; (c) a punch item with a `wont_fix` / `accepted`
resolution, reusing §6's ball-in-court plumbing.

**Recommendation:** (b). The limit is *data* — it has a number, a unit, and a
comparison, and §7 already defines exactly that shape. Option (c) abuses the
punch list to hold something that is not outstanding work, and would make
"open punch items" an unreliable count. This is the largest genuine gap the
third reading found: the model can say a thing failed, and can say it passed,
and cannot say **"it passed, and here is the permanent condition of that
pass."**

## R10 — Template revision is not captured on the instance · *open · ADR open question 10*

**ADR location:** `checklist_templates` / `checks`.

The system supplier's clean-water checklists carry a **revision marker in the
form header**. Someone at that vendor already understood that a completed
checklist is meaningless without knowing which version of the questions was
asked.

`template_version`, `template_rev`, and `revision` appear nowhere in ADR 0018 or
`ARCHITECTURE.md`. A check relates to a template, and templates are edited. If a
line is added, reworded, or removed after a check is signed, the frozen record
of *answers* no longer reliably reproduces the *questions* — which is precisely
the failure mode the append-only ledger exists to prevent, one level up.

**Options:** (a) a monotonic `version` integer on `checklist_templates`, bumped
on any change to its items, copied onto `checks` at capture; (b) freeze the
resolved template items into the check itself at capture (heavier, fully
self-contained, and closest to what the turnover manifest needs anyway);
(c) forbid editing a template that has signed checks, forcing a new template.

**Recommendation:** (a) as the cheap correct floor, and check whether the ADR
0010 turnover manifest already implies (b) — if the manifest freezes item text,
the version integer is the index and (b) is already half-built. Worth deciding
before M5, because retrofitting a version onto already-signed checks is not
possible.

## R11 — Vendor evidence is many-to-many with tags, not one-to-one · *open · ADR open question 11*

**ADR location:** §5, `service_visits` (tag XOR system) + `attachments`.

§5 treats a vendor report as evidence for one visit against one subject. The
source does not behave that way. The **unit of record differs per vendor**:

| Vendor | One document covers |
|---|---|
| Rotary-lobe pump vendor | one machine (four documents for four machines) |
| Valve-actuator vendor | one valve |
| Blower vendor | **two machines**, as two numbered operations inside one service order, under one signature block |
| Submersible pump vendor | **up to four positions**, in parallel columns on one two-page form, with one comment block and one signature line |
| System supplier | **every tag touched that week** — one document per visit |

So "attach the vendor's report to the tag" is not a 1:1 operation. One PDF is
the evidence for two tags; another for three; another for thirty. `tag XOR
system` cannot express "this report proves these four tags," and splitting one
PDF into four `service_visits` records fabricates four visits that did not
happen.

Worse for the reader: even when the attachment is correct, nothing says **which
part** of a thirty-tag document is the evidence for a given tag.

**Options:** (a) leave `service_visits` at one subject and add a
`service_visit_tags` join carrying an optional `page_range` per tag;
(b) allow the visit to stay single-subject but let `attachments` carry a
`page_range` + repeated tag references; (c) accept duplication — one visit
record per tag, all pointing at the same attachment digest, with a shared
`client_token` marking them as one real visit.

**Recommendation:** (a). It keeps `service_visits` honest about what a visit
*was* (one vendor, one trip, one report) and puts the many-to-many where it
belongs. (c) inflates the visit count, which is a number the schedule and
backcharge arguments actually use.

## R12 — `service_visits.phase` is nullable; the source argues it must be required · *open · ADR open question 12*

**ADR location:** §5 field table — `phase` · select (phase enum), **nullable**.

The single most important qualifier on four of the source's vendor reports —
that the runs were **clean-water** runs and not process runs — exists only as a
five-word free-text note in a "start-up notes" box. The form has no phase field.
Strip that sentence and the four reports read as unconditional equipment
acceptance.

That is the argument for *required*, not nullable: the vendor form will never
supply the phase, so a human must assert it at capture, and a nullable field on
a data-entry screen is a field that does not get filled. An unphased vendor
visit cannot be placed in the §3 rollup at all — it lands in no column.

**Counter-argument to weigh:** some visits genuinely serve no single phase (a
warranty callback, a sales visit). `informational` already exists as a
`result`, so the honest shape may be **required unless `result =
'informational'`**.

**Recommendation:** required, with the `informational` escape. Cheap, and it is
the difference between a rollup that is complete and one that is quietly
missing rows.

---

The remaining seven are refinements to decisions already made, not new
structure. Recorded so they are not rediscovered a fourth time.

## R13 — Tag matching must normalize before it warns · *open*

**ADR location:** §11, "Non-existent tag warning."

§11 resolves a typed tag against the register and warns on a miss. In the source
the same physical device is written by the actuator vendor with one prefix and
no zero-padding, and by the system supplier with a different prefix and
zero-padding — and elsewhere a float tag is written with the hyphen omitted
while every sibling float on the same page is hyphenated.

Against an exact-match register check these are all "non-existent tag" — which
is technically true and practically useless, because the tag *does* exist and
the reader is being asked to spot a one-character difference. **Recommendation:**
normalize (case, separators, zero-padding) before matching, and when the
normalized form hits, offer it as a **candidate match** ("did you mean …?")
rather than reporting a miss. Prefix differences should be surfaced, never
auto-corrected — a `XV`/`FCV` disagreement is a real question about what the
device is.

## R14 — Three import-QC signals the source hands over for free · *open*

**ADR location:** §5 import path, §11 validation.

1. **Byte-identical narrative across sibling records.** The blower service
   order's "additional comments" block is the *same string* for both machines,
   and states its conclusion twice inside the one comment. Identical per-unit
   findings are either a paste or a genuine coincidence, and the reviewer should
   be told which they are looking at. This sits directly beside **R6** (preserve
   the narrative verbatim): preserve it *and* flag when it is duplicated.

   **Confirmed at a much stronger magnitude by page rendering.** The pump
   vendor's four checklist pages are **byte-identical renders** — same twenty
   rows, same seventeen marks, same initials, same three blanks — for four
   physically different pumps with different serial numbers and different
   measured amp draws. Because the **Date column is blank on all twenty rows of
   all four**, the one field that could distinguish them is also absent. On
   paper, "four units genuinely checked identically" and "one page copied four
   times" are the same document. Under a per-tag ledger they cannot be: each
   check is its own record, against its own subject relation, with its own
   immutable `created` timestamp. That is the single cleanest argument in the
   whole source for the per-tag-per-phase model — not that the paper is
   dishonest, but that the paper **cannot express the difference**.
2. **A field constant across an entire import.** One vendor's "unit position"
   reads the same value on all four machines, which are in different rooms doing
   different jobs. A column with one distinct value carries no information and
   usually means the form field went unused — cheap to detect, and it stops a
   meaningless value being imported as though it located something.
3. **Re-submitted content.** Two pages of one field report are bound into the
   package a second time, *after* the later report that superseded them, with
   nothing marking the repeat. An import path should recognize the same content
   arriving twice rather than ingesting it as new evidence.

All three are warnings, never blocks, consistent with §11.

## R15 — A third meaning of N/A: satisfied by other evidence · *open*

**ADR location:** §4 `na_reason`; extends **R5**.

R5 splits N/A into structural (a property of the equipment subtype) and
situational. The source has a third: a line marked **N/A whose note says the
function works, verified another way** — the specific test named by the line was
not run because a different, adjacent test already demonstrated it.

That is not "does not apply." It is "applies, and is satisfied by evidence
elsewhere" — which for a turnover reader is nearly the opposite conclusion.
**Recommendation:** if R4's reason vocabulary lands, this is one more value in
it (`satisfied_by_other_evidence`), ideally carrying a pointer to the check or
line that did the demonstrating. Without the pointer it is just a nicer-sounding
blank.

## R16 — Nothing flags a tag with phase evidence and no vendor report · *open*

**ADR location:** §5 turnover vendor report index, §11 validation.

§11 validates the tags that *appear*. The source's gap is the inverse: one valve
is confirmed in the clean-water phase record with **no vendor inspection report
anywhere in the package**, while six sibling valves each have one. Nothing
notices. Symmetrically, three of the six valve reports that *do* exist cover
tags absent from the phase record.

The vendor report index (§5) already assembles per-tag rows; the QC is the empty
cell in a column that is populated for every sibling. **Recommendation:** a
turnover QC line — "tags in scope with no vendor report" and "vendor reports for
tags not in scope" — as a warning pair. Both directions are findings.

## R17 — Where the limit comes from when the vendor form omits it · *open*

**ADR location:** §7, "limits stored beside the reading."

§7 puts the acceptance limit next to the reading, which is right. The source
shows the limit is frequently **not on the vendor's form at all**: one pump
report captures only a maximum for flow and both suction and discharge
pressure — minimum and normal are blank on all four copies — along with blank
fields for solids content and daily run hours. The design envelope the form asks
for is simply not filled in.

So a captured reading often has no vendor-supplied limit to sit beside, and the
limit has to come from the submittal, the spec, or the nameplate. **This is not
an argument against §7** — it is a question about where `template_items` gets
its limit when the vendor supplies none, and whether a value line with no limit
should be visibly marked as "recorded, not evaluated" rather than looking like a
pass. Recommendation: the latter, at minimum.

## R18 — A gate is not linked to the punch items that satisfy it · *open*

**ADR location:** §12.

§12 models a phase-entry gate as a check with a system subject — correct, and
the source confirms the artifact exists and is signed. What it does not model is
that a gate condition and a punch item are frequently **the same fact recorded
twice**: a tank-cleanliness item appears as a contractor punch item at one
phase, and again six weeks later as a line on the phase-entry gate for the next
phase, with nothing connecting them.

**Recommendation:** allow a gate line to reference the punch item(s) that
satisfy it, so closing the punch item visibly moves the gate. Without the link
the gate is re-verified by hand and the punch list is a parallel universe. Low
cost — `punch_items` and `check_items` both already exist — and it is what makes
the gate a *derivation* rather than a second checklist.

## R19 — External evidence needs a typed pointer, not prose · *open*

**ADR location:** §5, attachments; §10.

The most load-bearing evidence in the source's first phase is not in the
package. Three separate observations end with photographs "uploaded to" the
equipment supplier's own file share, and the specification control narrative
that governed the logic testing is referenced as "included with this report"
without being included. §5 already flags a visit with no attachment, which is
the right instinct — but the honest state here is not "no evidence," it is
"evidence exists, held by another party, unnamed."

**Recommendation:** a typed external-evidence reference (custodian, location,
description, date) so the pointer is structured rather than a sentence. It does
not make the evidence available, but it makes the gap **countable** and tells a
future reader who to ask. A flag that says "missing" when the truth is
"elsewhere" trains people to ignore the flag.
