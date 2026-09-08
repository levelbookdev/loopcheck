/// <reference path="../pb_data/types.d.ts" />
//
// Seed: load seed/shutdown_runbook_tie_in.json into the shutdown collections
// (ADR 0019, task 110).
//
// This file has been captured-but-unloaded since Phase 1. ARCHITECTURE.md §9
// set the condition for loading it — "one representation, loaded when Phase 4
// can hold it" — because a flat checklist cannot carry offsets, hold points,
// roles, or contingencies, and a flattened copy would silently diverge from the
// real runbook. Migrations S and T built collections that can hold all four, so
// the condition is met and this loads it.
//
// A LOADER, NOT A COPY (CLAUDE.md): the library lives in exactly one place. To
// change the runbook, edit the JSON and rebuild — never edit rows, and never
// edit the JSON to make loading easier.
//
// THE ONE ASYMMETRY TO PRESERVE (ADR 0019 §2): pre- and post-window steps carry
// a calendar-scale label ("T-14d", "T+24h") and NO minute fields; window steps
// carry planned_offset_min / planned_duration_min and NO label. Each form is
// right at its own scale, and the loader must NOT synthesize the missing one in
// either direction — "T-14d" -> -20160 invents precision nobody has, and
// turning 0 back into a label loses the negotiated-window clock that is the
// most valuable thing the module produces.
//
// Note window step seq 10 sits at planned_offset_min = 0 — that is T-0 exactly,
// a real value and not an unset field. Anything reasoning about these rows has
// to distinguish "zero" from "absent"; planned_duration_min is the honest
// discriminator, since every window step has one and no pre/post step does.

const SEED_FILE = "shutdown_runbook_tie_in.json";

function readSeed() {
  // __hooks is defined inside migrations and resolves regardless of the
  // directory the binary was launched from — same as every other loader.
  return JSON.parse(toString($os.readFile(`${__hooks}/../seed/${SEED_FILE}`))).runbook_template;
}

migrate((app) => {
  const rb = readSeed();

  // Guarded like 1789000017 / 1789000022: safe to re-run on a database that
  // already has this runbook. template_key is stored VERBATIM — it is an opaque
  // identifier and is never parsed.
  try {
    app.findFirstRecordByFilter(
      "shutdown_templates", "template_key = {:k}", { k: rb.template_key });
    return; // already loaded — nothing to do
  } catch (_) {
    // not found: fall through and load
  }

  const templates = app.findCollectionByNameOrId("shutdown_templates");
  const steps = app.findCollectionByNameOrId("shutdown_template_steps");
  const contingencies = app.findCollectionByNameOrId("shutdown_contingencies");
  const roles = app.findCollectionByNameOrId("shutdown_template_roles");

  const tpl = new Record(templates);
  tpl.set("template_key", rb.template_key);
  tpl.set("name", rb.name);
  tpl.set("notes", rb.notes || "");
  app.save(tpl);

  // The three step groups. `seq` is global across them in the source (1-8,
  // 10-21, 30-31, with deliberate gaps), which is what makes the unique
  // (template, seq) index safe.
  const GROUPS = [
    ["pre_window_steps", "pre_window"],
    ["window_steps", "window"],
    ["post_window_steps", "post_window"],
  ];

  for (const [key, group] of GROUPS) {
    for (const s of rb[key] || []) {
      const rec = new Record(steps);
      rec.set("template", tpl.id);
      rec.set("seq", s.seq);
      rec.set("group", group);
      rec.set("description", s.description);
      // responsible_party -> responsible_role_key: the template side is TEXT
      // because a library cannot point at a project's shutdown_roles row.
      rec.set("responsible_role_key", s.responsible_party || "");
      rec.set("hold_point", !!s.hold_point);

      // Set ONLY the form this group actually carries. The other stays unset.
      if (s.offset_label != null) rec.set("offset_label", s.offset_label);
      if (s.planned_offset_min != null) rec.set("planned_offset_min", s.planned_offset_min);
      if (s.planned_duration_min != null) rec.set("planned_duration_min", s.planned_duration_min);

      // tag_ref -> tag_ref_hint, verbatim. Loaded even where the source leaves
      // it null, so a future runbook that sets it works with no loader change.
      // NOTE: two steps in the current file carry an instructional placeholder
      // ("OPTIONAL: reference isolation valve tags here") rather than a real
      // hint. That is maintainer-authored content and the loader's job is
      // fidelity, so it is loaded as written rather than filtered.
      rec.set("tag_ref_hint", s.tag_ref || "");
      app.save(rec);
    }
  }

  // Contingencies are trigger/action pairs, not steps — no schedule position.
  // The source carries no `seq`, so ordering comes from array position: the
  // list is read top to bottom at 2 AM and must not reshuffle between loads.
  let cseq = 1;
  for (const c of rb.contingencies || []) {
    const rec = new Record(contingencies);
    rec.set("template", tpl.id);
    rec.set("seq", cseq++);
    rec.set("trigger", c.trigger);
    rec.set("action", c.action);
    app.save(rec);
  }

  // Template-level roles (migration T). NOT shutdown_roles — there is no
  // project at migration time, and these are the library's roles. Planning
  // copies them into a project and the operator adds the contacts.
  for (const r of rb.roles || []) {
    const rec = new Record(roles);
    rec.set("template", tpl.id);
    rec.set("role_key", r.role_key);
    rec.set("title", r.title);
    // Comma-joined to match shutdown_roles.notify_on, so the copy at planning
    // time needs no transform. Stored, never acted on.
    rec.set("notify_on", Array.isArray(r.notify_on) ? r.notify_on.join(",") : (r.notify_on || ""));
    app.save(rec);
  }
}, (app) => {
  // Delete exactly what this loaded, by template_key. Steps, contingencies and
  // template roles all cascade from the template.
  let rb;
  try {
    rb = readSeed();
  } catch (_) {
    return; // seed file gone — nothing to roll back from it
  }
  try {
    const rec = app.findFirstRecordByFilter(
      "shutdown_templates", "template_key = {:k}", { k: rb.template_key });
    app.delete(rec);
  } catch (_) {
    // not found — already gone
  }
});
