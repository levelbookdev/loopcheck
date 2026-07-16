/// <reference path="../pb_data/types.d.ts" />
//
// Migration K — the open→resolve schema (ADR 0012). A record that is signed at
// one time and resolves later (a bac-t sample awaiting the lab, a multi-day
// reliability run) is modeled as a LINKED PAIR of append-only checks: an OPEN
// event with `result: "pending"`, and a later RESOLVE event that carries the
// pass/fail and points back via `resolves`. Neither mutates the other —
// append-only holds (hard constraint #2); a reset is a new open event.
//
// Two additive changes, no reset:
//   - `checks.result` gains `pending` (the open state; distinct from
//     `incomplete`, which means a checklist was abandoned mid-run).
//   - `checks.resolves` — a self-relation: the resolve check points at the open
//     check it resolves.
//
// Phase 6 (segments / bac-t) is the first user; reliability runs adopt it later
// with no further schema.

migrate((app) => {
  const checks = app.findCollectionByNameOrId("checks");

  const result = checks.fields.getByName("result");
  result.values = result.values.concat(["pending"]);

  checks.fields.add(new Field({
    name: "resolves", type: "relation", required: false, maxSelect: 1,
    collectionId: checks.id, cascadeDelete: false,
  }));
  app.save(checks);

  const idx = checks.indexes;
  idx.push("CREATE INDEX `idx_checks_resolves` ON `checks` (`resolves`)");
  checks.indexes = idx;
  app.save(checks);
}, (app) => {
  const checks = app.findCollectionByNameOrId("checks");
  checks.indexes = checks.indexes.filter((s) => s.indexOf("idx_checks_resolves") === -1);
  checks.fields.removeByName("resolves");
  const result = checks.fields.getByName("result");
  result.values = result.values.filter((v) => v !== "pending");
  app.save(checks);
});
