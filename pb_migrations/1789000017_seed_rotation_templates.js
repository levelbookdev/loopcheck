/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load the four rotation-check templates from
// seed/checkout_templates.json (ADR 0008 — VFD Rotation & Parameter Check).
//
// A separate GUARDED loader, not an edit to 1789000009: that migration has
// already applied on existing databases, so this module must land
// additively. Unlike the service loader (1789000014), the templates live in
// the SAME seed file the original loader reads — checkout_templates.json is
// the one authoritative equipment-checkout library and is not fragmented
// per migration batch. The two paths converge on one copy:
//
//   - fresh database:    1789000009 loads the whole file, rotation
//                        templates included → this migration finds them
//                        present and skips.
//   - existing database: 1789000009 ran before the templates existed →
//                        this migration loads exactly the four keys.

const SEED_FILE = "checkout_templates.json";

const ROTATION_KEYS = [
  "pump_centrifugal.rotation", "pump_centrifugal.rotationVfd",
  "motor.rotation", "motor.rotationVfd",
];

// __hooks (the absolute path to pb_hooks/) is also defined inside migrations,
// and seed/ sits next to pb_hooks/ in the repo.
function readSeed() {
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${SEED_FILE}`)));
}

// Phases here are already lowercase ("energization"); kept for symmetry with
// the other loaders so a future camelCase phase converts correctly.
function toSnake(s) {
  return s ? s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()) : "";
}

migrate((app) => {
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const templateItems = app.findCollectionByNameOrId("template_items");

  for (const t of readSeed().templates) {
    if (!ROTATION_KEYS.includes(t.template_key)) continue;

    // Already present (fresh-install path, or a re-run) — skip, never dup.
    let exists = true;
    try {
      app.findFirstRecordByFilter(
        "checklist_templates", "template_key = {:k}", { k: t.template_key });
    } catch (_) {
      exists = false;
    }
    if (exists) continue;

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
      app.save(item);
    }
  }
}, (app) => {
  // Roll back exactly these keys. Deleting a template cascade-deletes its
  // template_items.
  for (const key of ROTATION_KEYS) {
    try {
      const rec = app.findFirstRecordByFilter(
        "checklist_templates", "template_key = {:k}", { k: key });
      app.delete(rec);
    } catch (_) {
      // not found — already gone
    }
  }
});
