/// <reference path="../pb_data/types.d.ts" />
//
// Collection: template_items — one ordered line in a checklist_template. This is
// the whole "forms designer": a sequence number, some text, and a response type.
// No conditional logic, no branching. If a feature needs branching, the answer
// is no.

migrate((app) => {
  const templates = app.findCollectionByNameOrId("checklist_templates");

  const items = new Collection({
    type: "base",
    name: "template_items",

    // TODO(auth): before internet exposure, change every "" rule to:
    //   @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,

    fields: [
      { name: "template", type: "relation", required: true, maxSelect: 1,
        collectionId: templates.id, cascadeDelete: true }, // items die with their template

      // Order within the checklist. Rendered ascending.
      { name: "sequence", type: "number", required: true },

      { name: "text", type: "text", required: true, presentable: true },

      // How the field tech answers this line (the four types, deliberately
      // only four — see seed/README.md):
      //   pass_fail_na   — pass / fail / N/A
      //   value          — a recorded reading; `unit` says what (A, psi, megohm)
      //   text           — free text (method used, witness name, sample IDs)
      //   photo_required — the answer IS an attached photo (nameplate, plume)
      {
        name: "response_type",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["pass_fail_na", "value", "text", "photo_required"],
      },

      // Engineering unit for value items ("mils TIR", "megohm", "psi").
      // Display-only — the recorded value stays free text in check_items.
      { name: "unit", type: "text" },

      // True when the acceptance value is governed by the project spec or a
      // referenced standard (megger minimums, torque values, residuals). The
      // template names the check; the project confirms the number. Phase 2
      // renders these with the value blank and a "per Section __" prompt.
      { name: "confirm_per_spec", type: "bool" },

      // Optional citation for a confirm_per_spec line — the governing standard
      // ("NEMA MG-1", "AWWA C500") where universal, or a project spec section
      // ("11312-2.03.B") filled per project. Populated from the seed for lines
      // whose standard is universal; left blank for project-specific sections.
      // (Created here rather than in Migration A so the seed loader, which runs
      // earlier, can populate it — ADR 0002.)
      { name: "spec_reference", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_template_items_template` ON `template_items` (`template`, `sequence`)",
    ],
  });

  app.save(items);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("template_items"));
});
