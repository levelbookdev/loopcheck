/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load the training milestone templates from
// seed/training_templates.json (ADR 0013). Same mechanics as the service
// loader (1789000014): a separate file + a loader migration that runs AFTER
// the phase-enum extension (Migration J), so a fresh database has `training`
// in the enum before these templates — with phase=training — are created.
//
// Kept out of checkout_templates.json (which the early loader 1789000009
// reads on fresh databases) precisely so this ordering holds: 1789000009 must
// not try to create a phase=training template before Migration J opens the
// enum. A tag's REQUIRED phases are still derived; training is derived as a
// MILESTONE, shown beside checkout standing, never folded into it.
//
// Unlike the other loaders, this one also carries `witness_required` from the
// JSON — the Training Summary forms are multi-party signed, so the template
// arrives witness_required=true.

const SEED_FILE = "training_templates.json";

function readSeed() {
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${SEED_FILE}`)));
}

// "training" is already lowercase; kept for symmetry with the other loaders.
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
