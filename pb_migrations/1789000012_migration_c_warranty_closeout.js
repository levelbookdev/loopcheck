/// <reference path="../pb_data/types.d.ts" />
//
// Migration C — Warranty & Closeout Tracker (ADR 0005).
//
// Four collections, three mutability profiles:
//   warranties             editable registry of contract facts
//   closeout_requirements  workflow state (required -> received -> accepted)
//   closeout_log           APPEND-ONLY trail of requirement status changes
//   warranty_claims        close-once ledger (updatable while open, frozen at closure)
//
// The warranty END DATE IS NEVER STORED — it is derived in the UI from
// clock_start_date + duration_months (hard constraint #4). The stored facts
// (basis + trigger date + duration) ARE the provenance a warranty dispute
// is actually about.

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");
  const tags = app.findCollectionByNameOrId("tags");

  // ---- warranties: who backs this equipment, and when the clock started ----
  const warranties = new Collection({
    type: "base",
    name: "warranties",

    // TODO(auth): before internet exposure, change every "" rule to:
    //   @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "", // a registry of contract facts, correctable (like tags)
    deleteRule: null, // admin-only

    fields: [
      // project is denormalized from the tag (same pattern as punch_items)
      // so the timeline and dashboard filter per-project without nested
      // relation queries.
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      { name: "tag", type: "relation", required: true, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },

      { name: "vendor_name", type: "text", presentable: true },
      { name: "vendor_contact_name", type: "text" },
      { name: "vendor_phone", type: "text" },
      { name: "vendor_email", type: "email" },

      // THE load-bearing fields (ADR 0005): what event starts the clock,
      // and the exact spec language when the enum can't hold it
      // ("24 mo from SC or 30 mo from shipment, whichever first").
      {
        name: "basis",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["substantial_completion", "beneficial_use", "startup",
                 "shipment_cap", "other"],
      },
      { name: "basis_note", type: "text" },

      // The actual triggering event date. OPTIONAL on purpose: during
      // commissioning the trigger usually hasn't happened yet — "terms
      // known, clock not started" is a first-class state, not missing data.
      { name: "clock_start_date", type: "date" },
      { name: "duration_months", type: "number", onlyInt: true, min: 1 },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_warranties_project` ON `warranties` (`project`)",
      "CREATE INDEX `idx_warranties_tag` ON `warranties` (`tag`)",
    ],
  });
  app.save(warranties);

  // ---- closeout_requirements: one row per deliverable owed, per tag --------
  const requirements = new Collection({
    type: "base",
    name: "closeout_requirements",

    // TODO(auth): before internet exposure, change every "" rule to:
    //   @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "", // workflow state, not history — the log below is the trail
    deleteRule: null, // admin-only

    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      { name: "tag", type: "relation", required: true, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },

      {
        name: "req_type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["om_manual", "spare_parts", "special_tools", "training",
                 "warranty_cert", "test_report", "other"],
      },
      // "2 spare mechanical seals per spec 11310-2.05"
      { name: "description", type: "text", presentable: true },

      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["required", "received", "accepted"],
      },
      { name: "received_date", type: "date" },
      { name: "accepted_by", type: "text" },
      // Free text — "Owner's warehouse shelf B3". A TrenchNote asset
      // reference goes here AS TEXT; no integration (ADR 0005).
      { name: "storage_location", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_closeout_requirements_project` ON `closeout_requirements` (`project`, `status`)",
      "CREATE INDEX `idx_closeout_requirements_tag` ON `closeout_requirements` (`tag`)",
    ],
  });
  app.save(requirements);

  // ---- closeout_log: the append-only trail behind the editable status ------
  // A separate immutable collection, NOT a mutable note field on the
  // requirement: a text field any client can rewrite is not a trail
  // (ADR 0005). Same enforcement as checks: updates and deletes rejected
  // in the schema regardless of auth.
  const closeoutLog = new Collection({
    type: "base",
    name: "closeout_log",

    // TODO(auth): before internet exposure, change every "" rule to:
    //   @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null, // append-only — a log entry is never edited
    deleteRule: null, // ... or deleted

    fields: [
      { name: "requirement", type: "relation", required: true, maxSelect: 1,
        collectionId: requirements.id, cascadeDelete: false },

      // Plain text rather than selects so the log can also record creation
      // ("" -> "required") without a special-case value.
      { name: "from_status", type: "text" },
      { name: "to_status", type: "text", required: true },
      { name: "changed_by", type: "text" },
      { name: "note", type: "text" },

      // `created` is the server-assigned WHEN of the change.
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],

    indexes: [
      "CREATE INDEX `idx_closeout_log_requirement` ON `closeout_log` (`requirement`)",
    ],
  });
  app.save(closeoutLog);

  // ---- warranty_claims: a close-once ledger ---------------------------------
  // A claim has a lifecycle (opened -> vendor notified -> resolved ->
  // closed), so an OPEN claim is updatable. The updateRule is evaluated
  // against the STORED record, so the PATCH that sets closed_at passes and
  // every update after it is rejected server-side — never edit a claim
  // after closure; corrections are new claims (ADR 0005). An open claim is
  // one with no closed_at — derived, no status field to drift.
  const claims = new Collection({
    type: "base",
    name: "warranty_claims",

    // TODO(auth): before internet exposure, change the "" rules to:
    //   @request.auth.id != ""
    // (and AND the auth check into the updateRule below).
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "closed_at = ''", // frozen once closed
    deleteRule: null, // admin-only

    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      { name: "tag", type: "relation", required: true, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },

      // Client-set: the failure was noticed when it was noticed; `created`
      // is the log stamp (same split as checks.performed_at).
      { name: "opened_at", type: "date", required: true },
      { name: "opened_by", type: "text" },
      { name: "description", type: "text", required: true, presentable: true },

      { name: "vendor_notified_date", type: "date" },
      { name: "resolution_note", type: "text" },
      { name: "closed_at", type: "date" },
      { name: "closed_by", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_warranty_claims_project` ON `warranty_claims` (`project`)",
      "CREATE INDEX `idx_warranty_claims_tag` ON `warranty_claims` (`tag`)",
    ],
  });
  app.save(claims);
}, (app) => {
  // Rollback: children first (relations point up the list).
  app.delete(app.findCollectionByNameOrId("warranty_claims"));
  app.delete(app.findCollectionByNameOrId("closeout_log"));
  app.delete(app.findCollectionByNameOrId("closeout_requirements"));
  app.delete(app.findCollectionByNameOrId("warranties"));
});
