/// <reference path="../pb_data/types.d.ts" />
//
// Collection: projects — one treatment-plant / capital job. Everything else
// (systems, tags, checks, punch items) hangs off a project.
//
// How these files work: PocketBase applies every pending file in
// pb_migrations/ automatically at startup, in filename order (hence the
// numeric prefixes). The first function is the migration; the second is the
// rollback used by `./pocketbase migrate down`.

migrate((app) => {
  const projects = new Collection({
    type: "base",
    name: "projects",

    // ---- Phase 1 API rules ------------------------------------------------
    // In PocketBase rules, "" (empty string) means PUBLIC — anyone can call
    // it — while null means LOCKED to admins only.
    //
    // TODO(auth): before LoopCheck is exposed to the internet, change every
    // "" rule below to: @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null, // deletes stay admin-only even in Phase 1

    fields: [
      // `presentable` tells the admin UI to show this field when the record
      // appears inside a relation dropdown.
      { name: "name", type: "text", required: true, presentable: true },

      // The parties named on turnover deliverables. Free text — LoopCheck is
      // not a directory and does not model organizations.
      { name: "owner_name", type: "text" },
      { name: "engineer_of_record", type: "text" },
      { name: "contractor_name", type: "text" },

      // PocketBase 0.23+ no longer adds created/updated automatically —
      // they are explicit "autodate" fields now.
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });

  app.save(projects);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("projects"));
});
