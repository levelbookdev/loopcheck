# docs/tasks/ — the execution queue

Each file here is a **self-contained implementation prompt** for one focused
coding session. A competent but literal coding model must be able to complete a
task correctly with only the repository and that one file — no memory of the
planning conversation, no maintainer on call. If a task can't be done that way,
it's a bug in the task; fix the task, don't guess.

## How to use this directory

Read `CLAUDE.md` → "Execution workflow" first. In short:

1. Pick the **lowest-numbered task whose `Status:` is not `DONE`** (respect
   `BLOCKED` reasons — skip to the next actionable one).
2. Do it fully, to its acceptance criteria. Do not exceed its scope.
3. Update its `Status:` line. Update `docs/ROADMAP.md` milestone checkboxes if
   the task closes them out.
4. Commit (authored as the maintainer — no AI trailer; see `CLAUDE.md`).

If mid-task you find the task conflicts with the code, **stop, describe the
conflict, and propose a task/roadmap edit** — do not improvise around it.

## Numbering

Numbers encode order, in tens (`010`, `020`, …) so tasks can be inserted between.
A higher number never runs before a lower one unless the lower is `DONE` or a
`BLOCKED` reason explicitly says it can be skipped.

- `010`–`070` — **M1 Harden & Reconcile** (→ v0.9.0) — closed at v0.9.0.
- `080`–`140` — **M2 Shutdown Runbooks + Punch List** (→ v0.10.0). `080` (design)
  and `090` (punch list) are DONE; ADR 0019 was accepted 2026-08-04 and the
  Phase 4 build tasks `100`–`140` are now queued in order: migration → seed
  loader → planning UI → execution UI → board + report.

## Status values

`Status: TODO | IN PROGRESS | DONE | BLOCKED (reason)`

The status line is the top line of every task file after the title. A future
session finds the next task by scanning these alone.

## Task file template

```
# NNN — <short title>

Status: TODO
Milestone: <Mx name> (<tag>)
Depends on: <task numbers, or "none">

## Context
Why this task exists, what came before, links to ROADMAP/DECISIONS/ADRs.

## Scope
Files/modules to create or touch — and explicitly what to LEAVE ALONE.

## Specification
Concrete requirements, with examples of expected inputs/outputs where useful.

## Acceptance criteria
A checklist the agent verifies itself, including which tests must exist and pass.

## Guardrails
Known pitfalls; settled decisions (link DECISIONS.md); things not to "improve".

## Definition of done
Build/tests pass, docs updated, committed with the described message.
```
