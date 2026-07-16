/// <reference path="../pb_data/types.d.ts" />
//
// Migration Q — periodic recurrence cadences (ADR 0015). The `recurrence` enum
// on checklist_templates was `[daily, per_shift, per_event]` — the compliance
// cadences. The stored-equipment preservation log runs on a *periodic* clock, so
// add `weekly` and `monthly`.
//
// Purely additive enum values — appending never invalidates existing records, so
// no reset (same shape as Migrations L/N/O/P). Recurring templates (recurrence
// set, phase null) stay outside the required-phases derivation, exactly like the
// compliance logs. The preservation templates load in 1789000032, after this.

migrate((app) => {
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const recurrence = templates.fields.getByName("recurrence");
  recurrence.values = recurrence.values.concat(["weekly", "monthly"]);
  app.save(templates);
}, (app) => {
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const recurrence = templates.fields.getByName("recurrence");
  recurrence.values = recurrence.values.filter((v) => v !== "weekly" && v !== "monthly");
  app.save(templates);
});
