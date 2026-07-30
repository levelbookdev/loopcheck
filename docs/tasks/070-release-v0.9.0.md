# 070 — Release plumbing: CHANGELOG, tag v0.9.0, finish auth checkpoint 6

Status: DONE (2026-07-30 — v0.9.0 tagged, CHANGELOG written, M1 closed)

## Outcome

`CHANGELOG.md` created with the v0.9.0 entry; annotated tag `v0.9.0` cut; M1
definition-of-done boxes ticked.

Two of this task's steps were **already satisfied** and are recorded rather than
re-performed:

- **`SESSION-NOTES.md` was already deleted** in commit `b42748f`, the final
  commit of the auth-lockdown effort, as that file's own rules required.
- **The temporary VPS `basic_auth` gate has already been removed** (task `067`,
  2026-07-30). This task expected to hand that to the maintainer as a reminder;
  instead it was done — but only after discovering the deployment was 23
  migrations behind and would have been world-writable the moment the gate came
  off. The gate was restored within ~2 minutes, the droplet was upgraded, and the
  gate was retired properly afterwards. So the release notes record it as done,
  not pending.

**On the "do not tag if an M1 DoD item is unmet" rule:** the ARM-VM validation
item was unmet, but only because the maintainer moved task `060` to M3 the same
day. Leaving the checkbox in M1 would have made M1's definition require something
no longer in its scope. The checkbox was moved to M3 alongside the task, and the
M1 item was narrowed to what M1 actually delivered — honest topology labelling
and a record of what ARM verification has and has not been done. The full
completed-run requirement still exists, in M3.
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 010, 020, 030, 040, 050 (060 deferred to M3, 2026-07-30 — no longer a blocker)

## Context

The final M1 task: with the docs truthful, the tests expanded and gated by CI,
and deployment validated, cut the first tagged release. This also closes the
open auth-lockdown effort's **checkpoint 6** (SESSION-NOTES): tag a release,
remind the maintainer to drop the temporary VPS basic_auth gate, and delete
`SESSION-NOTES.md`. See ROADMAP → M1 and
[DECISIONS.md D1](../DECISIONS.md#d1--milestone-structure-and-version-mapping).

**Do this task only after 010–060 are `DONE`.** It is the milestone closeout.

## Scope

**Create/touch:**
- `CHANGELOG.md` (repo root) — create if absent; write the v0.9.0 entry.
- `docs/ROADMAP.md` — check off the M1 definition-of-done boxes that are now met;
  do not restructure the roadmap.
- Delete `SESSION-NOTES.md` (its own instructions say to delete it in the final
  commit of the auth effort).
- Git tag `v0.9.0`.

**Leave alone:**
- Application/schema/test code — this is a release task, not a feature task.
- The VPS gate itself — the agent does **not** touch the live server; it only
  reminds the maintainer (see Specification).

## Specification

1. **CHANGELOG.md.** Follow "Keep a Changelog" style. The v0.9.0 entry summarizes
   the product as first tagged: the shipped modules (core checkout ledger,
   warranty/closeout, calibration, service cutover, LOTO, signatures/turnover as
   Proposed) and the M1 hardening (auth lockdown Accepted, expanded smoke test,
   browser test, CI, ARM validation, docs reconciliation). Note that
   signatures/turnover (ADR 0010) ship but the ADR remains Proposed/frozen.
2. **Version.** Tag `v0.9.0` (not v1.0.0 — v1.0.0 is the stranger-ready
   milestone, M3). Annotated tag with release notes matching the CHANGELOG.
3. **Checkpoint 6 hand-off (maintainer actions — the agent must not perform
   these):**
   - The live VPS is gated behind a temporary Caddy basic_auth (see the
     maintainer's memory/DEPLOY notes). Now that ADR 0011 is Accepted and the
     matrix is proven, the maintainer can drop that gate and re-verify from
     outside per `docs/DEPLOY.md`. **Surface this as an explicit reminder in the
     PR/commit description and release notes; do not modify the live server.**
4. **Delete SESSION-NOTES.md** in the release commit.
5. **ROADMAP checkboxes.** Tick the M1 DoD items that 010–060 satisfied. If any
   M1 DoD item is not actually met, **do not tag** — mark this task `BLOCKED`
   naming the unmet item.

## Acceptance criteria

- [ ] `CHANGELOG.md` exists with a complete, accurate v0.9.0 entry (no aspirational
      features listed as shipped; signatures noted as Proposed/frozen).
- [ ] Every M1 definition-of-done box in `docs/ROADMAP.md` is genuinely met and
      checked; if not, the task is `BLOCKED` with the specific gap.
- [ ] `SESSION-NOTES.md` is deleted.
- [ ] An annotated `v0.9.0` git tag exists with notes matching the CHANGELOG.
- [ ] The commit/PR description contains the explicit maintainer reminder to drop
      the temporary VPS basic_auth gate and re-verify externally.
- [ ] The live server was not modified by the agent.

## Guardrails

- **Truthful release notes only** — the docs-as-code rule and `CLAUDE.md`'s
  "report outcomes faithfully". Do not list ADR 0010 signatures as an accepted
  feature; it is Proposed/frozen (D6).
- Do not tag if any test suite is red or any M1 DoD item is unmet.
- The agent must not touch production infrastructure or drop the VPS gate itself
  — that is a maintainer action, surfaced as a reminder.
- Tag `v0.9.0`, not `v1.0.0`. The version mapping is settled (D1/D19).

## Definition of done

- CHANGELOG written, M1 boxes checked, SESSION-NOTES deleted, `v0.9.0` tagged,
  maintainer reminder surfaced.
- `Status:` set to `DONE`; this closes milestone M1.
- Committed as the maintainer, message e.g.:
  `release: v0.9.0 — first tagged release after Harden & Reconcile`.
