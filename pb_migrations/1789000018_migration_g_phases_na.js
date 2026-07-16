/// <reference path="../pb_data/types.d.ts" />
//
// Migration G — tags.phases_na (ADR 0009, per-tag phase applicability).
//
// One additive capture-side text field, the ADR 0002 pattern: which checkout
// phases legitimately do NOT apply to THIS specific tag (an across-the-line
// motor has no configuration/VFD phase; a hardwired float switch has no
// analog loop check). Holds phase keys as a space/comma-separated list,
// captured at import so the readiness matrix never false-reds a phase that
// was never going to happen.
//
// It refines the DERIVED required-phases set — it is an applicability INPUT,
// not a stored status (hard constraint #4): required = has a template for the
// tag_type AND not listed here. A blank value (the common case) means every
// templated phase applies, exactly as before.

migrate((app) => {
  const tags = app.findCollectionByNameOrId("tags");
  tags.fields.add(new Field({ name: "phases_na", type: "text" }));
  app.save(tags);
}, (app) => {
  const tags = app.findCollectionByNameOrId("tags");
  tags.fields.removeByName("phases_na");
  app.save(tags);
});
