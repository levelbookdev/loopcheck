/// <reference path="../pb_data/types.d.ts" />
//
// Migration J — the `training` phase (ADR 0013, training as a signable
// milestone check). Appends one value to the shared `phase` enum on both
// `checklist_templates` and `checks`, the same additive pattern the service
// phases used (Migration D): appending an enum value never invalidates an
// existing record or request.
//
// `training` is a phase VALUE but a MILESTONE — it is deliberately NOT one of
// the six checkout-sequence phases, and the checkout-standing fold ("N of 6
// phases / checkout complete") keeps ignoring it. It is derived and shown
// alongside, exactly as the readiness matrix places "Training Completed" beside
// the checkout columns. This migration only opens the enum; the training
// templates load in the next migration (they need this value to exist first,
// hence the separate, later migration — same ordering as services).

const TRAINING = ["training"];

migrate((app) => {
  for (const name of ["checklist_templates", "checks"]) {
    const c = app.findCollectionByNameOrId(name);
    const phase = c.fields.getByName("phase");
    phase.values = phase.values.concat(TRAINING);
    app.save(c);
  }
}, (app) => {
  for (const name of ["checklist_templates", "checks"]) {
    const c = app.findCollectionByNameOrId(name);
    const phase = c.fields.getByName("phase");
    phase.values = phase.values.filter((v) => TRAINING.indexOf(v) === -1);
    app.save(c);
  }
});
