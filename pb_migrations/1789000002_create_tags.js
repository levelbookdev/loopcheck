/// <reference path="../pb_data/types.d.ts" />
//
// Collection: tags — a single piece of equipment or instrument, identified by
// its P&ID tag number (PMP-3101, FIT-2205, MOV-4410). THE tag number is the
// human-facing ID everywhere in LoopCheck; the QR label on the physical tag
// plate encodes /t/{tag_number}.
//
// A tag's checkout status is NEVER stored here — it is derived from the checks
// ledger. This collection is just the nameplate.

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");
  const systems = app.findCollectionByNameOrId("systems");

  const tags = new Collection({
    type: "base",
    name: "tags",

    // HISTORICAL (auth): the rules below are what THIS migration shipped.

    // The auth lockdown has since landed -- migrations 1789000019 / 1789000020 /

    // 1789000033 (ADR 0011, Accepted) set the live rules. See docs/API.md.
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,

    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },

      // Optional: a tag can be imported before it is assigned to a system.
      // CSV import creates systems on the fly, but a blank system_number in a
      // messy sheet must not block the import.
      { name: "system", type: "relation", required: false, maxSelect: 1,
        collectionId: systems.id, cascadeDelete: false },

      // The P&ID tag number. Presentable, and unique within the project (see
      // the composite index below). This is the string in the QR URL.
      { name: "tag_number", type: "text", required: true, presentable: true },

      { name: "description", type: "text" },

      // Equipment kind. The finer names (pump_centrifugal, valve_motor_operated,
      // instrument_*) come from the seed library in seed/ — checkout requirements
      // differ by subtype, so the subtype IS the type. Coarser kinds keep plain
      // names; anything unrecognized at import lands in "other".
      {
        name: "tag_type",
        type: "select",
        maxSelect: 1,
        values: [
          "pump_centrifugal", "valve_motor_operated", "motor",
          "instrument_flow", "instrument_level", "instrument_pressure",
          "analyzer", "control_panel", "loop", "other",
        ],
      },

      { name: "pid_reference", type: "text" }, // drawing sheet the tag lives on
      { name: "location_note", type: "text" },

      // Nameplate data, recorded once during installation checkout.
      { name: "manufacturer", type: "text" },
      { name: "model", type: "text" },
      { name: "serial_number", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    // Tag numbers are unique PER PROJECT, not globally — two plants can both
    // have a PMP-101. The route /t/{tag_number} therefore resolves against a
    // project context (the tag page picks the match; collisions across
    // projects are surfaced rather than guessed).
    indexes: [
      "CREATE UNIQUE INDEX `idx_tags_project_tagnumber` ON `tags` (`project`, `tag_number`)",
    ],
  });

  app.save(tags);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("tags"));
});
