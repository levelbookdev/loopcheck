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

**What was read.** A 24-page compiled startup submittal covering five
independent vendors, in five mutually incompatible form formats: a rotary-lobe
pump vendor's four-page start-up report (×4 units), a blower vendor's seven-page
service order (×2 units), a valve-actuator vendor's inspection reports (×6
units), an MBR system supplier's three field service reports (dry checks, I/O
checks, clean water), and three clean-water checklists including a pre-run gate.
No project, company, or person is identified in these notes.

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

Separately, one clean-water logic line is answered a hard **N** — a PID loop
not tuned — and appears in **no** action-item list in the package. A bare `fail`
with no punch item is exactly the leak the ball-in-court work is meant to close
(see R5's neighbour finding below).

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
| §4 blanks | 14 of 20 checklist items blank on **all four** copies of one vendor's pump form, including rotation direction and power consumption |
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
