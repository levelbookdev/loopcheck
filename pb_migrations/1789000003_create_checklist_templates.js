/// <reference path="../pb_data/types.d.ts" />
//
// Collection: checklist_templates — a named, ordered checklist for one phase of
// one kind of equipment (e.g. "Centrifugal Pump — Functional"). Seeded from the
// domain library in the seed migration. The check-EXECUTION UI is Phase 2; this
// collection just holds the templates.
//
// Deliberately NOT a forms designer: a template is a flat, ordered list of line
// items (see template_items). No branching, no conditional logic.

migrate((app) => {
  const templates = new Collection({
    type: "base",
    name: "checklist_templates",

    // HISTORICAL (auth): the rules below are what THIS migration shipped.

    // The auth lockdown has since landed -- migrations 1789000019 / 1789000020 /

    // 1789000033 (ADR 0011, Accepted) set the live rules. See docs/API.md.
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,

    fields: [
      { name: "name", type: "text", required: true, presentable: true },

      // Stable identifier from the seed library, e.g. "pump_centrifugal.loopCheck"
      // (kept verbatim from seed/ — it is an opaque key, not parsed). Makes the
      // seed idempotent and gives Phase 2 a reference that survives renames.
      // Blank for user-created templates; uniqueness is only enforced when set
      // (partial index below).
      { name: "template_key", type: "text" },

      // tag_type and phase are OPTIONAL: equipment checkout templates fill both
      // (that is how Phase 2 will pick the right checklist for a tag), while
      // process/compliance templates (excavation inspection, dewatering log)
      // are not tag-scoped and leave them blank. A blank tag_type simply means
      // "this template never auto-appears for a piece of equipment."
      //
      // A tag's REQUIRED phases are derived from this collection: the phases
      // that have a template for its tag_type. No separate map to maintain.
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
      {
        name: "phase",
        type: "select",
        maxSelect: 1,
        values: [
          "installation", "point_to_point", "energization",
          "loop_check", "functional", "performance",
        ],
      },

      // What the checklist runs against: a piece of equipment (tag) or a place
      // (location — an excavation, a discharge point). Location subjects are the
      // Phase 5 compliance module; the field exists now so templates carry it.
      {
        name: "subject_kind",
        type: "select",
        maxSelect: 1,
        values: ["tag", "location"],
      },

      // recurrence drives the later compliance module (Phase 5). BLANK means a
      // one-time checkout checklist (the normal case); daily / per_shift /
      // per_event drive repeating logs.
      {
        name: "recurrence",
        type: "select",
        maxSelect: 1,
        values: ["daily", "per_shift", "per_event"],
      },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    // Unique only where a key exists — user-created templates leave it blank,
    // and two blanks must not collide (hence the partial index).
    indexes: [
      "CREATE UNIQUE INDEX `idx_templates_key` ON `checklist_templates` (`template_key`) WHERE `template_key` != ''",
    ],
  });

  app.save(templates);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("checklist_templates"));
});
