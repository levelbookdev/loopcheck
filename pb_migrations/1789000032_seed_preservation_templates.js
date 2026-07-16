/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load the stored-equipment preservation logs from
// seed/preservation_templates.json (ADR 0015). A separate file + loader (same
// mechanics as the service/training/segment/tank loaders) that runs AFTER
// Migration Q (1789000031) opens the `weekly` / `monthly` recurrence cadences —
// so on a fresh database those enum values exist before these templates
// reference them. Kept OUT of compliance_templates.json (which the early loader
// 1789000009 reads before the enum is extended) for that ordering reason.
//
// These are recurring tag-subject templates (recurrence set, phase null), so
// they stay outside the required-phases derivation — like the compliance logs.

const SEED_FILE = "preservation_templates.json";

function readSeed() {
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${SEED_FILE}`)));
}

migrate((app) => {
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const templateItems = app.findCollectionByNameOrId("template_items");

  for (const t of readSeed().templates) {
    const tpl = new Record(templates);
    tpl.set("template_key", t.template_key);
    tpl.set("name", t.name);
    tpl.set("tag_type", t.tag_type || "");        // null -> "" (not tag-type-specific)
    tpl.set("phase", "");                          // recurring log — no checkout phase
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
