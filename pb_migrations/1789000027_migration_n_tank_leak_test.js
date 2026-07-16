/// <reference path="../pb_data/types.d.ts" />
//
// Migration N — the `tank` tag_type and the `leak_test` phase (second-pass
// forms-library review §2, Tank Leak Test). A tank/basin is an ordinary TAG
// subject; its checkout is the 48-hr leak test, which needs its own phase (the
// six electrical/instrument checkout phases don't fit a hydrostatic tank test).
//
// Purely additive enum values — appending never invalidates existing records,
// so no reset is required (same shape as Migration L for the segment types):
//   - tags.tag_type              += "tank"      (so tank tags can exist)
//   - checklist_templates.tag_type += "tank"    (so the leak-test template seeds)
//   - checks.phase / checklist_templates.phase += "leak_test"
//
// The tank leak test is an ADR-0012 open->resolve duration test; that SCHEMA
// (checks.result 'pending' + checks.resolves) already landed in Migration K
// (1789000023), so nothing new is needed here for the pattern itself. The
// template is loaded by 1789000028 (after this migration opens the enums), for
// the same ordering reason the segment templates load after Migration L.

migrate((app) => {
  const tags = app.findCollectionByNameOrId("tags");
  const tagType = tags.fields.getByName("tag_type");
  tagType.values = tagType.values.concat(["tank"]);
  app.save(tags);

  const templates = app.findCollectionByNameOrId("checklist_templates");
  const tplType = templates.fields.getByName("tag_type");
  tplType.values = tplType.values.concat(["tank"]);
  const tplPhase = templates.fields.getByName("phase");
  tplPhase.values = tplPhase.values.concat(["leak_test"]);
  app.save(templates);

  const checks = app.findCollectionByNameOrId("checks");
  const ckPhase = checks.fields.getByName("phase");
  ckPhase.values = ckPhase.values.concat(["leak_test"]);
  app.save(checks);
}, (app) => {
  const tags = app.findCollectionByNameOrId("tags");
  const tagType = tags.fields.getByName("tag_type");
  tagType.values = tagType.values.filter((v) => v !== "tank");
  app.save(tags);

  const templates = app.findCollectionByNameOrId("checklist_templates");
  const tplType = templates.fields.getByName("tag_type");
  tplType.values = tplType.values.filter((v) => v !== "tank");
  const tplPhase = templates.fields.getByName("phase");
  tplPhase.values = tplPhase.values.filter((v) => v !== "leak_test");
  app.save(templates);

  const checks = app.findCollectionByNameOrId("checks");
  const ckPhase = checks.fields.getByName("phase");
  ckPhase.values = ckPhase.values.filter((v) => v !== "leak_test");
  app.save(checks);
});
