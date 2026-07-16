/// <reference path="../pb_data/types.d.ts" />
//
// Migration I — the PII split (ADR 0011 §4, DRAFT — lands when 0011 is
// accepted). PocketBase API rules are collection-level, not field-level, so a
// publicly-readable `services` with hidden columns is impossible. The only
// honest fix for the PII rule (ADR 0006 / CLAUDE.md) is structural: move
// customer_name and customer_phone into a separate, auth-gated collection.
// After this, `services` carries NO PII and can stay publicly readable with
// no `fields=` discipline required — the sensitive columns simply aren't there.
//
// DESTRUCTIVE + FRONTEND-COUPLED — do not apply to a live instance until the
// frontend is updated in the same change:
//   - import_services.html must write PII to `service_contacts`, not `services`
//     (today it POSTs customer_name/customer_phone to services; after this
//     those fields don't exist and the values are silently dropped).
//   - authenticated office views that show the customer join service_contacts.
//   - the public pages (service.html, cutover, notice_batch, labels) need NO
//     change beyond dropping the now-pointless customer fields from their
//     `fields=` lists.
// On a pre-release DB the wipe-and-rebuild workflow (ADR 0001) makes the data
// move below belt-and-suspenders; it is included so an existing demo DB's
// seeded PII survives the split rather than being dropped.

migrate((app) => {
  const AUTH = '@request.auth.id != ""';
  const services = app.findCollectionByNameOrId("services");

  // 1. The auth-gated contacts collection, one-to-one with a service.
  const contacts = new Collection({
    type: "base",
    name: "service_contacts",

    // Auth on every operation — this is the PII boundary. No public read,
    // ever; that is the whole point of the split.
    listRule: AUTH,
    viewRule: AUTH,
    createRule: AUTH,
    updateRule: AUTH,
    deleteRule: null, // admin-only, like every other collection

    fields: [
      { name: "service", type: "relation", required: true, maxSelect: 1,
        collectionId: services.id, cascadeDelete: true }, // dies with its service
      { name: "customer_name", type: "text" },
      { name: "customer_phone", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE UNIQUE INDEX `idx_service_contacts_service` ON `service_contacts` (`service`)",
    ],
  });
  app.save(contacts);

  // 2. Move existing PII out of services BEFORE dropping the columns.
  for (const s of app.findAllRecords("services")) {
    const name = s.get("customer_name");
    const phone = s.get("customer_phone");
    if (name || phone) {
      const c = new Record(contacts);
      c.set("service", s.id);
      c.set("customer_name", name);
      c.set("customer_phone", phone);
      app.save(c);
    }
  }

  // 3. Drop the PII columns from the public collection.
  services.fields.removeByName("customer_name");
  services.fields.removeByName("customer_phone");
  app.save(services);
}, (app) => {
  // Rollback: put the columns back, copy the PII home, drop the collection.
  const services = app.findCollectionByNameOrId("services");
  services.fields.add(new Field({ name: "customer_name", type: "text" }));
  services.fields.add(new Field({ name: "customer_phone", type: "text" }));
  app.save(services);

  for (const c of app.findAllRecords("service_contacts")) {
    try {
      const s = app.findRecordById("services", c.get("service"));
      s.set("customer_name", c.get("customer_name"));
      s.set("customer_phone", c.get("customer_phone"));
      app.save(s);
    } catch (_) {
      // service already gone — nothing to restore onto
    }
  }

  app.delete(app.findCollectionByNameOrId("service_contacts"));
});
