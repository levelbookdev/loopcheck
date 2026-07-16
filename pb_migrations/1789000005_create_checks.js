/// <reference path="../pb_data/types.d.ts" />
//
// Collection: checks — one completed checklist run against ONE subject: a tag
// (equipment checkout) XOR a system (a system-level event like a functional
// demonstration). This is the APPEND-ONLY ledger that checkout status is
// derived from. There is no "status" field anywhere: a tag's standing is
// computed from its checks; system readiness adds the system's own checks.
//
// See ADR 0001 (docs/adr/) for the subject decision. The execution UI is
// Phase 2; the schema exists now so nothing blocks it and so the immutability
// guarantee is baked in from the first migration.

migrate((app) => {
  const tags = app.findCollectionByNameOrId("tags");
  const systems = app.findCollectionByNameOrId("systems");
  const templates = app.findCollectionByNameOrId("checklist_templates");

  const checks = new Collection({
    type: "base",
    name: "checks",

    // TODO(auth): before internet exposure, the "" rules become
    //   @request.auth.id != ""
    // and the createRule below becomes
    //   @request.auth.id != "" && (<the same XOR expression>)
    listRule: "",
    viewRule: "",

    // EXACTLY ONE SUBJECT, enforced by the server, not by trusting clients:
    // a check is about a tag XOR a system. Because this ledger is
    // append-only, a record created with the wrong shape would be permanent —
    // so the rule is the gate. (Same pattern as TrenchNote's movements
    // either/or createRule.)
    createRule: '(tag != "" && system = "") || (tag = "" && system != "")',

    // APPEND-ONLY: no updates, no deletes, ever. A checkout record you can
    // rewrite is not a turnover deliverable. Corrections are NEW checks. This
    // immutability is what makes the record trustworthy to the engineer of
    // record and in a dispute.
    updateRule: null,
    deleteRule: null,

    fields: [
      // The two subjects. Both optional at the field level; the createRule
      // above enforces exactly-one. (Field-level `required` can't express
      // either/or.)
      { name: "tag", type: "relation", required: false, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },
      { name: "system", type: "relation", required: false, maxSelect: 1,
        collectionId: systems.id, cascadeDelete: false },

      { name: "template", type: "relation", required: false, maxSelect: 1,
        collectionId: templates.id, cascadeDelete: false },

      // Denormalized from the template so a check reads correctly even if the
      // template is later edited (templates are living; checks are frozen).
      {
        name: "phase",
        type: "select",
        maxSelect: 1,
        values: [
          "installation", "point_to_point", "energization",
          "loop_check", "functional", "performance",
        ],
      },
      {
        name: "result",
        type: "select",
        maxSelect: 1,
        values: ["pass", "fail", "incomplete"],
      },

      // Free text, not user relations — field techs work without accounts.
      { name: "performed_by", type: "text" },
      { name: "witnessed_by", type: "text" }, // nullable; owner/EOR witness

      // When the work was actually performed (may differ from when it was
      // logged). `created` autodate is the immutable log timestamp.
      { name: "performed_at", type: "date" },

      { name: "notes", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_checks_tag` ON `checks` (`tag`)",
      "CREATE INDEX `idx_checks_system` ON `checks` (`system`)",
    ],
  });

  app.save(checks);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("checks"));
});
