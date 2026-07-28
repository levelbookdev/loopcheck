/// <reference path="../pb_data/types.d.ts" />
//
// Collection: attachments — a generic file attached to any other record. One
// collection serves every attachment need (punch-item photos now; calibration
// certs and nameplate photos on checks later) rather than a file field on each
// collection, so future phases attach evidence without a schema change.
//
// A record is pointed at its parent by (parent_collection, parent_id) — a
// polymorphic pointer. The tag page, for example, lists attachments where
// parent_collection = "punch_items" and parent_id = the punch item's id.

migrate((app) => {
  const attachments = new Collection({
    type: "base",
    name: "attachments",

    // HISTORICAL (auth): the rules below are what THIS migration shipped.

    // The auth lockdown has since landed -- migrations 1789000019 / 1789000020 /

    // 1789000033 (ADR 0011, Accepted) set the live rules. See docs/API.md.
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: null, // evidence is not edited after upload
    deleteRule: null,

    fields: [
      {
        name: "file",
        type: "file",
        required: true,
        maxSelect: 1,
        maxSize: 15000000, // 15 MB — a phone photo or a scanned cal cert
        mimeTypes: [
          "image/jpeg", "image/png", "image/webp", "image/heic", "image/gif",
          "application/pdf",
        ],
      },

      // Polymorphic pointer to the owning record.
      { name: "parent_collection", type: "text", required: true }, // e.g. "punch_items"
      { name: "parent_id", type: "text", required: true },

      { name: "caption", type: "text" },
      { name: "uploaded_by", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_attachments_parent` ON `attachments` (`parent_collection`, `parent_id`)",
    ],
  });

  app.save(attachments);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("attachments"));
});
