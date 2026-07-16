/// <reference path="../pb_data/types.d.ts" />
//
// Migration B — test-equipment traceability & punch evidence links
// (ADR 0004, DATA_MODEL_PLAN Rev 1). Lands with Phase 2: the
// check-execution UI is what populates these fields. All additive; no
// DB reset.

migrate((app) => {
  // ---- test_equipment: a GLOBAL registry (serial number is the identity;
  // a meter moves between jobs). Editable catalog, not a ledger — the
  // frozen note on checks preserves history. Cal certs attach via the
  // polymorphic attachments collection (parent_collection = "test_equipment").
  const testEquipment = new Collection({
    type: "base",
    name: "test_equipment",

    // TODO(auth): before internet exposure, change every "" rule to:
    //   @request.auth.id != ""
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "", // catalog stays correctable (cal_due rolls forward)
    deleteRule: null, // admin-only

    fields: [
      // "Fluke 754 Documenting Process Calibrator"
      { name: "description", type: "text", required: true, presentable: true },
      { name: "manufacturer", type: "text" },
      { name: "model", type: "text" },
      { name: "serial_number", type: "text" },

      // When the current calibration expires. The contractual rule the
      // premium watchdog derives from: NIST-traceable within the previous
      // 90 days of use (see ADR 0004). Core stores the fact, not an alert.
      { name: "cal_due", type: "date" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(testEquipment);

  // ---- checks: which instruments performed the check --------------------
  const checks = app.findCollectionByNameOrId("checks");
  // Up to 3: a loop check can involve a calibrator, a meter, and a
  // pressure module.
  checks.fields.add(new Field({
    name: "test_equipment_used", type: "relation", maxSelect: 3,
    collectionId: testEquipment.id, cascadeDelete: false,
  }));
  // Frozen at execution ("Fluke 754 s/n 8823, cal due 2026-09-01") — same
  // pattern as the frozen prompt text: the append-only record reads
  // correctly even if the registry is edited later.
  checks.fields.add(new Field({ name: "test_equipment_note", type: "text" }));
  app.save(checks);

  // ---- punch_items: the evidence chain -----------------------------------
  // "Raised by check 118, cleared by check 235." Both optional — plenty of
  // punch items close without a retest.
  const punch = app.findCollectionByNameOrId("punch_items");
  punch.fields.add(new Field({
    name: "source_check", type: "relation", maxSelect: 1,
    collectionId: checks.id, cascadeDelete: false,
  }));
  punch.fields.add(new Field({
    name: "closing_check", type: "relation", maxSelect: 1,
    collectionId: checks.id, cascadeDelete: false,
  }));
  app.save(punch);
}, (app) => {
  // Rollback: remove exactly what this migration added.
  const punch = app.findCollectionByNameOrId("punch_items");
  punch.fields.removeByName("source_check");
  punch.fields.removeByName("closing_check");
  app.save(punch);

  const checks = app.findCollectionByNameOrId("checks");
  checks.fields.removeByName("test_equipment_used");
  checks.fields.removeByName("test_equipment_note");
  app.save(checks);

  app.delete(app.findCollectionByNameOrId("test_equipment"));
});
