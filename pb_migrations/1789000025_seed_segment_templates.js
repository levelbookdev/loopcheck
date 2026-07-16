/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load the segment acceptance templates from
// seed/segment_templates.json (Phase 6, ADR 0014). Same mechanics as the
// service loader (1789000014) and training loader (1789000022): a separate
// JSON file + a loader migration that runs AFTER Migration L (1789000024),
// which opens `subject_kind` to `segment`, extends the template `tag_type`
// enum with the three segment types, and appends the six segment phases. So on
// a fresh database those enum values exist before these templates reference
// them.
//
// Kept OUT of checkout_templates.json (which the early loader 1789000009 reads
// on fresh databases) for exactly that ordering reason — 1789000009 must not
// try to create a subject_kind='segment' / phase='hydro' template before the
// enums are opened.
//
// A segment's REQUIRED phases are still derived: the phases that have a
// subject_kind='segment' template for its segment_type (matched against the
// template's tag_type field, reused as the subject-type discriminator per
// ADR 0014). No stored map.

const SEED_FILE = "segment_templates.json";

function readSeed() {
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${SEED_FILE}`)));
}

// JSON phases are camelCase; the DB is snake_case (e.g. bacT -> bac_t,
// airTest -> air_test). tag_type / subject_kind are stored verbatim.
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
    tpl.set("tag_type", t.tag_type || "");        // = segment_type (subject type)
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
