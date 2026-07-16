# ADR 0012 — Open→resolve records: duration/reliability tests and bac-t samples as a linked pair of append-only checks

**Status:** accepted · **Date:** 2026-07-10 (accepted 2026-07-11)
Acts on the forms-library review
([docs/notes/forms-library-review.md](../notes/forms-library-review.md) §2.2)
and the Phase-6 bac-t note in [CLAUDE.md](../../CLAUDE.md). **Design capture
only — no migration, no UI in this ADR.** It fixes the shape so Phase 6 and
reliability-run templates inherit one pattern rather than two.

## Context

Almost every check LoopCheck models resolves in a moment: a tech runs a
line, it passes or fails, the record is signed and frozen. A whole class of
real startup records does **not**:

- **Duration / reliability tests.** The pump "Test Summary" tracks an
  8-Hour Test and a 7-Day Test; the commissioning plan a 10-Day Operational Test;
  the matrix a System Reliability Test. These *start*, run for a fixed elapsed
  period, and *resolve later* — pass = ran N days without a qualifying
  failure; a mid-run trip resets the clock.
- **Bacteriological samples (Phase 6).** A bac-t sample is signed at
  collection time; the result comes back from an outside lab days later and
  must attach to the original **without editing it**. A failed sample loops
  back to re-flush/re-chlorinate as new records; the failure stays in the
  ledger.

The review's insight is that these are the *same* structural problem, already
flagged for bac-t in CLAUDE.md: "a record signed at collection time that later
receives a result without mutating the original — a lab result is an appended
event, not an edit." It is not a pipeline-only edge case; it is present at
equipment and system level in every plant startup. Designing it once, now,
keeps append-only intact and stops Phase 6 from inventing a parallel mechanism.

The constraint that shapes everything: **checks are append-only**
(`updateRule: null`, `deleteRule: null`). A record that opens now and resolves
later cannot be one mutable row — the resolution has to be a *new* record.

## Decision

Model an open→resolve record as a **linked pair of append-only `checks`** —
reusing the entire existing engine (subjects, frozen prompts, witness, test
equipment, the standing derivation) rather than a parallel one:

1. **The open event** is an ordinary check whose result is **`pending`** (a
   new value in the result enum) instead of pass/fail. It is signed and frozen
   at t0: sample collected, or duration test begun. Everything that freezes
   onto a normal check freezes here (who, when, instruments, prompts).
2. **The resolve event** is a second check that carries the outcome
   (`pass`/`fail`) and points at the open event via a new relation
   **`checks.resolves`** (→ checks, optional). It is appended when the run
   completes or the lab result returns — it never touches the open record.

A **reset** (a 7-day run trips on day 5, a bac-t sample fails and the line is
re-chlorinated) is simply a *new open event* — no record is edited, the
failure and the restart both stand in the ledger.

### Why the result is `pending`, not blank/incomplete

`incomplete` already means "a check was run but not every required line was
answered" (a crew pulled off mid-checklist). A duration test that is running
correctly is a different state — it was started deliberately and is *expected*
to be open. Overloading `incomplete` would blur "abandoned" with "running."
`pending` names the open state honestly.

### What it does to derived standing

The standing fold (any pass wins, §3 of ARCHITECTURE) gains one state. For a
phase whose records include an unresolved `pending` open event:

> any pass wins → else any fail → else any **pending (unresolved)** = *running*
> → else any record = incomplete → else not started

"Running" is distinct from pass/fail/incomplete/not-started: the test is
underway, honestly neither done nor failed. Once a resolve event lands, the
normal rules apply (its pass or fail folds in). This is a small, additive
change to a derivation that is computed in one place per subject.

### Bac-t is the same shape

The lab result rides the **resolve** event: the person who receives the report
enters the resolve check (pass/fail) and attaches the lab PDF via the existing
polymorphic `attachments`. The C651 disinfection template (Phase 6) re-points
at segments; its bac-t line becomes an open event, resolved when the lab
reports. No new results mechanism — the resolve check *is* the appended result.

### Scope — design capture, built later, not ahead

Nothing is built here. The concrete additions this ADR authorizes, to land
**with the phase that needs them** (Phase 6 for bac-t/segments; a
reliability-run template whenever one is authored):

- result enum gains `pending`;
- `checks.resolves` (relation → checks, optional);
- optional `checks.test_kind` / duration metadata **only if** a real form
  needs the elapsed-days structured (the review shows a 7-day run as one
  timed record — the duration can live in the prompt/notes until proven
  otherwise; do not over-model);
- the standing derivation's "running" state;
- execution UI to open and later resolve.

## Alternatives rejected

- **Fields on the check that fill in on resolution.** Rejected — resolving by
  writing `result`/`resolved_at` onto the open check *mutates* an append-only
  record. The whole point of the ledger is that it cannot be rewritten; a
  pending check that later flips to pass in place is exactly the edit the
  immutability forbids.
- **A dedicated `check_results` / `sample_results` collection** appended to a
  check. Workable and keeps the result enum clean, but it is a second way to
  express "the outcome of a check" alongside the check's own result — two
  mechanisms for one idea, and Phase 6 would still need the standing fold to
  understand it. The linked-pair-of-checks reuse keeps one mechanism; a
  resolve check already carries sign-off, instruments, and freezing for free.
- **A separate `duration_tests` module** distinct from checks. Rejected — it
  would fork the engine (its own subjects, its own append-only rules, its own
  standing) for what is structurally a check that resolves late. The review
  explicitly wants *one* pattern for bac-t and reliability runs.

## Consequences

- Phase 6 (bac-t, segment acceptance) and reliability-run templates inherit a
  single, already-reasoned pattern; neither invents its own.
- Append-only is preserved end to end: open and resolve are both immutable
  records; corrections and resets are new records.
- The standing derivation gains exactly one state (`running`), additively.
- The turnover binder and readiness matrix (review #3) can show a running test
  honestly (a distinct cell state) rather than a misleading blank or fail.
- Deferred, deliberately: whether the resolve event needs its own
  witness/signature (bac-t: the lab is the authority, the resolve records who
  logged it; a witnessed reliability run may want a witness on the resolve —
  decide when built), and whether duration/elapsed-days becomes structured
  fields (only if a real form demands it).

## Open questions for the maintainer

1. **`pending` as a result-enum value vs. a boolean flag** (`checks.pending` /
   `checks.duration_test`). The enum value is simplest for the standing fold;
   a flag separates "kind of test" from "outcome." Recommendation: the enum
   value `pending`, since standing already switches on `result`.
2. **Does the resolve event need its own sign-off/witness**, or is recording
   who entered it (and the attached lab report) enough? Recommendation: reuse
   the normal check sign-off; add witness only if a real ITR requires the
   reliability-run resolution to be witnessed.
3. **Elapsed-time structure.** Keep the 7-day/10-day duration in the template
   prompt + notes for now, or add structured `started_at`/`elapsed` fields?
   Recommendation: prompt/notes until a form proves structured time is needed
   (avoid the over-modeling the review itself warns against).
