# 080 — Phase 4 design: shutdown runbook collections + execution model (ADR first)

Status: BLOCKED (do not start until M1 tasks 010–070 are DONE; and this is a
design/interview task requiring the maintainer — see Context)

Milestone: M2 Shutdown Runbooks + Punch List (v0.10.0)
Depends on: 070 (all of M1)

## Context

Phase 4 is the first new feature after hardening: an execution UI for the tie-in
shutdown runbook captured in `seed/shutdown_runbook_tie_in.json`. That JSON holds
things a flat checklist cannot — **offsets, hold points, and roles** — which is
exactly why `CLAUDE.md`'s seed rules say it is *not* loaded into the DB and
"waits in `seed/` for Phase 4's real shutdown collections."

This task is **design only**: produce an accepted ADR defining the shutdown
collections and the append-only execution model **before** any migration. It is
deliberately separated because the build tasks depend on domain decisions this
planning cycle intentionally did **not** guess (the maintainer is the domain
expert; `CLAUDE.md`: "do not guess at industry details; ask"). The build tasks
(migrations, execution UI, board) are written **after** this ADR is accepted, via
the roadmap-maintenance workflow in `CLAUDE.md`.

**Why BLOCKED:** it must not start before M1 is done (trust-first, D2), and it
requires a domain interview with the maintainer about the shutdown execution
model. When M1 is `DONE`, the agent's first M2 session presents design questions
to the maintainer, then writes the ADR.

## Scope

**Create:**
- `docs/adr/0018-shutdown-runbook-execution.md` (next free ADR number — verify it
  is still `0018` at execution time; do not reuse a taken number).
- After acceptance: append the follow-on build tasks (`100`, `110`, …) to
  `docs/tasks/` using the template in `docs/tasks/README.md`.

**Leave alone (in this task):**
- No migration, no schema, no UI, no seed change. Design and ADR only. Building
  before the ADR is accepted violates the docs-as-code rule (ADRs are written
  *before* the migration).

## Specification

1. **Interview the maintainer first** (present concrete options, don't guess):
   - How a shutdown is modeled: one `shutdowns` record per planned outage, with
     ordered `shutdown_steps`? How do **offsets** (timed steps relative to a T-0)
     and **hold points** (a step that blocks progress until signed/authorized)
     map to records?
   - **Roles**: are roles free-text on a step, or a small controlled set? Who is
     recorded as executing/authorizing a step, given the accountless field tier
     vs. auth for signoff?
   - Append-only semantics: executed steps are never edited (like checks) — an
     amendment is a new record. Confirm the correction model for a mis-logged
     step.
   - The safety boundary: the shutdown module **records and coordinates; it never
     authorizes**. It must not become an interlock or a "safe to proceed"
     authority (same doctrine as LOTO, `ARCHITECTURE.md` rejected list). Confirm
     the honesty framing for hold points.
   - Derived vs stored: shutdown progress/standing must be **derived** from the
     step ledger, not a stored status field (constraint #4).
2. **Write ADR 0018** capturing: the collections and their fields, the
   append-only enforcement (`updateRule`/`deleteRule: null` where steps are
   evidence), how offsets/hold points/roles are represented, the derived-status
   approach, the auth posture, and the safety-framing (records, never
   authorizes). Document the real rationale and the rejected alternatives.
3. **Do not exceed design.** The migration and UI are separate, later tasks.

## Acceptance criteria

- [ ] A domain interview with the maintainer happened and its decisions are
      recorded in the ADR (not assumed).
- [ ] `docs/adr/0018-shutdown-runbook-execution.md` exists, is marked `accepted`
      (or `proposed` awaiting the maintainer's acceptance), and defines the
      collections, append-only model, offset/hold-point/role representation,
      derived status, auth posture, and safety framing.
- [ ] The ADR explicitly states the module records and coordinates but never
      authorizes (no interlocks / "safe to proceed" authority), consistent with
      the LOTO doctrine.
- [ ] Follow-on build tasks (`100`+) are appended to `docs/tasks/` **only after**
      the ADR is accepted, using the standard template.
- [ ] No migration/schema/UI/seed changed in this task.

## Guardrails

- **ADR before migration** — non-negotiable (`CLAUDE.md` docs-as-code rule #1).
- **Do not guess domain specifics.** If the maintainer is unavailable, stay
  `BLOCKED` and surface the questions; do not invent a shutdown model.
- Honor the UI bar already decided for the eventual execution view: zero
  navigation taps, glove-sized touch targets (used at 2 AM, in rain) — record it
  in the ADR as a constraint on the later UI task, but do not build UI here.
- The shutdown runbook JSON stays in `seed/` and is loaded only when the real
  collections exist — do not force it into the flat-checklist engine.

## Definition of done

- ADR 0018 written and (ideally) accepted; build tasks queued; no code changed.
- `Status:` updated (`DONE` when the ADR is accepted and build tasks are queued;
  otherwise `BLOCKED`/`IN PROGRESS` with the reason).
- Committed as the maintainer, message e.g.:
  `docs(adr): 0018 shutdown runbook execution model (design, pre-migration)`.
