/// <reference path="../pb_data/types.d.ts" />
//
// Migration L — pipeline segments, the FOURTH subject kind (ADR 0014, Phase 6).
// The ADR 0006 recipe repeated a fourth time: a `segments` collection, and one
// more nullable relation on `checks`/`punch_items` with the exactly-one-subject
// createRule extended to four-way (tag XOR system XOR service XOR segment).
//
// A segment's required phases derive by its `segment_type` (pressure vs gravity
// owe different acceptance tests), the same shape as a tag's by `tag_type` —
// so segment templates reuse the template `tag_type` field to hold the segment
// type (documented in ADR 0014, not renamed). New phases append to the shared
// enum. All additive; no DB reset.

const SEGMENT_TYPES = ["pressure_main", "force_main", "gravity_sewer"];
const SEGMENT_PHASES = ["hydro", "disinfection", "bac_t", "air_test", "deflection", "vacuum"];

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");

  // ---- segments: station-to-station reach of pipe, keyed by segment_id ------
  const segments = new Collection({
    type: "base",
    name: "segments",
    // TODO(auth): before internet exposure the field-facing "" rules become
    //   @request.auth.id != ""   (segments are office/engineering-facing; the
    //   auth-lockdown ADR decides the exact tier).
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,
    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      // Human label — the station range, e.g. "STA 10+00 to 16+50". Unique per
      // project like a tag_number; this is the /seg/{id} page's headline.
      { name: "segment_id", type: "text", required: true, presentable: true },
      // Drives required phases: pressure mains owe hydro/disinfection/bac_t,
      // gravity sewers owe air_test/deflection/vacuum. Templates key on this
      // via their tag_type field (ADR 0014).
      { name: "segment_type", type: "select", maxSelect: 1, values: SEGMENT_TYPES },
      { name: "from_station", type: "text" },
      { name: "to_station", type: "text" },
      { name: "size", type: "text" },       // nominal diameter
      { name: "material", type: "text" },    // PVC / DIP / HDPE / …
      { name: "length_ft", type: "number" },
      { name: "description", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_segments_project_segid` ON `segments` (`project`, `segment_id`)",
    ],
  });
  app.save(segments);

  // ---- checklist_templates: fourth subject kind, segment types, new phases --
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const kind = templates.fields.getByName("subject_kind");
  kind.values = kind.values.concat(["segment"]);
  const tplType = templates.fields.getByName("tag_type"); // = subject type (ADR 0014)
  tplType.values = tplType.values.concat(SEGMENT_TYPES);
  const tplPhase = templates.fields.getByName("phase");
  tplPhase.values = tplPhase.values.concat(SEGMENT_PHASES);
  app.save(templates);

  // ---- checks: the fourth subject relation + phases + four-way XOR ----------
  const checks = app.findCollectionByNameOrId("checks");
  checks.fields.add(new Field({
    name: "segment", type: "relation", required: false, maxSelect: 1,
    collectionId: segments.id, cascadeDelete: false,
  }));
  const ckPhase = checks.fields.getByName("phase");
  ckPhase.values = ckPhase.values.concat(SEGMENT_PHASES);
  // Exactly one subject of four. No auth clause — check-logging stays
  // accountless (ADR 0011 §3); the shape is the gate.
  checks.createRule =
    '(tag != "" && system = "" && service = "" && segment = "") || ' +
    '(tag = "" && system != "" && service = "" && segment = "") || ' +
    '(tag = "" && system = "" && service != "" && segment = "") || ' +
    '(tag = "" && system = "" && service = "" && segment != "")';
  app.save(checks);
  const ckIdx = checks.indexes;
  ckIdx.push("CREATE INDEX `idx_checks_segment` ON `checks` (`segment`)");
  checks.indexes = ckIdx;
  app.save(checks);

  // ---- punch_items: a punch can hang off a segment -------------------------
  const punch = app.findCollectionByNameOrId("punch_items");
  punch.fields.add(new Field({
    name: "segment", type: "relation", required: false, maxSelect: 1,
    collectionId: segments.id, cascadeDelete: false,
  }));
  // Extends the service rule: a punch with a segment/service set carries no
  // tag/system; a punch with neither is the equipment/general case (tag+system
  // may coexist). All-blank stays legal (a general project punch).
  punch.createRule = '(segment = "" && service = "") || (tag = "" && system = "")';
  app.save(punch);
  const pIdx = punch.indexes;
  pIdx.push("CREATE INDEX `idx_punch_items_segment` ON `punch_items` (`segment`)");
  punch.indexes = pIdx;
  app.save(punch);
}, (app) => {
  // Roll back in reverse dependency order.
  const punch = app.findCollectionByNameOrId("punch_items");
  punch.indexes = punch.indexes.filter((s) => s.indexOf("idx_punch_items_segment") === -1);
  punch.fields.removeByName("segment");
  punch.createRule = 'service = "" || (tag = "" && system = "")';
  app.save(punch);

  const checks = app.findCollectionByNameOrId("checks");
  checks.indexes = checks.indexes.filter((s) => s.indexOf("idx_checks_segment") === -1);
  checks.fields.removeByName("segment");
  const ckPhase = checks.fields.getByName("phase");
  ckPhase.values = ckPhase.values.filter((v) => SEGMENT_PHASES.indexOf(v) === -1);
  checks.createRule =
    '(tag != "" && system = "" && service = "") || ' +
    '(tag = "" && system != "" && service = "") || ' +
    '(tag = "" && system = "" && service != "")';
  app.save(checks);

  const templates = app.findCollectionByNameOrId("checklist_templates");
  const kind = templates.fields.getByName("subject_kind");
  kind.values = kind.values.filter((v) => v !== "segment");
  const tplType = templates.fields.getByName("tag_type");
  tplType.values = tplType.values.filter((v) => SEGMENT_TYPES.indexOf(v) === -1);
  const tplPhase = templates.fields.getByName("phase");
  tplPhase.values = tplPhase.values.filter((v) => SEGMENT_PHASES.indexOf(v) === -1);
  app.save(templates);

  app.delete(app.findCollectionByNameOrId("segments"));
});
