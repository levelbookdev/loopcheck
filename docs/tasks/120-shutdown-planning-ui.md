# 120 — Shutdown planning UI: instantiate a runbook into a real outage

Status: DONE (2026-09-07 — `pb_public/shutdown_plan.html` + migration U for the
delete gap; smoke test 122 → 124 assertions, green)
Milestone: M2 Shutdown Runbooks + Punch List (v0.10.0)
Depends on: 110

## Context

Tasks `100`/`110` gave the database a template. This task turns a template into
a **planned shutdown** for a real project, system, and window — the office-side
work that happens days before anyone stands in a trench. Execution is task `130`.

Splitting planning from execution is deliberate: they happen at different times,
by different people, under wildly different conditions, and only one of them is
done wearing gloves at 2 AM.

## Scope

**Create:** `pb_public/shutdown_plan.html`.
**Touch:** `pb_public/project.html` (a link to the shutdown list), `app.css` only
if a genuinely new component is needed.
**Leave alone:** the execution UI (`130`), the board (`140`), every migration.

## Specification

1. **Instantiate.** Pick a `shutdown_templates` row + project + optional system,
   set `planned_window_start` (T-0) and `planned_window_end`, and copy the
   template's steps into `shutdown_steps` for this shutdown. The copy is what
   makes the plan job-specific and editable without touching the library.
2. **Resolve roles.** The template names `responsible_role_key` strings; this
   project may not have `shutdown_roles` rows for them yet. Offer to create the
   missing ones inline (title + contact name + phone), because the contact
   details are the entire point of the registry — at 2 AM you need the district
   operator's phone number, not a role name.
3. **Resolve tags.** `tag_ref_hint` is a generic string ("isolation valve").
   Offer the project's tags for the planner to bind `shutdown_steps.tag`.
   Unknown/unmatched is fine and common — **warn, never block** (ADR 0018 §11).
4. **Edit the plan.** Add, remove, reorder and reword steps for this job;
   toggle `hold_point`; adjust offsets. A real tie-in is never exactly the
   generic runbook.
5. **Show the derived schedule.** From `planned_window_start` + each window
   step's `planned_offset_min`, render a wall-clock time per step. Derived at
   render, never stored — the window moves, and every stored copy would drift.
6. **Auth.** This whole page is an office write and requires a signed-in user
   (`lc-auth.js`, ADR 0011). That is the opposite of task `130`, deliberately.

## Acceptance criteria

- [x] From a seeded database, a signed-in user can create a shutdown from the
      tie-in template against a project + system, and 22 `shutdown_steps` are
      created with their groups, offsets and hold points intact.
- [x] Missing `shutdown_roles` can be created inline; the shutdown's steps then
      resolve to real role records with contact details.
- [x] A step can be bound to a project tag; an unmatched hint warns and does not
      block saving.
- [x] Steps can be added, removed, reordered and edited **before** execution,
      and the page never writes a `shutdown_step_events` record.
- [x] Wall-clock times are derived at render — confirmed by changing
      `planned_window_start` and seeing every window step's time move with no
      other write.
- [x] An unauthenticated visitor cannot create or edit; the page says so rather
      than failing silently.
- [x] Page JS stays within the ~50 KB budget; no new library; no build step.

## Execution notes (2026-09-07)

- **Spec item 4 needed a schema change.** Every collection shipped
  `deleteRule: null`, so "remove a step" was impossible as written. Raised, and
  resolved by maintainer ruling: migration U, a guarded rule that permits the
  delete only while the step has no events. ADR 0019 carries the amendment.
- **Roles are created before steps, not offered after.** `shutdown_steps` holds
  `responsible_role` as a relation and has no text-key fallback, so a step
  copied before its role record existed would lose which role it wanted. The
  page therefore creates the project's roles from the template's role table
  (titles prefilled, contacts blank) and then binds the steps; the planner
  fills in contacts on the plan page, flagged by a banner. This satisfies spec
  item 2's intent — the contact details are the point — without a schema change.
- **Two bugs the render check caught that the API tests could not**: the page
  called a `lcAuth.authFetch()` helper that does not exist in this codebase
  (rendered a blank shell), and sorted systems by `sequence` when the field is
  `startup_sequence` (400, empty picker). Both fixed.

**Coverage gap worth a future task:** `scripts/browser_test.sh` covers only the
accountless field path, so no office page has render coverage. This task shipped
an empty shell and a 400 that only a throwaway headless check caught. A small
office-path browser suite would have caught both automatically.

## Guardrails

- **No stored status.** No `current_step`, no `progress`, no `status` on
  `shutdowns`. Constraint #4.
- **Do not start execution here.** No event writes. If the plan page can log a
  step, the split between planning and execution has already collapsed.
- Follow `check.html`'s Alpine idiom and comment the PocketBase calls (filter
  syntax, `expand`, the create-then-derive sequence) as the other pages do.
- Frontend talks to `window.location.origin`; never hardcode a host.

## Definition of done

The flow works end to end against a freshly seeded instance; docs updated
(`ARCHITECTURE.md` §6 UI section, `docs/ROADMAP.md` if user-visible scope
changed, landing page only if this ships user-visible capability); committed as
the maintainer, e.g. `feat(ui): shutdown planning page (ADR 0019)`.
