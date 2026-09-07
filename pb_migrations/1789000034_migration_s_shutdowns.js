/// <reference path="../pb_data/types.d.ts" />
//
// Migration S — Shutdown runbooks (ADR 0019, Accepted 2026-08-04): the seven
// collections Phase 4 needs, and nothing else. The runbook JSON in
// `seed/shutdown_runbook_tie_in.json` stays unloaded until the seed loader
// (task 110); no UI lands until tasks 120-140.
//
// SAFETY FRAMING (ADR 0019, non-negotiable — same doctrine as LOTO/ADR 0007):
// this module RECORDS and COORDINATES. It never AUTHORIZES. There are no
// interlocks, no permission-to-proceed, no "safe to cut" indicator, and no
// green all-clear anywhere in the schema. A hold point is a RECORD that
// authorization was required and what happened — not a gate the software
// enforces. Nothing here may become evidence that it is safe to cut a live
// main. That is why `hold_point` is a plain bool with no rule attached to it:
// an unsatisfied hold point is surfaced by the UI and enters the derived
// standing, but the ledger will still accept every event logged after it.
//
// DERIVED STATUS, NEVER STORED (hard constraint #4). There is deliberately no
// `status` and no `current_step` column on `shutdowns`, however tempting:
//   * a step's state   = its latest event (started / completed / held ...)
//   * a shutdown's standing = a fold over its events
//   * schedule variance = event timestamps vs `planned_offset_min`, at render
//   * unsatisfied hold points = hold_point steps with no `released` event
//
// THE TEMPLATE/INSTANCE SPLIT is the reason several fields change type across
// the two sides, which looks like an inconsistency until you see why:
//   * `responsible_role_key` is TEXT on the template and `responsible_role` is
//     a RELATION on the instance. A seeded template is project-agnostic — it
//     cannot point at a `shutdown_roles` row that only exists once a project
//     has been set up. Planning resolves the key to that project's role record.
//   * `tag_ref_hint` is TEXT on the template and `tag` is a RELATION on the
//     instance, for exactly the same reason: the library can only say
//     "isolation valve", and planning resolves that to a real tag. An
//     unresolved hint warns; it never blocks (ADR 0018 §11).
//
// OPEN QUESTION 1 (ADR 0019) is settled here in favour of the ADR's own
// recommendation: `shutdown_contingencies` stays its OWN collection rather
// than folding into `shutdown_template_steps` behind a discriminator. A
// contingency has no seq semantics, no offset, no duration and no hold point —
// folding it in would leave half the columns null for half the rows, and the
// two are read in different places at different moments (a step list is walked;
// a contingency is consulted when something has gone wrong).

migrate((app) => {
  const AUTH = '@request.auth.id != ""';

  const projects = app.findCollectionByNameOrId("projects");
  const systems = app.findCollectionByNameOrId("systems");
  const tags = app.findCollectionByNameOrId("tags");

  // Shared vocabulary. `not_performed_reason` is ADR 0018 §4's set VERBATIM,
  // not a shutdown-flavoured variant — ADR 0019 open question 3 resolved on
  // acceptance in favour of one vocabulary across the product. Note what is
  // absent: there is NO `skipped` kind. "Didn't do it" is a `not_performed`
  // event carrying a reason from this list.
  const NOT_PERFORMED_REASONS = [
    "conditions_unavailable", "access_blocked", "equipment_unavailable",
    "satisfied_by_other_evidence", "out_of_scope", "other",
  ];
  const STEP_GROUPS = ["pre_window", "window", "post_window"];

  // ---------------------------------------------------------------------
  // 1. shutdown_templates — the library header. Mirrors checklist_templates.
  // ---------------------------------------------------------------------
  const tpl = new Collection({
    type: "base",
    name: "shutdown_templates",
    // Public read: the runbook is field-facing reference data, and the crew
    // walking it at 2 AM may have no account (hard constraint #1). Editing the
    // library is an office action (ADR 0011).
    listRule: "",
    viewRule: "",
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      // Opaque stable identifier from seed/, e.g. "shutdown_tie_in_generic".
      // The loader upserts on it, so it must be unique — but only when set,
      // hence the partial index (same shape as checklist_templates.template_key,
      // which lets hand-created templates leave it blank).
      { name: "template_key", type: "text" },
      { name: "name", type: "text", required: true, presentable: true },
      { name: "notes", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_shutdown_templates_key` ON `shutdown_templates` (`template_key`) WHERE `template_key` != ''",
    ],
  });
  app.save(tpl);

  // ---------------------------------------------------------------------
  // 2. shutdown_template_steps — the ordered library steps.
  // ---------------------------------------------------------------------
  const tplSteps = new Collection({
    type: "base",
    name: "shutdown_template_steps",
    listRule: "",
    viewRule: "",
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      // Steps die with their template — the template_items precedent.
      { name: "template", type: "relation", required: true, maxSelect: 1,
        collectionId: tpl.id, cascadeDelete: true },
      { name: "seq", type: "number", required: true, onlyInt: true, min: 1 },
      { name: "group", type: "select", required: true, maxSelect: 1,
        values: STEP_GROUPS },
      { name: "description", type: "text", required: true, presentable: true },

      // TEXT, not a relation — see the template/instance note in the header.
      { name: "responsible_role_key", type: "text" },

      // Warns, never blocks (ADR 0019 §1). No rule references this field.
      { name: "hold_point", type: "bool" },

      // BOTH offset forms are kept deliberately (ADR 0019 §2). The calendar
      // scale ("T-14d", "T+24h") is a human label because at two weeks out
      // minutes are noise; the window scale is integer minutes from T-0
      // because inside a negotiated outage minutes are the whole subject.
      // Normalizing either into the other loses real information.
      { name: "offset_label", type: "text" },
      { name: "planned_offset_min", type: "number", onlyInt: true },
      { name: "planned_duration_min", type: "number", onlyInt: true, min: 0 },

      // TEXT hint only ("isolation valve"), resolved to a real tag at planning.
      { name: "tag_ref_hint", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_shutdown_tpl_steps_template` ON `shutdown_template_steps` (`template`)",
      "CREATE UNIQUE INDEX `idx_shutdown_tpl_steps_seq` ON `shutdown_template_steps` (`template`, `seq`)",
    ],
  });
  app.save(tplSteps);

  // ---------------------------------------------------------------------
  // 3. shutdown_contingencies — trigger/action pairs. NOT steps.
  //    Kept separate per open question 1 (see header).
  // ---------------------------------------------------------------------
  const contingencies = new Collection({
    type: "base",
    name: "shutdown_contingencies",
    listRule: "",
    viewRule: "",
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      { name: "template", type: "relation", required: true, maxSelect: 1,
        collectionId: tpl.id, cascadeDelete: true },
      // Ordering only — a contingency has no schedule position.
      { name: "seq", type: "number", required: true, onlyInt: true, min: 1 },
      // "isolation valve fails to hold"
      { name: "trigger", type: "text", required: true, presentable: true },
      // "stop before cutting; secondary isolation, line stop, or abort"
      { name: "action", type: "text", required: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_shutdown_conting_template` ON `shutdown_contingencies` (`template`)",
    ],
  });
  app.save(contingencies);

  // ---------------------------------------------------------------------
  // 4. shutdown_roles — the per-project registry (ADR 0019 §4).
  //    A role table rather than an enum, because at 2 AM the thing you need
  //    is the district operator's PHONE NUMBER, which an enum cannot hold.
  // ---------------------------------------------------------------------
  const roles = new Collection({
    type: "base",
    name: "shutdown_roles",
    listRule: "",
    viewRule: "",
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      // Matches shutdown_template_steps.responsible_role_key, e.g.
      // "district_operations", "inspector", "contractor_super".
      { name: "role_key", type: "text", required: true },
      { name: "title", type: "text", presentable: true },
      { name: "contact_name", type: "text" },
      { name: "contact_phone", type: "text" },

      // STORED, NEVER ACTED ON. Core records who should be notified at which
      // trigger; core does not send. Notification is hosted/paid tier — the
      // same line CLAUDE.md draws for warranty expiry alerts ("core stores
      // facts, not alerts"). Free text rather than a select because the
      // trigger vocabulary belongs to the seeded library, not the schema.
      { name: "notify_on", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_shutdown_roles_project` ON `shutdown_roles` (`project`)",
      "CREATE UNIQUE INDEX `idx_shutdown_roles_key` ON `shutdown_roles` (`project`, `role_key`)",
    ],
  });
  app.save(roles);

  // ---------------------------------------------------------------------
  // 5. shutdowns — one planned outage. A PLANNING record with a lifecycle:
  //    editable, NOT append-only. The events below are what make the record
  //    trustworthy, so nothing is lost by leaving the plan itself editable
  //    (the punch_items precedent).
  // ---------------------------------------------------------------------
  const shutdowns = new Collection({
    type: "base",
    name: "shutdowns",
    listRule: "",
    viewRule: "",
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      // Optional subject. ADR 0019 open question 2 (is project + optional
      // system enough for a real tie-in?) is still open with the maintainer;
      // the check-subject XOR is deliberately NOT extended here.
      { name: "system", type: "relation", required: false, maxSelect: 1,
        collectionId: systems.id, cascadeDelete: false },
      // Nullable: an ad-hoc shutdown is planned without a library runbook.
      // cascadeDelete false — retiring a template must never delete the
      // record of a shutdown that was actually executed from it.
      { name: "template", type: "relation", required: false, maxSelect: 1,
        collectionId: tpl.id, cascadeDelete: false },
      { name: "title", type: "text", required: true, presentable: true },

      // planned_window_start is T-0: every `planned_offset_min` on the steps
      // is relative to this instant.
      { name: "planned_window_start", type: "date" },
      { name: "planned_window_end", type: "date" },
      { name: "notes", type: "text" },
      // Free text, not a user relation — the field tier works without accounts.
      { name: "created_by", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_shutdowns_project` ON `shutdowns` (`project`)",
      "CREATE INDEX `idx_shutdowns_system` ON `shutdowns` (`system`)",
    ],
  });
  app.save(shutdowns);

  // ---------------------------------------------------------------------
  // 6. shutdown_steps — the instantiated step list for one shutdown.
  //    Editable while planning; execution never edits it, it appends events.
  // ---------------------------------------------------------------------
  const steps = new Collection({
    type: "base",
    name: "shutdown_steps",
    listRule: "",
    viewRule: "",
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null,
    fields: [
      // Plan lines are meaningless without their plan, so they cascade.
      { name: "shutdown", type: "relation", required: true, maxSelect: 1,
        collectionId: shutdowns.id, cascadeDelete: true },
      { name: "seq", type: "number", required: true, onlyInt: true, min: 1 },
      { name: "group", type: "select", required: true, maxSelect: 1,
        values: STEP_GROUPS },
      { name: "description", type: "text", required: true, presentable: true },

      // RELATION here, text on the template — resolved to this project's role
      // at planning time. Nullable: not every step names an owner.
      { name: "responsible_role", type: "relation", required: false, maxSelect: 1,
        collectionId: roles.id, cascadeDelete: false },

      { name: "hold_point", type: "bool" },
      { name: "offset_label", type: "text" },
      { name: "planned_offset_min", type: "number", onlyInt: true },
      { name: "planned_duration_min", type: "number", onlyInt: true, min: 0 },

      // RELATION here, a text hint on the template. Nullable — a hint that
      // resolves to nothing warns at planning, it never blocks (ADR 0018 §11).
      { name: "tag", type: "relation", required: false, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_shutdown_steps_shutdown` ON `shutdown_steps` (`shutdown`)",
      "CREATE UNIQUE INDEX `idx_shutdown_steps_seq` ON `shutdown_steps` (`shutdown`, `seq`)",
    ],
  });
  app.save(steps);

  // ---------------------------------------------------------------------
  // 7. shutdown_step_events — APPEND-ONLY execution ledger (ADR 0019 §3).
  //    One record per thing that happened. This mirrors loto_events exactly,
  //    and it earns the extra table in three places a one-row-per-step design
  //    could not serve: a step that STARTED and has not finished has a natural
  //    home; abort and resume are ordinary events rather than special cases;
  //    and a mis-logged step is corrected by APPENDING, never by editing.
  // ---------------------------------------------------------------------
  const events = new Collection({
    type: "base",
    name: "shutdown_step_events",
    listRule: "",
    viewRule: "",

    // The real createRule references `contingency`, which cannot exist until
    // the collection does — set in the second save below. `null` (locked) in
    // the interim so no window ever accepts unvalidated writes (the LOTO
    // precedent).
    createRule: null,

    // APPEND-ONLY, same enforcement as checks/loto_events. A step-event
    // someone can edit or delete is worthless as the record of what happened
    // in a negotiated window. Corrections are new events.
    updateRule: null,
    deleteRule: null,

    fields: [
      // cascadeDelete FALSE on both: this is evidence. Deletes are superuser
      // only, and if a plan is ever removed the events must not silently go
      // with it — `frozen_description` below is precisely what keeps such an
      // orphaned event readable.
      { name: "shutdown", type: "relation", required: true, maxSelect: 1,
        collectionId: shutdowns.id, cascadeDelete: false },
      // NULLABLE: an `aborted` event is about the whole shutdown, not a step.
      { name: "step", type: "relation", required: false, maxSelect: 1,
        collectionId: steps.id, cascadeDelete: false },

      { name: "kind", type: "select", required: true, maxSelect: 1,
        values: ["started", "completed", "held", "released", "aborted",
                 "resumed", "not_performed", "contingency_invoked"] },

      // Client-set: an event logged from a dead zone syncs late but happened
      // when it happened. `created` is the immutable server log stamp.
      { name: "occurred_at", type: "date" },
      // Free text — a glove at 2 AM has no login (hard constraint #1).
      { name: "performed_by", type: "text" },

      { name: "not_performed_reason", type: "select", required: false,
        maxSelect: 1, values: NOT_PERFORMED_REASONS },

      { name: "note", type: "text" },

      // FROZEN COPIES (the check_items.prompt pattern). A template edited next
      // year must not be able to rewrite what a crew executed last night, and
      // these are what let the event stand on its own.
      { name: "frozen_description", type: "text" },
      { name: "frozen_role_key", type: "text" },

      // Idempotent offline retry: the outbox replays a queued event after a
      // dead zone, and the unique index makes the duplicate a rejected write
      // rather than a second entry in an append-only ledger.
      //
      // NOT `hidden`, which is where this differs from calibrations.client_token
      // deliberately. A hidden field is stripped from client input, so a
      // required hidden field can never be satisfied by a client POST at all —
      // calibrations gets away with it only because its records are created by
      // a privileged pb_hooks route. These events are posted directly by the
      // accountless field client, which is the party that generates the token.
      { name: "client_token", type: "text", required: true },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX `idx_shutdown_events_shutdown` ON `shutdown_step_events` (`shutdown`)",
      "CREATE INDEX `idx_shutdown_events_step` ON `shutdown_step_events` (`step`)",
      "CREATE UNIQUE INDEX `idx_shutdown_events_client_token` ON `shutdown_step_events` (`client_token`)",
    ],
  });
  app.save(events);

  // Second pass: the relation to the contingency an event invokes, plus the
  // shape rule that needs it.
  events.fields.add(new Field({
    name: "contingency",
    type: "relation",
    required: false,
    maxSelect: 1,
    collectionId: contingencies.id,
    cascadeDelete: false,
  }));
  events.indexes.push(
    "CREATE INDEX `idx_shutdown_events_contingency` ON `shutdown_step_events` (`contingency`)");

  // CREATE IS PUBLIC — accountless, deliberately (ADR 0019 §7, hard constraint
  // #1). This is a gloved hand at 2 AM in the rain on a live main; a login
  // wall here is the one thing that would guarantee the ledger is written
  // after the fact from memory, which is the failure this module exists to
  // prevent. Planning a shutdown is an office action and IS gated (above).
  //
  // Because the ledger is append-only, a malformed record is PERMANENT — so
  // shape is enforced by the rule, not the UI (the checks-XOR and LOTO-photo
  // reasoning):
  //   contingency_invoked -> must name the contingency that was invoked
  //   not_performed       -> must carry a reason from ADR 0018 §4's set
  //   everything else     -> unconstrained
  // Note this is a pure SHAPE rule with no auth clause, exactly like LOTO's.
  events.createRule =
    '(kind = "contingency_invoked" && contingency != "") ||' +
    ' (kind = "not_performed" && not_performed_reason != "") ||' +
    ' (kind != "contingency_invoked" && kind != "not_performed")';

  app.save(events);
}, (app) => {
  // Reverse creation order: children before the parents they reference.
  for (const name of ["shutdown_step_events", "shutdown_steps", "shutdowns",
                      "shutdown_roles", "shutdown_contingencies",
                      "shutdown_template_steps", "shutdown_templates"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
