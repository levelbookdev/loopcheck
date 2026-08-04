# 140 — Shutdown board + the post-shutdown report (free deliverable)

Status: TODO
Milestone: M2 Shutdown Runbooks + Punch List (v0.10.0)
Depends on: 130

## Context

The runbook's own post-window step 30 is literally *"post-shutdown report
generated (planned vs. actual, step timestamps, problems logged) and
distributed."* The domain says the report is part of the work, so core produces
it. A compiled, branded version is sidecar territory (ADR 0003); the
print-friendly HTML is **free**, like `cutover.html`, `closeout-package.html`
and `punchlist.html` before it.

## Scope

**Create:** `pb_public/shutdowns.html` (project board) and the report view —
either a second page or a print mode on the board; pick one and say why in the
commit.
**Leave alone:** all schema, the planning and execution pages.

## Specification

1. **Board.** Every shutdown for a project: title, system, planned window,
   derived standing (not started / in window / aborted — restoring / aborted —
   restored / complete), and how far past its planned end it ran. Upcoming
   first, then most recent.
2. **The report, per shutdown.** Planned vs. actual for every step: planned
   offset, actual start/complete timestamps from the event ledger, variance,
   who logged it, and the frozen description as executed. Plus hold points and
   when each was released, contingencies invoked with reason and decider, the
   abort record if there was one, and any note.
3. **Everything derived.** Standing, variance, elapsed, and hold-point state all
   fold from `shutdown_step_events` at render. Nothing stored, nothing cached.
4. **Print CSS is the deliverable.** It is handed to the district; it must print
   clean on the first try. Include the as-of timestamp on the sheet, like the
   punch list and readiness matrix.
5. **CSV export**, client-side, of the step-by-step planned-vs-actual — the
   field tier can always get its record back out, never paywalled.
6. **Reads are public**; there is nothing PII-bearing here. Contact details on
   `shutdown_roles` are project data, not customer PII — but do not surface
   phone numbers on a page reachable without sign-in without checking that
   decision against `docs/API.md` first, and raise it if unclear.

## Acceptance criteria

- [ ] The board renders every shutdown for a project with a derived standing,
      and an aborted-then-restored shutdown reads correctly (not as "complete",
      not as "failed").
- [ ] The report shows planned vs. actual per step with variance, and a step
      that was started but never completed renders honestly as in-progress
      rather than being omitted.
- [ ] Hold points, contingency invocations and an abort all appear with their
      reason and decider.
- [ ] Print output fits the page and is legible in black and white; the as-of
      timestamp is on the sheet.
- [ ] CSV export contains one row per step with planned and actual columns.
- [ ] No stored status introduced anywhere; verified by grepping the migration
      set for a `status` field on the shutdown collections (there is none).
- [ ] Both suites pass; page JS within budget.

## Guardrails

- **This is the free tier.** Do not gate the report, and do not build the
  compiled/branded version here — that is the sidecar's job (ADR 0003).
- The board is a *presentation* view, exactly like `punchlist.html` and
  `readiness.html`: no schema, no writes, derived at render.
- Do not add a "shutdown health" score or a RAG status. Variance in minutes is a
  fact; a colour-coded judgment about it is the kind of derived opinion this
  product deliberately does not ship.
- Severity/colour language, if any is used, follows the existing fixed tokens.

## Definition of done

Board and report render from a seeded, executed shutdown; print verified; CSV
verified; docs updated (`ARCHITECTURE.md` §6 UI section, ROADMAP M2 checkbox,
landing page + `docs/img/` screenshots if the public site shows this);
`CHANGELOG.md` entry; committed as the maintainer, e.g.
`feat(ui): shutdown board and post-shutdown report (ADR 0019)`.
