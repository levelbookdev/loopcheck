# ADR 0019 — Shutdown runbook execution: a planned outage as an append-only step-event ledger

**Status:** **accepted** (2026-08-04) · **Date:** 2026-08-04

> **Accepted 2026-08-04** by maintainer decision. The six interviewed decisions
> and the four §7 assumptions are now normative, and the build tasks
> (`100`–`140`) are written against them.
>
> **Open question 3 resolves on acceptance.** It asked whether a `skipped` event
> kind should exist at all, or reuse ADR 0018 §4's `not_performed` reason
> vocabulary — and noted the coupling risk that ADR 0018 was still Proposed.
> **ADR 0018 was accepted the same day**, so the coupling is gone and the
> recommendation applies cleanly: **there is no `skipped` kind.** A step not
> performed is a `not_performed` event carrying
> `conditions_unavailable` · `access_blocked` · `equipment_unavailable` ·
> `satisfied_by_other_evidence` · `out_of_scope` · `other`. One vocabulary, not
> two ways to say the same thing. Task `100` implements it that way.
>
> **Still open:** questions 1 (trim the template side), 2 (is `project` +
> optional `system` subject enough) and 4 (T-0 anchoring for pre-window steps).
> Question 1 is the only one that changes the migration and task `100` calls it
> out as the first thing to settle.

**Design only — no migration, no UI in this ADR** (task
[`080`](../tasks/080-phase4-shutdown-runbook-design-adr.md)). The build tasks are
written after this is Accepted, per the roadmap-maintenance workflow in
`CLAUDE.md`.

Phase 4 / **M2** ([ROADMAP.md](../ROADMAP.md)). The six structural decisions
below were taken in a domain interview with the maintainer on 2026-08-04; four
smaller ones follow from established patterns and are marked as assumptions for
correction.

## Context

`seed/shutdown_runbook_tie_in.json` has been captured domain knowledge since
Phase 1, deliberately **not** loaded into the database. `CLAUDE.md` and
`ARCHITECTURE.md` §7 both record why: a flat checklist cannot hold what makes a
runbook a runbook, and a flattened copy would silently diverge from the real
thing.

Reading the file, the specifics are sharper than "offsets, hold points, roles":

- **22 steps in three groups** — 8 `pre_window`, 12 `window`, 2 `post_window`.
- **Two different offset representations.** Pre- and post-window steps carry a
  human label (`T-14d`, `T+24h`). Window steps carry `planned_offset_min` and
  `planned_duration_min` as integers from T-0. That is not sloppiness; it is the
  right granularity for each. At T-14d, minutes are noise. Inside a negotiated
  window, minutes are the entire subject.
- **Hold points** — `hold_point: true` on steps like "shutdown request submitted
  and window negotiated" and "verify zero pressure at work point."
- **A role table**, not role strings: `role_key`, `title`, and `notify_on`
  (`approval`, `t_minus_24h`, `execution_start`, `each_hold_point`, `restored`).
  The roles are water-district specific — `district_operations`, `inspector`,
  `contractor_super`, `contractor_pm`.
- **Four contingencies** as `trigger` / `action` pairs, which are not steps at
  all: "isolation valve fails to hold" → "stop before cutting; secondary
  isolation, line stop, or abort," with the abort decision named as a joint call.
- **`tag_ref` on steps**, nullable — a step can point at a specific valve.

A tie-in shutdown is also the highest-stakes thing this product touches. It
happens once, at night, on a live main, with a district operator and an
inspector standing there and a negotiated window that costs real money to
overrun. The record of what actually happened, minute by minute, is the
deliverable.

## Decision

### 1. Hold points warn; they never block

**An unsatisfied hold point renders prominently and enters the shutdown's
derived standing. It never prevents anyone from logging any step.**

This is the LOTO doctrine (ADR 0007) applied to the second module that could
plausibly claim authority, and it is the same call already made for phase-entry
gates ([D24](../DECISIONS.md#d24--phase-entry-gates-warn-they-never-block)). The
app records; it never authorizes. A crew that proceeds past an unsatisfied hold
point has made a decision — the ledger's job is to record visibly that they did,
not to stand in the doorway at 2 AM when the authorizer is unreachable.

A hold point may **optionally** carry a `signatures` record (ADR 0010) bound to
its release event, for evidentiary weight. Optional, never constitutive: a
required signature is a block wearing a different hat.

**Rejected: blocking until signed.** It makes the app part of the authorization
decision, which the rejected-ideas list forbids, and it strands the crew exactly
when a shutdown is least able to absorb delay.

### 2. Both offset forms are kept

`offset_label` (text) carries the calendar-scale `T-14d` / `T+24h`; nullable
`planned_offset_min` and `planned_duration_min` (integers) carry window-scale
timing. The source's distinction is preserved rather than normalized.

**Rejected: normalizing everything to minutes.** `T-14d` → `-20160` invents
precision nobody has (the pothole happens that week, not at that minute) and
needs a rendering layer to turn it back into something a human reads.
**Rejected: labels only.** It gives up planned-vs-actual clock tracking inside
the window, which is the most valuable output the module produces.

### 3. Execution is an append-only event ledger

`shutdown_step_events` — one append-only record per thing that happened, with a
`kind`: `started` · `completed` · `held` · `released` · `aborted` ·
`resumed` · `not_performed` · `contingency_invoked`. A step's state and the
shutdown's standing are **derived** from the events; nothing stores a status.

*(This list said `skipped` when drafted. On acceptance, open question 3 resolved
in favour of reusing ADR 0018 §4's vocabulary rather than minting a second way
to say the same thing: a `not_performed` event carries a
`not_performed_reason` from the pinned set. See the acceptance note above.)*

This mirrors `loto_events` exactly, and it earns its keep in three places a
one-record-per-step design would not:

- **A step that started and has not finished** is the state you most need
  visible mid-window, and it has a natural home.
- **Abort and resume** are events, not special cases.
- **A mis-logged step is corrected by appending**, never by editing — the same
  guarantee as `checks`.

**Rejected: one record per step written at completion** (an in-progress step has
nowhere to live). **Rejected: the ADR 0012 open→resolve pair** (designed for a
test awaiting an outcome, not for step-by-step execution with holds and aborts;
it would need `pending` to mean two different things).

### 4. Roles are a per-project registry

`shutdown_roles`: `project` · `role_key` · `title` · `contact_name` ·
`contact_phone` · `notify_on`. Steps reference a role; the shutdown resolves it
to the project's record.

The runbook's roles carry a **title and a contact** that an enum cannot hold,
and at 2 AM the thing you actually need is the district operator's phone number.
The roles are also district-specific (`district_operations`, `inspector`) and do
not map onto the punch-item ball-in-court vocabulary (ADR 0018 §6), which has no
equivalent — so reusing that enum would force a bad fit in both directions.

**Rejected: free text on the step** (makes "who owes the next step"
unqueryable, which is most of the coordination value). **Rejected: reusing
`punch_items.assigned_party`.**

### 5. Contingencies are invocable, and the invocation is recorded

`shutdown_contingencies` holds the template's `trigger` / `action` pairs as
reference data — readable beside the steps at 2 AM. **Invoking one appends an
event** (`kind: "contingency_invoked"`, with the contingency, the offset, who
decided, and a note).

The mid-window judgment call — take secondary isolation, set a line stop, or
abort and restore — is the single highest-stakes decision in a shutdown, and
today it survives only in somebody's memory. Recording it costs one event.

### 6. Abort is an event; restoration continues in the same shutdown

`aborted` is an event kind carrying the reason and the decider. The shutdown
**stays open**, its restore steps are logged normally, and standing derives
*aborted — restoring* then *aborted — restored*.

This matches the runbook, whose abort contingency explicitly ends in restoring
the main **within the same window**. Splitting restoration into a second
shutdown record would fracture one night's work across two records and make
"what actually happened in that window" a join.

**Rejected: abort terminates the record.** **Rejected: no first-class abort** —
it cannot distinguish a deliberate abort decision from a crew that simply
stopped logging, and those are opposite facts.

### 7. Assumptions taken from established patterns — correct these if wrong

These four were not interviewed; each follows from a decision already made
elsewhere. They are called out so the maintainer can overrule cheaply.

- **Template and instance are separate, and the step text freezes onto the
  event.** `shutdown_templates` / `shutdown_template_steps` mirror
  `checklist_templates` / `template_items`, loaded from `seed/` by a loader (the
  library exists in exactly one place). The executed event freezes a copy of the
  step description and role — the `check_items.prompt` pattern — so a template
  edited next year cannot rewrite what a crew executed, **and** the instance step
  list stays editable during planning without any enforcement gymnastics.
- **`tag_ref` is a text hint on the template and a real relation on the
  instance.** A seeded template is project-agnostic and cannot hold a `tags`
  relation; the generic hint ("isolation valve") resolves to a real tag when the
  shutdown is planned for a specific system. Unknown tags warn, never block
  (ADR 0018 §11).
- **Auth follows ADR 0011.** Logging a step event is **accountless** — hard
  constraint #1, and this is a glove at 2 AM in the rain. Creating and planning
  shutdowns, templates, and roles are office writes requiring an account. An
  optional hold-point signature requires auth (ADR 0011 §7).
- **`notify_on` is stored and never acted on.** Core records who *should* be
  notified at which trigger; core does not send. Notification is hosted/paid
  tier, the same line `CLAUDE.md` already draws for warranty expiry alerts —
  "core stores facts, not alerts."

### Safety framing — non-negotiable

The shutdown module **records and coordinates. It never authorizes.**

- No interlocks, no permission-to-proceed, no "safe to cut" indicator, no green
  all-clear. The written shutdown plan, the district's own procedures, and the
  people on site are the only authority.
- A hold point is a *record that authorization was required and what happened*,
  not a gate the software enforces.
- The app must never be usable as evidence that it is safe to cut a live main.
  Any feature request that moves it toward being part of the go/no-go decision
  gets a no, and lands in `ARCHITECTURE.md`'s rejected list.
- Displayed shutdown state carries the same staleness honesty as LOTO where it
  is used to coordinate live work.

### Derived status, never stored

- **A step's state** = its latest event (`started` → in progress, `completed` →
  done, `held` → held awaiting release).
- **A shutdown's standing** = a fold over its events: not started → in window →
  aborted-restoring → aborted-restored → complete.
- **Schedule variance** = actual event timestamps against `planned_offset_min`,
  computed at render.
- **Unsatisfied hold points** = steps with `hold_point: true` and no `released`
  event — surfaced, never enforced.

No `status` column anywhere (hard constraint #4).

### The later UI bar, recorded here as a constraint

Already decided (`CLAUDE.md`, ROADMAP M2): the execution view is **zero
navigation taps, glove-sized touch targets**. It will be used at 2 AM, in rain,
under schedule pressure. Recorded here so the build task inherits it; **no UI is
built in this ADR.**

## Consequences

- **Seven new collections** — `shutdown_templates`, `shutdown_template_steps`,
  `shutdown_contingencies`, `shutdown_roles` (template/reference, small, seeded)
  and `shutdowns`, `shutdown_steps`, `shutdown_step_events` (instance and
  execution). That takes the committed schema from **24 to 31**, the largest
  single addition since Phase 1, and it is a contract change requiring the
  ADR-0003 version bump alongside the M3 reconciliation (D12). Whether the
  template side can be trimmed is an open question below.
- **The runbook JSON finally loads**, by a seed loader, into collections that can
  hold it without losing offsets, hold points, roles, or contingencies — which
  is the condition `ARCHITECTURE.md` §7 set for loading it at all.
- **`shutdown_step_events` is append-only** (`updateRule: null`,
  `deleteRule: null`), joining the ledgers listed in the security posture.
  `shutdowns` and `shutdown_steps` are planning records with a lifecycle
  (editable while planning), like `punch_items` — and the *events* are what make
  the record trustworthy, so nothing is lost by leaving the plan editable.
- **The post-shutdown report is a free deliverable.** Post-window step 30 in the
  runbook is literally "post-shutdown report generated (planned vs. actual, step
  timestamps, problems logged) and distributed." A print-friendly HTML view is
  core; a compiled, branded report is sidecar work (ADR 0003).

## Open questions for the maintainer

1. **Can the template side be trimmed?** Four of the seven collections are
   template/reference. `shutdown_contingencies` could fold into
   `shutdown_template_steps` behind a `kind` discriminator, at the cost of a
   table where half the columns are null for half the rows. Recommendation: keep
   them separate — the shapes genuinely differ (no seq, no offset, no hold point
   on a contingency) — but it is worth one look before the migration.
2. **Does a shutdown need a subject beyond `project` + `system`?** A tie-in is
   arguably against a *segment* or a location rather than a system. The check
   subject rule (tag XOR system XOR service XOR segment) is not being extended
   here; a shutdown references `project` and an optional `system`. Confirm that
   is enough for a real tie-in.
3. **Should `skipped` be a step-event kind at all?** It overlaps ADR 0018 §4's
   `not_performed` reason vocabulary. Recommendation: reuse that vocabulary on
   the event rather than minting a second way to say the same thing — but ADR
   0018 is still Proposed, so this couples the two.
4. **Multi-day pre-window steps and the T-0 anchor.** `planned_offset_min` is
   relative to `window_start`. Pre-window steps use labels precisely because
   they are not anchored that way. Confirm no one needs `T-14d` computed into a
   real date on a project calendar — if they do, that is a scheduling feature and
   probably a no (LoopCheck is not a scheduler).
