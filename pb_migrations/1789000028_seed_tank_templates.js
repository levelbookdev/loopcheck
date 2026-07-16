/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load the tank/basin acceptance templates from seed/tank_templates.json.
// A separate JSON file + loader (same mechanics as the service/training/segment
// loaders) that runs AFTER Migration N (1789000027) opens the `tank` tag_type
// and the `leak_test` phase — so on a fresh database those enum values exist
// before this template references them. Kept OUT of checkout_templates.json for
// that ordering reason (1789000009 runs before the enums are opened).
//
// A tank's required phases derive the usual way: the phases that have a
// subject_kind='tag', tag_type='tank' template. Today that is just leak_test.

const SEED_FILE = "tank_templates.json";

function readSeed() {
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${SEED_FILE}`)));
}

// JSON phases are camelCase; the DB is snake_case (leakTest -> leak_test).
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
    tpl.set("subject_kind", t.subject_kind || "tag");
    tpl.set("recurrence", t.recurrence || "");
    tpl.set("witness_required", !!t.witness_required);
    app.save(tpl);

    for (const i of t.items) {
      const item = new Record(templateItems);
      item.set("template", tpl.id);
      item.set("sequence", i.seq);
      item.set("text", i.text);
      item.set("response_type", i.response);
      item.set("unit", i.unit || "");
      item.set("confirm_per_spec", !!i.confirm_per_spec);
      item.set("spec_reference", i.spec_reference || "");
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
