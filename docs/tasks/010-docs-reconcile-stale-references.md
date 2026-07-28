# 010 — Docs reconciliation: kill the LineCheck→MainLine drift and the AGENTS.md copy

Status: DONE
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none

## Context

The repo's docs drifted because several are point-in-time snapshots that were
never updated after a decision landed. The biggest drift: **segment/linear
acceptance was moved from LoopCheck to MainLine** (maintainer decision
2026-07-18, ADR 0014 superseded — see
[DECISIONS.md D10](../DECISIONS.md#d10--segment-acceptance-is-owned-by-mainline-correction-of-record)),
but many docs still name the archived **LineCheck** as the current/future owner.
Separately, `AGENTS.md` is a full, now-stale, parallel copy of `CLAUDE.md`
([DECISIONS.md D5](../DECISIONS.md#d5--agentsmd-becomes-a-thin-pointer-to-claudemd)).

This is the first M1 task because truthful docs unblock every later reviewer and
agent. See ROADMAP → M1.

**Ground truth for this task:**
- `CLAUDE.md` is authoritative on scope/constraints. Where a doc disagrees with
  `CLAUDE.md` or the code, the doc is wrong.
- Segment acceptance → **MainLine** (a sibling repo), *not* LineCheck. LineCheck
  is archived.
- The shipped LoopCheck segment schema slice stays, frozen/maintenance-only. No
  segment UI is built. Do not remove any migration or collection.

## Scope

**Touch (correct in place):**
- `docs/product-boundary.md` — the "LineCheck" neighboring-context section and
  every table row/line assigning linear/segment/service-acceptance ownership to
  LineCheck. Repoint to MainLine per D9 (service stays in LoopCheck) and D10
  (segments → MainLine).
- `docs/architecture-status.md` — the "Segment-acceptance ownership" and
  "Service-cutover ownership" rows and any LineCheck mention.
- `docs/open-questions.md` — questions #1 and #2 phrasing that still centers
  LineCheck; align dispositions to DECISIONS.md D9/D10.
- `docs/lifecycle-map.md` — any LineCheck reference.
- `ARCHITECTURE.md` (root) — any LineCheck reference and the segment/Phase-6
  narrative; align to "MainLine owns future segment acceptance; LoopCheck schema
  slice frozen".
- `docs/adr/0014-segment-acceptance-records.md` — its **Status line** currently
  reads "superseded — ownership moved to LineCheck". Correct to MainLine, keeping
  it clearly historical/superseded.
- `AGENTS.md` — **replace its body** with a short pointer to `CLAUDE.md` (see
  Specification). Keep the file (Codex looks for it by name).

**Leave alone:**
- Any `pb_migrations/`, `pb_hooks/`, `pb_public/`, `seed/` file. This is a
  docs-only task. Do not touch schema or code.
- `docs/API.md` — already reconciled to 24 collections and MainLine; the
  collection-count and contract work is task `020`. Only fix a LineCheck mention
  here if one exists.
- Collection-count numbers and `TODO(auth)` comments — those are task `020`.

## Specification

1. **LineCheck sweep.** After the task, `grep -ri "linecheck" . --include=*.md
   --include=*.html` (excluding `.git`) must return only references that are
   explicitly historical and labeled as superseded/archived (e.g. ADR 0014's
   record of the decision path). No doc may present LineCheck as the current or
   future owner of any scope. Where a doc needs to name the future segment owner,
   it is **MainLine**.
   - Preserve the accurate distinction: **service cutover stays in LoopCheck**
     (D9); only **segment/linear acceptance** moved, and it moved to **MainLine**
     (D10).
2. **ADR 0014 status.** Keep it `superseded`, but correct the owner to MainLine
   and add a one-line pointer to DECISIONS.md D10. Do not delete the ADR.
3. **AGENTS.md → pointer.** Replace the file contents with a short note, roughly:
   - State that `CLAUDE.md` is the single source of truth for constraints,
     stack, conventions, and workflows, and that this file exists only because
     some agents look for `AGENTS.md` by name.
   - Instruct the reader to read `CLAUDE.md` first and follow it.
   - Carry over only genuinely Codex-specific notes **if any exist and are still
     true** (verify against `CLAUDE.md`; the current `.Codex/settings.json`
     reference is wrong — the enforced path is `.claude/settings.json`; do not
     copy the error forward).
   - Do not duplicate the constraint text — the whole point is one copy.

## Acceptance criteria

- [ ] `grep -ri "linecheck" . --include=*.md --include=*.html` (excluding
      `.git/`) returns only explicitly-historical/superseded references; none
      names LineCheck as a current/future owner.
- [ ] Every doc that names the future owner of segment acceptance says
      **MainLine**.
- [ ] Service cutover is still described as LoopCheck-owned and frozen (not moved
      to any sibling).
- [ ] `docs/adr/0014-*.md` status is `superseded` with the owner corrected to
      MainLine and a DECISIONS.md D10 pointer.
- [ ] `AGENTS.md` is a short pointer to `CLAUDE.md` with no duplicated constraint
      body and no false `.Codex/` path.
- [ ] No file outside `docs/`, `ARCHITECTURE.md`, and `AGENTS.md` changed; no
      migration/schema/code touched.

## Guardrails

- **Do not remove any migration, collection, seed file, or the segment schema.**
  D10 freezes it; it is not ripped out.
- Do not "improve" unrelated prose. Correct the ownership/attribution facts and
  the AGENTS.md duplication only.
- Do not change collection counts or `TODO(auth)` comments here — that is task
  `020`, kept separate so each task is reviewable.
- Keep superseded ADRs as historical records; never delete an ADR.

## Definition of done

- All acceptance criteria checked.
- This task's `Status:` set to `DONE`.
- Committed, authored as the maintainer (no AI trailer), message e.g.:
  `docs: repoint segment ownership to MainLine and reduce AGENTS.md to a pointer`.
