/// <reference path="../pb_data/types.d.ts" />
//
// Migration A — capture-side fields (ADR 0002, DATA_MODEL_PLAN Rev 1).
//
// Fields whose values are captured at import time or check time, landing
// BEFORE crews start logging so nothing needs retro-tagging later. All
// optional, all additive — this is a plain forward migration; unlike the
// seed reconciliation it needs no DB reset.

migrate((app) => {
  // ---- tags: the instrument-index facts -----------------------------------
  const tags = app.findCollectionByNameOrId("tags");
  tags.fields.add(new Field({ name: "area", type: "text" }));          // construction area, orthogonal to system
  tags.fields.add(new Field({ name: "spec_section", type: "text" }));  // governing spec section, e.g. "11312"
  tags.fields.add(new Field({ name: "loop_numbers", type: "text" }));  // comma-separated loop number(s)
  tags.fields.add(new Field({ name: "plc", type: "text" }));           // PLC/RTU serving this tag's I/O
  tags.fields.add(new Field({ name: "mcc_breaker", type: "text" }));   // MCC bucket / breaker feeding it
  tags.fields.add(new Field({ name: "drawing_refs", type: "text" }));  // single line, schematic, loop drawing
  app.save(tags);

  // ---- systems: order says sequence; alerts need calendar -----------------
  const systems = app.findCollectionByNameOrId("systems");
  systems.fields.add(new Field({ name: "planned_startup", type: "date" }));
  app.save(systems);

  // ---- witness_required: template data, frozen onto checks ----------------
  const templates = app.findCollectionByNameOrId("checklist_templates");
  templates.fields.add(new Field({ name: "witness_required", type: "bool" }));
  app.save(templates);

  // Frozen copy at execution time (Phase 2 sets it), same pattern as the
  // frozen prompt text: the historical record reads correctly even if the
  // template is later edited.
  const checks = app.findCollectionByNameOrId("checks");
  checks.fields.add(new Field({ name: "witness_required", type: "bool" }));
  app.save(checks);

  // NOTE: template_items.spec_reference was originally added here; it moved to
  // the create_template_items migration (1789000004) so the earlier seed loader
  // can populate it. See ADR 0002.
}, (app) => {
  // Rollback: remove exactly what this migration added.
  const drop = (collectionName, fieldNames) => {
    const c = app.findCollectionByNameOrId(collectionName);
    for (const f of fieldNames) c.fields.removeByName(f);
    app.save(c);
  };
  drop("tags", ["area", "spec_section", "loop_numbers", "plc", "mcc_breaker", "drawing_refs"]);
  drop("systems", ["planned_startup"]);
  drop("checklist_templates", ["witness_required"]);
  drop("checks", ["witness_required"]);
});
