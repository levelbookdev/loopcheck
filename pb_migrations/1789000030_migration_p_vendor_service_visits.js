/// <reference path="../pb_data/types.d.ts" />
//
// Migration P — Vendor Field Service Reports (ADR 0017).
//
// `service_visits` is an APPEND-ONLY ledger of manufacturer-representative
// visits against exactly one tag OR system. The project relation is repeated
// from the subject (the punch_items/warranties precedent) so the project visit
// ledger is a flat indexed query; the createRule also proves the denormalized
// project agrees with the selected subject.
//
// The signed vendor report remains in the existing polymorphic `attachments`
// collection. It is strongly expected but not required by this record: a
// create-then-attach sequence can fail between calls, and the honest recovery
// is to keep the immutable visit and loudly retry the appended evidence.

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");
  const systems = app.findCollectionByNameOrId("systems");
  const tags = app.findCollectionByNameOrId("tags");

  const visits = new Collection({
    type: "base",
    name: "service_visits",

    // Public read + create are deliberate: the tag page is a no-login field
    // surface and photographing the rep's report before departure must remain
    // an accountless flow (ADR 0017). Business visit facts contain no service-
    // customer PII. Shape and same-project integrity are enforced below.
    listRule: "",
    viewRule: "",
    createRule:
      '(tag != "" && system = "" && tag.project = project) || ' +
      '(tag = "" && system != "" && system.project = project)',

    // APPEND-ONLY: corrections are new visit records. The original account
    // and its evidence remain part of the turnover and warranty story.
    updateRule: null,
    deleteRule: null,

    fields: [
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      { name: "tag", type: "relation", required: false, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },
      { name: "system", type: "relation", required: false, maxSelect: 1,
        collectionId: systems.id, cascadeDelete: false },

      { name: "vendor_company", type: "text", required: true, presentable: true },
      { name: "rep_name", type: "text", required: true },
      // The day the representative was physically on site. `created` below is
      // the immutable server log stamp and may be later after an offline sync.
      { name: "date", type: "date", required: true },
      { name: "purpose", type: "select", required: true, maxSelect: 1,
        values: ["installation_verification", "startup_assistance",
                 "warranty_service", "training", "other"] },
      { name: "summary", type: "text", required: true },

      // Certification is an immutable assertion on this visit. A tag's
      // prominent certification line is DERIVED from flagged visits; there is
      // no stored certification status on tags (hard constraint #4).
      { name: "installation_certified", type: "bool" },
      { name: "certification_note", type: "text" },

      // Idempotency key generated when the phone queues the visit. If an
      // upload succeeds but its response is lost, the sync worker finds this
      // token before retrying instead of appending a duplicate visit.
      { name: "client_token", type: "text", required: true },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_service_visits_project_date` ON `service_visits` (`project`, `date`)",
      "CREATE INDEX `idx_service_visits_tag_date` ON `service_visits` (`tag`, `date`)",
      "CREATE INDEX `idx_service_visits_system_date` ON `service_visits` (`system`, `date`)",
      "CREATE INDEX `idx_service_visits_project_vendor` ON `service_visits` (`project`, `vendor_company`)",
      "CREATE INDEX `idx_service_visits_project_purpose` ON `service_visits` (`project`, `purpose`)",
      "CREATE UNIQUE INDEX `idx_service_visits_client_token` ON `service_visits` (`client_token`)",
    ],
  });
  app.save(visits);

  // Migration H allows anonymous evidence uploads for the accountless field
  // parents. Add service_visits to that allowlist; auth can still upload for
  // every other parent. The UI creates the visit first, then appends its PDF or
  // photo with parent_collection="service_visits" and parent_id=<visit id>.
  const attachments = app.findCollectionByNameOrId("attachments");
  attachments.createRule =
    'parent_collection = "check_items" || ' +
    'parent_collection = "punch_items" || ' +
    'parent_collection = "service_visits" || ' +
    '@request.auth.id != ""';
  app.save(attachments);
}, (app) => {
  // Restore Migration H's attachment allowlist before removing the parent.
  const attachments = app.findCollectionByNameOrId("attachments");
  attachments.createRule =
    'parent_collection = "check_items" || ' +
    'parent_collection = "punch_items" || ' +
    '@request.auth.id != ""';
  app.save(attachments);

  app.delete(app.findCollectionByNameOrId("service_visits"));
});
