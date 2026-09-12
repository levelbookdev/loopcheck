/// <reference path="../pb_data/types.d.ts" />
//
// Migration U — let a planner delete an UNEXECUTED shutdown step (ADR 0019,
// task 120). This is the first non-admin delete rule in the schema, so it is
// worth being explicit about why it is not a hole.
//
// THE PROBLEM. Task 120 requires a planner to remove steps: "a real tie-in is
// never exactly the generic runbook." Every collection in LoopCheck ships
// `deleteRule: null` (superuser only) and docs/API.md publishes that as a
// contract property, so as built there was no way to do it.
//
// WHY THIS IS SAFE, and why it is not the same question as the ledgers.
// `shutdown_steps` is a DRAFT, not evidence. It is the plan a planner is still
// writing days before the outage, and ADR 0019 already made it editable for
// exactly that reason — a row you may freely reword, reorder and re-offset is
// not one whose deletion needs protecting. What carries the evidentiary weight
// is `shutdown_step_events`, which stays append-only AND superuser-only-delete,
// untouched here. Nothing about the record of what actually happened changes.
//
// THE GUARD. The rule is not a bare auth check. A step that has ANY event
// against it has been executed — started, held, completed, whatever — and is no
// longer a draft; deleting it would strand real events pointing at a step that
// no longer exists. So the back-relation must be empty:
//
//   @request.auth.id != "" && shutdown_step_events_via_step.id = ""
//
// which means "signed in, AND nothing has happened to this step yet". The
// transition from draft to record therefore happens by itself, at the moment
// the first event lands, with no status column and nothing to remember
// (constraint #4). Verified behaviour: an unexecuted step deletes for a
// signed-in planner (204); a step with one event is refused for that same
// planner (404); an anonymous delete is refused (404).
//
// Note the events' own `step` relation stays cascadeDelete:false, and events
// carry `frozen_description` — so even in the superuser case where a step with
// events IS force-removed, the ledger stays readable on its own terms.
//
// NOT extended to `shutdowns` itself, deliberately: deleting a whole shutdown
// would cascade its steps (cascadeDelete:true) and orphan every event for the
// outage at once. That stays superuser-only, where it belongs.

migrate((app) => {
  const steps = app.findCollectionByNameOrId("shutdown_steps");
  steps.deleteRule =
    '@request.auth.id != "" && shutdown_step_events_via_step.id = ""';
  app.save(steps);
}, (app) => {
  const steps = app.findCollectionByNameOrId("shutdown_steps");
  steps.deleteRule = null; // back to superuser-only
  app.save(steps);
});
