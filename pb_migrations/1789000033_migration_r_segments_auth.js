/// <reference path="../pb_data/types.d.ts" />
//
// Migration R — close the one rule the auth lockdown missed (ADR 0011).
//
// `segments` was created by Migration L (1789000024) AFTER Migration H
// (1789000019) had already rewritten the permissive Phase-1 rules, so it landed
// with the Phase-1 shape — public list/view/create/update — and a `TODO(auth)`
// that the lockdown had by then already answered for every comparable
// collection. It was the last world-writable collection in the schema, and the
// last blocker in the README's internet-exposure warning (since removed).
//
// Maintainer ruling (2026-07-19): segments lock to auth, matching `tags`.
// Reads stay PUBLIC — a segment is field-facing subject data like a tag, and
// public reads are what the scan-shows-status promise is built on (hard
// constraint #1). Writes become authenticated: creating or editing a segment is
// the office/engineering act of defining scope, never an accountless one.
//
// Note this collection is frozen at maintenance-only — segment ACCEPTANCE moved
// to MainLine (see CLAUDE.md, Phase 6). Locking the rule is maintenance, not
// new work on that module: landed records can't be relabeled, so the collection
// stays, and a collection that stays must not be world-writable.
//
// Rule-only and safe to apply/rollback; no columns, no data movement.

migrate((app) => {
  const AUTH = '@request.auth.id != ""';
  const segments = app.findCollectionByNameOrId("segments");
  // list/view deliberately untouched ("" = public), same as tags/systems.
  segments.createRule = AUTH;
  segments.updateRule = AUTH;
  // deleteRule was already null (superuser-only) from Migration L.
  app.save(segments);
}, (app) => {
  // Rollback to the Phase-1 permissive rules Migration L created it with.
  const segments = app.findCollectionByNameOrId("segments");
  segments.createRule = "";
  segments.updateRule = "";
  app.save(segments);
});
