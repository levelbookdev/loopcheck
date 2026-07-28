/// <reference path="../pb_data/types.d.ts" />
//
// Collection: check_items — the answered lines of one check: one record per
// template_item the tech responded to. Append-only, like its parent check.

migrate((app) => {
  const checks = app.findCollectionByNameOrId("checks");
  const templateItems = app.findCollectionByNameOrId("template_items");

  const checkItems = new Collection({
    type: "base",
    name: "check_items",

    // HISTORICAL (auth): the rules below are what THIS migration shipped.

    // The auth lockdown has since landed -- migrations 1789000019 / 1789000020 /

    // 1789000033 (ADR 0011, Accepted) set the live rules. See docs/API.md.
    listRule: "",
    viewRule: "",
    createRule: "",
    // APPEND-ONLY: frozen once written, same as checks.
    updateRule: null,
    deleteRule: null,

    fields: [
      { name: "check", type: "relation", required: true, maxSelect: 1,
        collectionId: checks.id, cascadeDelete: false },

      // Which template line this answers. Kept as a relation for traceability;
      // the line's text is also frozen into `prompt` below in case the template
      // is later edited.
      { name: "template_item", type: "relation", required: false, maxSelect: 1,
        collectionId: templateItems.id, cascadeDelete: false },

      // Frozen copy of the template_item text at the moment of the check, so a
      // historical check reads correctly even after templates change.
      { name: "prompt", type: "text" },

      // For pass_fail items. Blank for value/note items.
      {
        name: "result",
        type: "select",
        maxSelect: 1,
        values: ["pass", "fail", "na"],
      },

      // For value items — stored as text so units and free-form readings
      // ("3.2 mils TIR", "480 V") survive. Blank otherwise.
      { name: "value", type: "text" },

      // For note items, and for any explanatory remark on a pass/fail line.
      { name: "note", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_check_items_check` ON `check_items` (`check`)",
    ],
  });

  app.save(checkItems);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("check_items"));
});
