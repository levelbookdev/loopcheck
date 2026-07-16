/// <reference path="../pb_data/types.d.ts" />
//
// Collection: punch_items — a defect or open item blocking progress. Can hang
// off a tag, a system, or just the project. Severity drives what it blocks:
//   A = blocks startup
//   B = blocks substantial completion
//   C = cosmetic / does not block
//
// A system's readiness is DERIVED from its open A-severity punch items plus its
// tags' checks — never stored. Unlike checks, a punch item has a lifecycle
// (open → closed), so updates are allowed; but the closure is recorded, and
// records are never deleted (deleteRule stays admin-only).

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");
  const tags = app.findCollectionByNameOrId("tags");
  const systems = app.findCollectionByNameOrId("systems");

  const punch = new Collection({
    type: "base",
    name: "punch_items",

    // TODO(auth): before internet exposure, change every "" rule to:
    //   @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "", // allows closing a punch item (status open -> closed)
    deleteRule: null,

    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },

      // Both nullable: a punch item may be scoped to a specific tag, to a whole
      // system, or to neither (a general project punch item).
      { name: "tag", type: "relation", required: false, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },
      { name: "system", type: "relation", required: false, maxSelect: 1,
        collectionId: systems.id, cascadeDelete: false },

      { name: "description", type: "text", required: true, presentable: true },

      {
        name: "severity",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["A", "B", "C"],
      },
      {
        name: "status",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["open", "closed"],
      },
      {
        name: "assigned_party",
        type: "select",
        maxSelect: 1,
        values: ["contractor", "vendor", "owner", "engineer"],
      },

      // Free text — no accounts in the field.
      { name: "created_by", type: "text" },

      // Closure trail. `created` autodate is the created_at timestamp; these
      // capture who/when/why it was closed.
      { name: "closed_by", type: "text" },
      { name: "closed_at", type: "date" },
      { name: "closure_note", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_punch_items_project` ON `punch_items` (`project`, `status`)",
      "CREATE INDEX `idx_punch_items_tag` ON `punch_items` (`tag`)",
      "CREATE INDEX `idx_punch_items_system` ON `punch_items` (`system`)",
    ],
  });

  app.save(punch);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("punch_items"));
});
