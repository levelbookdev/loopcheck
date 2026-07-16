/// <reference path="../pb_data/types.d.ts" />
//
// Collection: systems — a process system within a project (e.g. "RAS Pumping",
// "Chlorine Contact"). Systems can nest (a subsystem points at its parent) and
// carry a startup_sequence used to order the commissioning march on the project
// home page.
//
// The self-relation (parent_system → systems) is added in a second save: the
// collection must exist before a relation field can point back at it.

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");

  const systems = new Collection({
    type: "base",
    name: "systems",

    // TODO(auth): before internet exposure, change every "" rule to:
    //   @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,

    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },

      // System number as it appears on the P&ID / system list, e.g. "12" or
      // "3200". Presentable so it shows in relation dropdowns.
      { name: "number", type: "text", required: true, presentable: true },
      { name: "name", type: "text" },

      // Commissioning order. Lower numbers get commissioned first; the project
      // home page sorts by this. Plain int, editable.
      { name: "startup_sequence", type: "number" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    // A system number is unique within its project (but "12" can exist in two
    // different projects). Enforced by the database, not by app code.
    indexes: [
      "CREATE UNIQUE INDEX `idx_systems_project_number` ON `systems` (`project`, `number`)",
    ],
  });

  app.save(systems);

  // Second pass: now that `systems` exists, add the self-referential parent
  // relation. Nullable — top-level systems have no parent.
  systems.fields.add(new Field({
    name: "parent_system",
    type: "relation",
    required: false,
    maxSelect: 1,
    collectionId: systems.id,
    cascadeDelete: false,
  }));
  app.save(systems);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("systems"));
});
