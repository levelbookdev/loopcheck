# 110 — Seed loader: load the tie-in runbook into the shutdown collections

Status: DONE (2026-09-07 — loader `1789000036_seed_shutdown_runbook.js`, plus
`1789000035_migration_t_shutdown_template_roles.js` for the schema gap spec
item 4 anticipated; smoke test 112 → 122 assertions, green)
Milestone: M2 Shutdown Runbooks + Punch List (v0.10.0)
Depends on: 100

## Context

`seed/shutdown_runbook_tie_in.json` has been captured-but-unloaded since Phase 1.
`ARCHITECTURE.md` §7 set the condition for loading it: *"One representation,
loaded when Phase 4 can hold it."* Task `100` built collections that can hold it
— offsets, hold points, roles, and contingencies all survive. This task loads it.

## Scope

**Create:** `pb_migrations/1789000035_seed_shutdown_runbook.js` (verify the
number is free at execution time).

**Leave alone:** the JSON itself — this is a **loader, not a copy**
(`CLAUDE.md`: the library exists in exactly one place). Do not restructure the
seed file to make loading easier; if the JSON and the schema disagree, that is a
finding to raise, not to paper over.

## Specification

1. Resolve `seed/` via `__hooks + "/../seed/"`, exactly as the existing loaders
   do — `__hooks` is defined inside migrations and works regardless of the
   directory the binary was launched from.
2. Read `runbook_template` and load:
   - one `shutdown_templates` row (`template_key` verbatim — it is an opaque
     identifier, never parsed);
   - `pre_window_steps` → `group: "pre_window"`, `window_steps` → `"window"`,
     `post_window_steps` → `"post_window"`, preserving `seq`;
   - `contingencies` → `shutdown_contingencies`, in order.
3. **Field mapping**, and mind the asymmetry the source deliberately has:
   - pre/post steps carry `offset_label`, and **no** minute fields;
   - window steps carry `planned_offset_min` + `planned_duration_min`, and **no**
     label. Do not synthesize the missing one in either direction — ADR 0019 §2
     kept both forms precisely because each is right at its own scale.
   - `responsible_party` → `responsible_role_key` (text, verbatim).
   - `tag_ref` → `tag_ref_hint` (text). It is `null` throughout the current file;
     load it anyway so a future runbook that sets it works.
4. **Roles are template metadata, and this is the one real modelling question in
   this task.** The JSON's `roles` array (`role_key`, `title`, `notify_on`) is
   part of the *template*, but `shutdown_roles` is **per project** (ADR 0019 §4).
   The loader must therefore **not** create `shutdown_roles` rows — there is no
   project at migration time. Load the role table as reference data on the
   template so task `120` can offer it when instantiating a shutdown into a real
   project. If task `100` left nowhere to put it, **stop and raise it**: that is
   a schema gap, not something to improvise a JSON blob for.
5. Guard for existing rows by `template_key`, the way `1789000017` and
   `1789000022` do, so the loader is safe on a database that already ran it.
6. The `down` migration deletes exactly what it loaded, by `template_key`
   (children cascade).

## Acceptance criteria

- [x] A fresh database ends with **1** shutdown template, **22** template steps
      (8 pre-window, 12 window, 2 post-window), and **4** contingencies.
- [x] Window steps have non-null `planned_offset_min` and a null
      `offset_label`; pre/post steps have the inverse. Asserted, not eyeballed.
- [x] Re-running the loader on a database that already has the template creates
      no duplicates.
- [x] `migrate down` removes the template, its steps, and its contingencies, and
      leaves other seeded content untouched.
- [x] `scripts/smoke_test.sh` asserts the counts above (a module whose seed
      silently skips is exactly the failure the smoke test exists to catch); the
      header assertion count is updated.
- [x] `seed/shutdown_runbook_tie_in.json` is **unchanged**.

## Execution notes (2026-09-07)

Two places where the written spec did not match the source file:

1. **Spec item 4's schema gap was real.** The JSON's `roles` array had nowhere
   to go — `shutdown_roles` requires a project and none exists at migration
   time. Raised rather than improvised, and resolved by maintainer ruling: a new
   `shutdown_template_roles` collection (migration T), with `notify_on` as
   comma-joined text so task `120`'s copy into `shutdown_roles` needs no
   transform. This shifted the loader to `1789000036`; ADR 0019 carries an
   amendment note.
2. **`tag_ref` is not null throughout**, as spec item 3 states. Two steps
   (`seq` 11 and 16) carry instructional placeholders — "OPTIONAL: reference
   isolation valve tags here". The guardrail forbids improving runbook content,
   so they load verbatim. **Worth a maintainer look**: as loaded, those strings
   will render as tag hints in the planning UI.

Also noted for whoever builds the execution view: window step `seq: 10` sits at
`planned_offset_min: 0` — T-0 exactly, a real value and not an unset field.
`planned_duration_min` is the honest discriminator between the two offset forms,
since every window step has one and no pre/post step does.

## Guardrails

- The JSON's phases/keys are camelCase in places; convert mechanically like the
  other loaders, and store `template_key` verbatim.
- Do not "improve" the runbook content. It is maintainer-authored domain
  knowledge; the loader's job is fidelity.
- If a field in the JSON has no home in the schema, **stop** — that means task
  `100` missed something, and inventing a JSON dump column to absorb it defeats
  the point of building real collections.

## Definition of done

Fresh DB loads the runbook with the counts above; smoke test extended and green;
`seed/README.md` updated to say the runbook is now loaded (and by which
migration), replacing the "not loaded" note; `ARCHITECTURE.md` §9's "Not loaded"
bullet corrected; committed as the maintainer, e.g.
`feat(seed): load the tie-in shutdown runbook (ADR 0019)`.
