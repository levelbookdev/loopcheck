/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load the domain checklist library from seed/*.json.
//
// seed/ is the AUTHORITATIVE template library, authored and maintained by the
// maintainer (the domain expert) — see seed/README.md for its schema. This
// migration is deliberately just a loader: it holds no checklist content of
// its own, so the library is never duplicated. To change the library, edit
// seed/ and reset the database (pre-release workflow).
//
// Not loaded here: seed/shutdown_runbook_tie_in.json. The runbook is a richer
// structure (time offsets, hold points, roles) that flat checklist templates
// cannot represent; it stays as captured domain knowledge in seed/ until
// Phase 4 builds real shutdown collections.
//
// Mapping notes (seed JSON → collections):
//   - phase is camelCase in the JSON ("pointToPoint") and snake_case in the
//     DB ("point_to_point") — converted mechanically below. template_key is
//     kept VERBATIM as an opaque identifier.
//   - recurrence null → blank (= a one-time checkout checklist).
//   - item.response → response_type; item.seq → sequence.

const SEED_FILES = ["checkout_templates.json", "compliance_templates.json"];

// __hooks (the absolute path to pb_hooks/) is also defined inside migrations,
// and seed/ sits next to pb_hooks/ in the repo — so this resolves correctly
// no matter which directory the binary was launched from.
function readSeed(fname) {
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${fname}`)));
}

// "pointToPoint" → "point_to_point", "loopCheck" → "loop_check";
// already-lowercase phases pass through unchanged.
function toSnake(s) {
  return s ? s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()) : "";
}

migrate((app) => {
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const templateItems = app.findCollectionByNameOrId("template_items");

  for (const fname of SEED_FILES) {
    for (const t of readSeed(fname).templates) {
      const tpl = new Record(templates);
      tpl.set("template_key", t.template_key);
      tpl.set("name", t.name);
      tpl.set("tag_type", t.tag_type || "");
      tpl.set("phase", toSnake(t.phase || ""));
      tpl.set("subject_kind", t.subject_kind || "tag");
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
        item.set("spec_reference", i.spec_reference || "");
        app.save(item);
      }
    }
  }
}, (app) => {
  // Roll back exactly what this seed loaded, by template_key. Deleting a
  // template cascade-deletes its template_items.
  for (const fname of SEED_FILES) {
    let parsed;
    try {
      parsed = readSeed(fname);
    } catch (_) {
      continue; // seed file gone — nothing to roll back from it
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
  }
});
