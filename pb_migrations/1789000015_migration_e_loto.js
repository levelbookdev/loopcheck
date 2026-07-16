/// <reference path="../pb_data/types.d.ts" />
//
// Migration E — LOTO Status Board (ADR 0007): loto_events, an APPEND-ONLY
// ledger of lockout/tagout applies and releases.
//
// SAFETY FRAMING (CLAUDE.md, non-negotiable): this is a VISIBILITY layer,
// not a LOTO program. The physical locks, tags, and the written
// energy-control procedure are the only authority. The app records who
// logged what, immutably; it never authorizes, never enforces who may
// release, and must never be usable as evidence that equipment is safe to
// touch.
//
// Derived state (hard constraint #4): a tag is LOCKED OUT if any `apply`
// event has no `release` referencing it (`applies_to`). No status column
// anywhere. Group LOTO (multiple simultaneous locks) falls out naturally —
// the tag stays locked out until every apply has a release.
//
// The `applies_to` self-relation is added in a second save, same as
// systems.parent_system: a relation field can't point at a collection that
// doesn't exist yet.

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");
  const tags = app.findCollectionByNameOrId("tags");

  const loto = new Collection({
    type: "base",
    name: "loto_events",

    // TODO(auth): before internet exposure, the "" rules become
    //   @request.auth.id != ""
    // and the createRule below gets the same prefix ANDed on. NOTE for the
    // auth ADR: logging an apply/release must stay accountless (hard
    // constraint #1) — the electrician at the isolation point has no login.
    listRule: "",
    viewRule: "",

    // The real createRule references `applies_to`, which can't exist until
    // the collection does — it is set in the second save below. `null`
    // (locked) in the interim so no window ever accepts unvalidated writes.
    createRule: null,

    // APPEND-ONLY: same enforcement as checks. A lock record someone can
    // edit or delete is worthless in a dispute. Corrections are new events.
    updateRule: null,
    deleteRule: null,

    fields: [
      // Denormalized from the tag (the punch_items/warranties precedent) so
      // the project LOTO board filters flat.
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      { name: "tag", type: "relation", required: true, maxSelect: 1,
        collectionId: tags.id, cascadeDelete: false },

      { name: "action", type: "select", required: true, maxSelect: 1,
        values: ["apply", "release"] },

      // Free text, not user relations — field techs work without accounts.
      // On a release, lock_holder_name is the person LOGGING the release
      // (usually the holder; a supervisor removal carries the note).
      { name: "lock_holder_name", type: "text", required: true },
      { name: "company_or_trade", type: "text" },

      // e.g. "Pulling motor for alignment"
      { name: "reason", type: "text" },
      // The physical lock/tag number, when the program numbers them.
      { name: "lock_id", type: "text" },

      // The hung lock/tag on the isolation point. REQUIRED on apply,
      // encouraged on release — enforced by the createRule, not
      // field-level `required`, so release stays optional. A direct file
      // field (not a polymorphic attachment) so the event and its evidence
      // land in ONE multipart POST — an append-only record can't collect
      // its required photo in a second step that might never come
      // (ADR 0007).
      { name: "photo", type: "file", maxSelect: 1,
        maxSize: 15000000, // 15 MB — a phone photo
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"] },

      // Free text on a release: "holder released", or "supervisor removal
      // per SOP, J. Smith authorized". The app records the why; the
      // energy-control program owns the authority.
      { name: "released_by_note", type: "text" },

      // When the lock was physically hung/removed (client-set — an event
      // logged from a dead zone syncs late but happened when it happened).
      // `created` autodate is the immutable server log stamp; the
      // staleness display keys off sync time, never off this.
      { name: "performed_at", type: "date" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_loto_tag` ON `loto_events` (`tag`)",
      "CREATE INDEX `idx_loto_project` ON `loto_events` (`project`)",
    ],
  });

  app.save(loto);

  // Second pass: the self-relation a release uses to point at the apply it
  // releases. Nullable — apply events never set it (the createRule forbids
  // it).
  loto.fields.add(new Field({
    name: "applies_to",
    type: "relation",
    required: false,
    maxSelect: 1,
    collectionId: loto.id,
    cascadeDelete: false,
  }));
  loto.indexes.push(
    "CREATE INDEX `idx_loto_applies_to` ON `loto_events` (`applies_to`)");

  // Because this ledger is append-only, a malformed record would be
  // permanent — so the shape is enforced here, not in the UI (the ADR
  // 0001/0006 reasoning):
  //   apply:   must carry the photo of the hung lock/tag (constitutive
  //            evidence, ADR 0007), must not reference another event.
  //   release: must reference an APPLY event on the SAME tag; and if the
  //            releaser's name differs from the lock holder's (supervisor
  //            removal), released_by_note is mandatory — the justification
  //            rides into the immutable record.
  //
  // TODO(auth): before internet exposure this gains the
  //   @request.auth.id != "" &&
  // prefix — but see the accountless-field-tier note above.
  loto.createRule =
    '(action = "apply" && photo != "" && applies_to = "") ||' +
    ' (action = "release" && applies_to != ""' +
    ' && applies_to.action = "apply" && applies_to.tag = tag' +
    ' && (applies_to.lock_holder_name = lock_holder_name || released_by_note != ""))';

  app.save(loto);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("loto_events"));
});
