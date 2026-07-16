/// <reference path="../pb_data/types.d.ts" />
//
// Migration F — tags.has_vfd (ADR 0008, VFD Rotation & Parameter Check).
//
// One additive capture-side boolean, the ADR 0002 pattern: whether the
// equipment is driven by a VFD is an equipment-schedule fact, captured at
// CSV import so nothing needs retro-tagging. It decides which rotation
// template the capture page offers (rotation vs rotationVfd — two
// templates, not an if-statement; hard constraint #5).
//
// It is nameplate-class data, NOT status — a tag's rotation standing stays
// derived from its check ledger (hard constraint #4).

migrate((app) => {
  const tags = app.findCollectionByNameOrId("tags");
  tags.fields.add(new Field({ name: "has_vfd", type: "bool" }));
  app.save(tags);
}, (app) => {
  const tags = app.findCollectionByNameOrId("tags");
  tags.fields.removeByName("has_vfd");
  app.save(tags);
});
