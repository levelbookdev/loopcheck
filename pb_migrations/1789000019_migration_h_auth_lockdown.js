/// <reference path="../pb_data/types.d.ts" />
//
// Migration H — the auth lockdown (ADR 0011, DRAFT — lands when 0011 is
// accepted). Closes the Phase-1 permissive rules that make an internet-facing
// LoopCheck world-writable, WITHOUT breaking hard constraint #1 (the
// accountless field tier). This is deliberately NOT a uniform
// `@request.auth.id != ""` sweep — that would lock the public reads a scanned
// QR needs and the accountless punch/check writes the field tier is defined
// by. See ADR 0011 for the access matrix and the reasoning.
//
// Maintainer rulings baked in:
//   §3 — check-logging stays ACCOUNTLESS (checks/check_items create public),
//        integrity via append-only + PocketBase rate limiting, not CAPTCHA.
//   §7 — signatures will require an account (enforced when the signatures
//        collection lands with ADR 0010; nothing to lock here yet).
//
// The PII split (customer_name/phone -> service_contacts) is a separate,
// destructive migration (I) because it drops columns and needs coordinated
// frontend changes. This migration is rule-only and safe to apply/rollback.

migrate((app) => {
  const AUTH = '@request.auth.id != ""';
  const setRules = (name, rules) => {
    const c = app.findCollectionByNameOrId(name);
    for (const k in rules) c[k] = rules[k];
    app.save(c);
  };

  // ---- Field-facing data: PUBLIC READ (a scanned QR renders it), AUTH WRITE.
  // Creating tags/systems/services is the CSV-import onboarding moment — free
  // (constraint #7) but done by someone with an account, not anonymous.
  for (const name of ["projects", "systems", "tags",
                      "checklist_templates", "template_items", "services"]) {
    setRules(name, { createRule: AUTH, updateRule: AUTH }); // list/view stay public ("")
  }

  // ---- Office-only data: no field-scan surface, so READS go behind auth too.
  for (const name of ["warranties", "closeout_requirements"]) {
    setRules(name, { listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH });
  }
  // closeout_log: append-only office trail (update/delete already null).
  setRules("closeout_log", { listRule: AUTH, viewRule: AUTH, createRule: AUTH });
  // warranty_claims: office, and the close-once rule is preserved AND gated.
  setRules("warranty_claims", {
    listRule: AUTH, viewRule: AUTH, createRule: AUTH,
    updateRule: AUTH + ' && closed_at = ""',
  });

  // ---- test_equipment: §3 ripple. Accountless check-logging READS the
  // registry (to pick instruments) and CREATES into it (the inline
  // "add an instrument"), so read + create stay PUBLIC. Only the cal-date
  // roll-forward edit is an office action.
  setRules("test_equipment", { updateRule: AUTH });

  // ---- attachments: polymorphic. A field photo on a check line or a punch
  // item stays PUBLIC (that IS the evidence the field tier captures); an
  // office attachment (calibration cert on test_equipment, warranty cert)
  // requires auth. The rule inspects the submitted parent_collection.
  setRules("attachments", {
    createRule:
      'parent_collection = "check_items" || parent_collection = "punch_items" || ' + AUTH,
  });

  // ---- punch_items: FLAG stays accountless (create, §3 — a laborer must be
  // able to report a defect with no account), but CLOSE requires auth. Unlike
  // flagging, which only adds correctable noise, an accountless close lets
  // anyone HIDE a blocker by closing the A-items on an internet instance;
  // closing is a lifecycle state change with attribution, so it belongs to the
  // authenticated tier. This supersedes the earlier accountless-close approval
  // on the tag page — that flow stays, but now behind the login.
  setRules("punch_items", { updateRule: AUTH });

  // ---- Deliberately UNCHANGED (documented so the absence is intentional):
  //   checks, check_items  — accountless field writes (§3); reads public;
  //                          append-only (update/delete already null). The
  //                          checks XOR-subject createRule (ADR 0001/0006)
  //                          stays exactly as-is.
  //   punch_items create   — accountless FLAG kept (§3); the XOR-subject
  //                          createRule (ADR 0006) stays as-is. (Close is
  //                          gated just above.)
  //   loto_events          — accountless field safety logging (ADR 0007's
  //                          dead-zone electrician); reads public (safety
  //                          visibility never gated); append-only. Its
  //                          photo/note createRule stays as Migration E set it.

  // ---- users: no self-signup, or the lockdown is decorative. Accounts are
  // created in the admin UI. A `role` marker lands for the sidecar (ADR 0003
  // §5) and future per-person features; v1 write rules use plain AUTH, so the
  // sidecar is read-only by construction (a separate app that only reads) —
  // role-gating office writes with `&& @request.auth.role != "service"` is a
  // trivial follow-up if belt-and-suspenders is wanted, but note field writes
  // are public anyway, so it buys little today.
  const users = app.findCollectionByNameOrId("users");
  users.createRule = null;
  users.fields.add(new Field({
    name: "role", type: "select", maxSelect: 1, values: ["field", "pm", "service"],
  }));
  app.save(users);
}, (app) => {
  // Rollback to the Phase-1 permissive rules.
  const setRules = (name, rules) => {
    const c = app.findCollectionByNameOrId(name);
    for (const k in rules) c[k] = rules[k];
    app.save(c);
  };
  for (const name of ["projects", "systems", "tags",
                      "checklist_templates", "template_items", "services"]) {
    setRules(name, { createRule: "", updateRule: "" });
  }
  for (const name of ["warranties", "closeout_requirements"]) {
    setRules(name, { listRule: "", viewRule: "", createRule: "", updateRule: "" });
  }
  setRules("closeout_log", { listRule: "", viewRule: "", createRule: "" });
  setRules("warranty_claims", {
    listRule: "", viewRule: "", createRule: "", updateRule: 'closed_at = ""',
  });
  setRules("test_equipment", { updateRule: "" });
  setRules("attachments", { createRule: "" });
  setRules("punch_items", { updateRule: "" });

  const users = app.findCollectionByNameOrId("users");
  users.createRule = "";
  users.fields.removeByName("role");
  app.save(users);
});
