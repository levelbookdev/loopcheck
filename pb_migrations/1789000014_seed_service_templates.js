/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load the service cutover template library from
// seed/service_templates.json (ADR 0006 — Service Cutover Tracker).
//
// A separate loader migration, NOT an edit to 1789000009: that migration has
// already applied on existing databases, and this module must land additively
// (no DB reset). Same mechanics as the original loader — this file holds no
// checklist content of its own; seed/ stays the single authoritative source.
//
// A service's REQUIRED phases are derived from what this loads: the phases
// that have a subject_kind='service' template. No stored phase map.

const SEED_FILE = "service_templates.json";

// __hooks (the absolute path to pb_hooks/) is also defined inside migrations,
// and seed/ sits next to pb_hooks/ in the repo.
function readSeed() {
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${SEED_FILE}`)));
}

// "locatePothole" → "locate_pothole", "tieOver" → "tie_over";
// already-lowercase phases (notice, meter, restoration) pass through.
function toSnake(s) {
  return s ? s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()) : "";
}

migrate((app) => {
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const templateItems = app.findCollectionByNameOrId("template_items");

  for (const t of readSeed().templates) {
    const tpl = new Record(templates);
    tpl.set("template_key", t.template_key);
    tpl.set("name", t.name);
    tpl.set("tag_type", t.tag_type || "");
    tpl.set("phase", toSnake(t.phase || ""));
    tpl.set("subject_kind", t.subject_kind || "service");
    tpl.set("recurrence", t.recurrence || "");
    app.save(tpl);

    for (const i of t.items) {
      const item = new Record(templateItems);
      item.set("template", tpl.id);
      item.set("sequence", i.seq);
      item.set("text", i.text);
      item.set("response_type", i.response);
      item.set("unit", i.unit || "");
      item.set("confirm_per_spec", !!i.confirm_per_spec);
      app.save(item);
    }
  }
}, (app) => {
  // Roll back exactly what this loaded, by template_key (items cascade).
  let parsed;
  try {
    parsed = readSeed();
  } catch (_) {
    return; // seed file gone — nothing to roll back from it
  }
  for (const t of parsed.templates) {
    try {
      const rec = app.findFirstRecordByFilter(
        "checklist_templates", "template_key = {:k}", { k: t.template_key });
      app.delete(rec);
    } catch (_) {
      // not found — already gone
    }
  }
});
