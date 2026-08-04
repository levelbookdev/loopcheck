# 100 — Shutdown collections migration (schema only, no UI)

Status: TODO
Milestone: M2 Shutdown Runbooks + Punch List (v0.10.0)
Depends on: 080 (ADR 0019, accepted 2026-08-04)

## Context

[ADR 0019](../adr/0019-shutdown-runbook-execution.md) is **accepted**. This task
creates the collections it defines and nothing else. The runbook JSON stays
unloaded until task `110`.

Read ADR 0019 in full before starting — especially the safety framing. Every
design question here is already answered there; if you find one that is not,
**stop and raise it** rather than inventing an answer.

## Scope

**Create:** one migration, `pb_migrations/1789000034_migration_s_shutdowns.js`
(verify `1789000034` and letter `S` are still free — `ls pb_migrations/` — and
that no concurrent session has taken them).

**Leave alone:** `seed/shutdown_runbook_tie_in.json` (task `110` loads it), all
`pb_public/` pages (tasks `120`–`140`), every existing collection.

## Specification

**Settle open question 1 first.** ADR 0019 asks whether `shutdown_contingencies`
stays its own collection or folds into `shutdown_template_steps` behind a
discriminator. The ADR recommends **keeping it separate** (a contingency has no
seq, no offset, no hold point — folding means half-null columns for half the
rows). Confirm with the maintainer, or proceed with the recommendation and say
so in the commit message. This is the only open question that changes the
migration.

Seven collections. **Template/reference side** (editable, seeded, project-
agnostic):

- `shutdown_templates` — `template_key` (partial unique index `WHERE
  template_key != ''`, same as `checklist_templates`), `name`, `notes`.
- `shutdown_template_steps` — `template` (rel, required), `seq` (number,
  required), `group` (select: `pre_window` / `window` / `post_window`),
  `description` (text, required), `responsible_role_key` (**text**, not a
  relation — the template is project-agnostic), `hold_point` (bool),
  `offset_label` (text), `planned_offset_min` (number, nullable),
  `planned_duration_min` (number, nullable), `tag_ref_hint` (**text** — a
  generic hint like "isolation valve"; a template cannot hold a `tags`
  relation).
- `shutdown_contingencies` — `template` (rel), `seq`, `trigger` (text),
  `action` (text).

**Project registry:**

- `shutdown_roles` — `project` (rel, required), `role_key` (text, required),
  `title`, `contact_name`, `contact_phone`, `notify_on` (text — **stored, never
  acted on**; notification is hosted/paid tier). Unique index on
  `(project, role_key)`.

**Instance / execution side:**

- `shutdowns` — `project` (rel, required), `system` (rel, nullable), `template`
  (rel, nullable — an ad-hoc shutdown has none), `title`, `planned_window_start`
  (date — this is T-0), `planned_window_end` (date), `notes`, `created_by`
  (text). A planning record with a lifecycle: editable, **not** append-only.
- `shutdown_steps` — the instantiated list: `shutdown` (rel, required), `seq`,
  `group`, `description`, `responsible_role` (rel → `shutdown_roles`, nullable),
  `hold_point`, `offset_label`, `planned_offset_min`, `planned_duration_min`,
  `tag` (rel → `tags`, **nullable** — resolved from the hint at planning time).
  Editable while planning.
- `shutdown_step_events` — **APPEND-ONLY.** `shutdown` (rel, required), `step`
  (rel, **nullable** — an `aborted` event is about the shutdown, not a step),
  `kind` (select), `occurred_at` (date), `performed_by` (text),
  `not_performed_reason` (select, nullable), `contingency` (rel →
  `shutdown_contingencies`, nullable), `note` (text), `frozen_description`
  (text — a copy of the step text at execution), `frozen_role_key` (text),
  `client_token` (text, unique — idempotent offline retry).

`kind` values: `started` · `completed` · `held` · `released` · `aborted` ·
`resumed` · `not_performed` · `contingency_invoked`. **There is no `skipped`** —
ADR 0019 open question 3 resolved in favour of reusing ADR 0018 §4's vocabulary.

`not_performed_reason` values (from ADR 0018 §4, **the same set, not a
variant**): `conditions_unavailable` · `access_blocked` ·
`equipment_unavailable` · `satisfied_by_other_evidence` · `out_of_scope` ·
`other`.

**Rules:**

- `shutdown_step_events`: `updateRule: null`, `deleteRule: null`. Public
  create (accountless field tier, hard constraint #1 — this is a glove at
  2 AM). Public read.
- `shutdowns`, `shutdown_steps`, `shutdown_roles`, and all three template
  collections: public read; **create/update require auth** (office writes,
  ADR 0011); `deleteRule: null` (superuser only), like everything else.
- A `createRule` on `shutdown_step_events` enforcing the shape: a
  `contingency_invoked` event must carry a `contingency`; a `not_performed`
  event must carry a `not_performed_reason`. Append-only means a malformed
  record is permanent, so the rule is the gate, not the UI — the same reasoning
  as `checks`' XOR rule and LOTO's photo rule.

**No stored status anywhere** (constraint #4). Do not add a `status` or
`current_step` field to `shutdowns`, however tempting.

## Acceptance criteria

- [ ] Open question 1 settled and the choice stated in the commit message.
- [ ] The migration applies to a **fresh** database (delete `pb_data/`, run
      `./pocketbase serve`) and `migrate down` rolls it back cleanly.
- [ ] `scripts/smoke_test.sh` gains assertions, and its header assertion count
      is updated: all seven collections exist; a `shutdown_step_events` create
      succeeds **without a token**; a PATCH and a DELETE of one are refused; a
      `contingency_invoked` event with no `contingency` is refused; a
      `not_performed` event with no reason is refused; an unauthenticated
      `shutdowns` create is refused and an authenticated one succeeds.
- [ ] `scripts/smoke_test.sh` passes end to end; the browser test still passes.
- [ ] No `pb_public/` file and no `seed/` file changed.

## Guardrails

- **Comment the migration** the way the others are commented — the maintainer
  learns the backend by reading them. Say *why* `responsible_role_key` is text
  on the template and a relation on the instance, and why events are append-only.
- Check the migration number **and letter** against `ls pb_migrations/` at
  execution time; a concurrent session may have taken `1789000034` / `S`.
- Do not load the runbook JSON here. Do not build UI here.
- Seven collections take the committed schema 24 → 31. Update the count
  everywhere it is stated (`ARCHITECTURE.md` §2, `docs/ROADMAP.md`,
  `docs/current-state.md`) — the M1 reconciliation made that count a
  single-truth item and it must stay one.

## Definition of done

Migration applies and rolls back on a fresh DB; smoke test extended and green;
`ARCHITECTURE.md` §2 documents the seven collections and their mutability;
collection count updated everywhere; committed as the maintainer, e.g.
`feat(schema): shutdown runbook collections (ADR 0019)`.
