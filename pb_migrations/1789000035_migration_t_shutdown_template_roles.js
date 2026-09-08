/// <reference path="../pb_data/types.d.ts" />
//
// Migration T — shutdown_template_roles: the role table that belongs to a
// RUNBOOK, as opposed to the one that belongs to a PROJECT.
//
// WHY THIS EXISTS (a gap found while building task 110's loader, 2026-09-07).
// ADR 0019 §4 defined `shutdown_roles` as a per-project registry — role_key,
// title, and the contact you actually need at 2 AM — and migration S built it
// that way. But `seed/shutdown_runbook_tie_in.json` carries its own `roles`
// array (`role_key`, `title`, `notify_on`), and that array is part of the
// TEMPLATE: it is project-agnostic, it ships with the library, and there is no
// project in existence at migration time to hang it on. The loader therefore
// had nowhere to put it, and task 110 says in terms that a homeless field is a
// schema gap to raise rather than a JSON blob to improvise.
//
// This is the same template/instance split the module already uses everywhere
// else, finally applied to roles too:
//
//   shutdown_template_steps  (project-agnostic)  ->  shutdown_steps  (a project's)
//   shutdown_template_roles  (project-agnostic)  ->  shutdown_roles  (a project's)
//
// Planning a shutdown (task 120) copies these rows into `shutdown_roles` for
// the real project and the operator fills in the contact name and phone, which
// a library file could never know. `shutdown_roles` keeps meaning exactly what
// ADR 0019 §4 says it means; nothing about it changes here.
//
// NOTE the role table is NOT derivable from the steps, which is why it has to
// be loaded rather than inferred: the tie-in runbook defines six roles but only
// four are named by any step. `standby_crew` and `emergency` are there to be
// phoned when something goes wrong, and a crew that lost them would lose the
// most useful thing in the document.
//
// `notify_on` is TEXT, comma-joined, matching `shutdown_roles.notify_on` so the
// copy at planning time is a straight assignment with no transform (maintainer
// ruling, 2026-09-07). It is STORED AND NEVER ACTED ON — core records who should
// be told at which trigger; sending is hosted/paid tier. Nothing in core parses
// this string, which is exactly why a delimiter is enough.

migrate((app) => {
  const AUTH = '@request.auth.id != ""';
  const tpl = app.findCollectionByNameOrId("shutdown_templates");

  const roles = new Collection({
    type: "base",
    name: "shutdown_template_roles",
    // Same posture as the rest of the template side: the runbook is
    // field-facing reference data a crew may read with no account, editing the
    // library is an office action (ADR 0011).
    listRule: "",
    viewRule: "",
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      // Roles die with their template, like the steps and contingencies.
      { name: "template", type: "relation", required: true, maxSelect: 1,
        collectionId: tpl.id, cascadeDelete: true },
      // Matches shutdown_template_steps.responsible_role_key, e.g.
      // "district_operations". This is the join the planner resolves.
      { name: "role_key", type: "text", required: true },
      { name: "title", type: "text", required: true, presentable: true },
      // Comma-joined trigger list; see the header note. No contact fields here
      // on purpose — a library cannot know who to call on your job.
      { name: "notify_on", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_shutdown_tpl_roles_template` ON `shutdown_template_roles` (`template`)",
      "CREATE UNIQUE INDEX `idx_shutdown_tpl_roles_key` ON `shutdown_template_roles` (`template`, `role_key`)",
    ],
  });
  app.save(roles);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("shutdown_template_roles"));
});
