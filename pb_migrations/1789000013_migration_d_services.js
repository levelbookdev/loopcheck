/// <reference path="../pb_data/types.d.ts" />
//
// Migration D — service connections: LoopCheck's first non-equipment subject
// (ADR 0006). A water main replacement job is hundreds of individual service
// tie-overs; each address must be noticed, located, re-served, metered, tied
// over, and restored — and the notice must be provable in a dispute.
//
// The checklist engine is NOT forked. A service becomes the third check
// subject the same way a system became the second (ADR 0001): one nullable
// relation on `checks` and `punch_items`, the exactly-one-subject createRule
// extended, `subject_kind` gains a value, and the phase enum gains the
// service phase set. Deliberately the pilot for future subject kinds
// (Phase 5 locations, Phase 6 segments) — adding a fourth should be boring.
//
// All additive; no DB reset. Existing tag/system records and requests are
// untouched — every previously valid request stays valid.

// The service phase set, in cutover order. Appended to the equipment phases
// in the shared `phase` enum — a template's subject_kind says which set it
// draws from; a service's REQUIRED phases stay derived (the phases that have
// a subject_kind='service' template), same as tags.
const SERVICE_PHASES = [
  "notice", "locate_pothole", "new_service", "meter", "tie_over", "restoration",
];

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");

  // ---- services: one customer service connection --------------------------
  // The ADDRESS is the human-facing identifier everywhere the tag_number
  // would be. customer_name / customer_phone are PII: never rendered on a
  // page reachable without sign-in, never in QR codes or URLs (CLAUDE.md
  // PII rule) — public pages must fetch services with a `fields=` list
  // that excludes them.
  const services = new Collection({
    type: "base",
    name: "services",

    // HISTORICAL (auth): the rules below are what THIS migration shipped.

    // The auth lockdown has since landed -- migrations 1789000019 / 1789000020 /

    // 1789000033 (ADR 0011, Accepted) set the live rules. See docs/API.md.
    // The auth lockdown ADR must ALSO solve field-level PII protection —
    // collection rules cannot hide individual fields, so customer_name and
    // customer_phone stay a UI/convention rule until then (ADR 0006).
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",     // meter numbers land as the work happens
    deleteRule: null,   // admin-only, like every other collection

    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },

      // The human-facing identifier. Shown big on the service page, first
      // column on the cutover board. NOT the URL key — the /s/{id} route
      // uses the record id, because addresses are neither unique across
      // projects nor URL-clean (ADR 0006).
      { name: "address", type: "text", required: true, presentable: true },

      // Plan stationing ("14+52 LT") — the crew-sequencing sort key. Free
      // text; the cutover board parses the leading station numerically so
      // 9+50 sorts before 14+52.
      { name: "station", type: "text" },

      { name: "account_or_parcel", type: "text" },

      // PII — see the collection comment and CLAUDE.md.
      { name: "customer_name", type: "text" },
      { name: "customer_phone", type: "text" },

      // Meter and line facts. Free text, like the tag nameplate fields —
      // real district data says "5/8x3/4" and "poly (blue)" and an enum
      // would fight every import.
      { name: "old_meter_number", type: "text" },
      { name: "new_meter_number", type: "text" },
      { name: "service_size", type: "text" },
      { name: "service_material", type: "text" },

      // NO status field. A service's cutover standing is derived from its
      // check ledger against the service phase set (hard constraint #4).

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      // A duplicate (address, station) inside one project is a re-import,
      // not a second service; a genuine double service (domestic +
      // irrigation at one address) differs by station or meter. The CSV
      // import counts rejections here as skipped duplicates, same as tags.
      "CREATE UNIQUE INDEX `idx_services_project_address_station` ON `services` (`project`, `address`, `station`)",
      "CREATE INDEX `idx_services_project` ON `services` (`project`)",
    ],
  });
  app.save(services);

  // ---- checks: the third subject ------------------------------------------
  const checks = app.findCollectionByNameOrId("checks");
  checks.fields.add(new Field({
    name: "service", type: "relation", required: false, maxSelect: 1,
    collectionId: services.id, cascadeDelete: false,
  }));

  // EXACTLY ONE SUBJECT, now three-way: tag XOR system XOR service. Same
  // reasoning as ADR 0001 — the ledger is append-only, so a malformed
  // record would be permanent; the server-side rule is the gate.
  // HISTORICAL (auth): this anticipated the lockdown prepending an auth check.
  // It did NOT -- ADR 0011 §3 kept check creation accountless (the field tier),
  // so this stayed a pure XOR shape rule. Migration 1789000024 later widened it
  // to four subjects.
  checks.createRule =
    '(tag != "" && system = "" && service = "") || ' +
    '(tag = "" && system != "" && service = "") || ' +
    '(tag = "" && system = "" && service != "")';

  // The shared phase enum gains the service set. Appending values is
  // additive — every existing record and request stays valid.
  const checksPhase = checks.fields.getByName("phase");
  checksPhase.values = checksPhase.values.concat(SERVICE_PHASES);
  app.save(checks);

  const checkIndexes = checks.indexes;
  checkIndexes.push("CREATE INDEX `idx_checks_service` ON `checks` (`service`)");
  checks.indexes = checkIndexes;
  app.save(checks);

  // ---- punch_items: a punch can hang off a service -------------------------
  const punch = app.findCollectionByNameOrId("punch_items");
  punch.fields.add(new Field({
    name: "service", type: "relation", required: false, maxSelect: 1,
    collectionId: services.id, cascadeDelete: false,
  }));

  // A punch item targets a service XOR the tag/system pair (tag+system
  // coexist because system is the equipment rollup; a service has no
  // system). Unlike checks, all-blank stays legal — a general project
  // punch item. HISTORICAL (auth): same as above -- punch FLAGGING stayed
  // accountless (ADR 0011 §3); only closing a punch item requires auth.
  punch.createRule = 'service = "" || (tag = "" && system = "")';

  const punchIndexes = punch.indexes;
  punchIndexes.push("CREATE INDEX `idx_punch_items_service` ON `punch_items` (`service`)");
  punch.indexes = punchIndexes;
  app.save(punch);

  // ---- checklist_templates: the third subject kind + service phases -------
  const templates = app.findCollectionByNameOrId("checklist_templates");
  const kind = templates.fields.getByName("subject_kind");
  kind.values = kind.values.concat(["service"]);
  const tplPhase = templates.fields.getByName("phase");
  tplPhase.values = tplPhase.values.concat(SERVICE_PHASES);
  app.save(templates);
}, (app) => {
  // Rollback: remove exactly what this migration added, children first.
  const punch = app.findCollectionByNameOrId("punch_items");
  punch.fields.removeByName("service");
  punch.createRule = "";
  punch.indexes = punch.indexes.filter((i) => !i.includes("idx_punch_items_service"));
  app.save(punch);

  const checks = app.findCollectionByNameOrId("checks");
  checks.fields.removeByName("service");
  checks.createRule = '(tag != "" && system = "") || (tag = "" && system != "")';
  const checksPhase = checks.fields.getByName("phase");
  checksPhase.values = checksPhase.values.filter((v) => !SERVICE_PHASES.includes(v));
  checks.indexes = checks.indexes.filter((i) => !i.includes("idx_checks_service"));
  app.save(checks);

  const templates = app.findCollectionByNameOrId("checklist_templates");
  const kind = templates.fields.getByName("subject_kind");
  kind.values = kind.values.filter((v) => v !== "service");
  const tplPhase = templates.fields.getByName("phase");
  tplPhase.values = tplPhase.values.filter((v) => !SERVICE_PHASES.includes(v));
  app.save(templates);

  app.delete(app.findCollectionByNameOrId("services"));
});
