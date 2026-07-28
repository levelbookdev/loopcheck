/// <reference path="../pb_data/types.d.ts" />
//
// Migration M — Phase 3: turnover_packages + signatures (ADR 0010).
//
// The "prove it" layer (CLAUDE.md, question 3). Two APPEND-ONLY collections:
//
//   turnover_packages — a FROZEN SNAPSHOT of what a system's checkout looked
//     like at a moment. Readiness is derived and the ledger keeps growing, so
//     a signature over a live verdict would silently change meaning; the thing
//     that gets signed must be frozen. The package freezes a copy (manifest +
//     standing_snapshot + content_hash) exactly as check_items.prompt freezes
//     a copy of living template text — the live readiness view still computes
//     from scratch, so nothing stored can drift (hard constraint #4 holds).
//
//   signatures — a recorded ATTESTATION bound to that frozen content: a named
//     person, in a role, attested to a specific content_hash at a stated time.
//     NOT a qualified e-signature (no PKI); defensible because the ledger is
//     immutable and the signature carries the hash of what it covers.
//
// AUTH (ADR 0011, baked into Migration H §7): a signature REQUIRES an account
// — an attestation of identity is worthless if anyone can mint one. Reads stay
// PUBLIC: a turnover package is a shareable deliverable, and a scanned QR /
// owner link must render it with no account. turnover_packages create is
// LOCKED (createRule: null): a client cannot be trusted to compute the
// manifest and hash of what it claims the ledger contains (a forged manifest
// could omit the failing check), so the ONLY creator is the server-side build
// route (pb_hooks, Task 2) whose app.save() bypasses the API rule. Both
// collections are append-only: update/delete null, same as checks.
//
// The `supersedes` self-relation is added in a second save (a relation can't
// point at a collection that does not exist yet — same recipe as
// systems.parent_system and loto_events.applies_to).

migrate((app) => {
  const AUTH = '@request.auth.id != ""';
  const projects = app.findCollectionByNameOrId("projects");
  const systems = app.findCollectionByNameOrId("systems");

  // ===== turnover_packages =====================================================
  const packages = new Collection({
    type: "base",
    name: "turnover_packages",

    // Public READ — a turnover package is a shareable deliverable (owner/EOR
    // link, printed record). (ADR 0011 matrix.)
    listRule: "",
    viewRule: "",

    // LOCKED to direct clients. The build hook (Task 2) is the only creator;
    // its app.save() runs at the data layer and bypasses this rule. This is
    // deliberately stricter than ADR 0011's "auth" — server-side assembly is
    // the integrity guarantee (ADR 0010), so no authenticated client may POST
    // a hand-built package either.
    createRule: null,

    // APPEND-ONLY: a package is never edited. A turnover issued after more
    // work is a NEW package that `supersedes` the old one; the superseded
    // package and its signatures stay in the ledger — that history is the
    // point.
    updateRule: null,
    deleteRule: null,

    fields: [
      // Scope. A system turnover is the common case; a blank system = a
      // project-wide package (same shape).
      { name: "project", type: "relation", required: true, maxSelect: 1,
        collectionId: projects.id, cascadeDelete: false },
      { name: "system", type: "relation", required: false, maxSelect: 1,
        collectionId: systems.id, cascadeDelete: false },

      { name: "title", type: "text" },

      // The frozen manifest (ADR 0010): the ordered list of included records,
      // each {collection, id} plus the per-collection field allowlist of the
      // immutable content the hash covers (a check freezes result/phase/
      // performed_by/performed_at + its ordered check_items; attachments
      // contribute a file digest; etc.). What is omitted is what can be
      // tampered without detection, so the allowlist is explicit and the hook
      // — not the client — assembles it.
      { name: "manifest", type: "json", maxSize: 5000000 },

      // The derived readiness verdict AT FREEZE TIME, frozen in. Read this for
      // the historical record; the live readiness view still derives fresh.
      { name: "standing_snapshot", type: "json", maxSize: 200000 },

      // The verifiable seal. SHA-256 over the canonical serialization defined
      // in ADR 0010 ("sha256-canon-v1"): sorted keys, NFC, RFC3339 UTC times,
      // decimals as strings — pinned so the goja builder, the paid sidecar,
      // and an outside expert's tool agree on the bytes. hash_algo is stored
      // so the scheme can evolve without invalidating old packages.
      { name: "content_hash", type: "text" },
      { name: "hash_algo", type: "text" },

      // Who built it, and when (client-set; `created` is the immutable log
      // stamp). Free text, like checks.performed_by — the auth token says
      // which crew, the typed name is the person.
      { name: "generated_by", type: "text" },
      { name: "generated_at", type: "date" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_turnover_project` ON `turnover_packages` (`project`)",
      "CREATE INDEX `idx_turnover_system` ON `turnover_packages` (`system`)",
    ],
  });
  app.save(packages);

  // Second pass: `supersedes` self-relation (a re-issued package points at the
  // one it replaces). Nullable — a first issue supersedes nothing. The
  // "current package for a scope" is derived as the head of this chain (the
  // latest package no other package supersedes).
  packages.fields.add(new Field({
    name: "supersedes",
    type: "relation",
    required: false,
    maxSelect: 1,
    collectionId: packages.id,
    cascadeDelete: false,
  }));
  packages.indexes.push(
    "CREATE INDEX `idx_turnover_supersedes` ON `turnover_packages` (`supersedes`)");
  app.save(packages);

  // ===== signatures ============================================================
  const signatures = new Collection({
    type: "base",
    name: "signatures",

    // Public READ — signatures render on the shareable turnover deliverable.
    listRule: "",
    viewRule: "",

    // AUTH to create (ADR 0011 §7): a signature is an attestation of identity
    // and is worthless if anyone can mint one. The signing UI requires login.
    // (Honesty caveat on every signing surface, LOTO-style: identity is only
    // as strong as the deployment's access controls — enforced fully once the
    // auth lockdown lands.)
    // AUTH from day one: this collection was created after the lockdown, so it
    // follows Migration H's model directly -- the one create in this module that
    // has always been gated (ADR 0011 §7: a signature attests identity, so it
    // requires an account).
    createRule: AUTH,

    // APPEND-ONLY: a signature is never edited or deleted. A correction is a
    // new signature (or a re-attestation on a superseding package).
    updateRule: null,
    deleteRule: null,

    fields: [
      // Polymorphic subject (ADR 0010): a turnover_packages id in the common
      // case; the same collection signs a single `check` (a witnessed hold
      // point) with no schema change. Text id, not a relation, because it
      // spans collections — the ADR 0006 tradeoff, accepted here.
      { name: "subject_collection", type: "select", required: true, maxSelect: 1,
        values: ["turnover_packages", "checks"] },
      { name: "subject_id", type: "text", required: true },

      // Free text, like checks.performed_by — the shared field account's token
      // says which crew, the typed name is the person (ADR 0011 §7).
      { name: "signer_name", type: "text", required: true },
      { name: "signer_role", type: "select", maxSelect: 1,
        values: ["contractor", "owner", "engineer", "vendor", "witness", "other"] },
      { name: "signer_title", type: "text" }, // free-text capacity

      // Client-set (the person signed when they signed), like performed_at.
      { name: "signed_at", type: "date" },

      // The attestation wording, FROZEN onto the record: the exact language is
      // what a dispute turns on and differs by role ("certify performed and
      // accurately recorded" vs "accepted for beneficial use"). The record
      // freezes what was shown to the signer.
      { name: "statement", type: "text", required: true },

      // Copied from the package at sign time (ADR 0010): each signature is
      // self-contained evidence of WHICH frozen content it covers. A verifier
      // recomputes the package's canonical hash and checks every signature
      // carries it; a signature whose hash no longer matches the current
      // package is one that attested a now-superseded snapshot.
      { name: "signed_content_hash", type: "text" },

      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],

    indexes: [
      "CREATE INDEX `idx_signatures_subject` ON `signatures` (`subject_collection`, `subject_id`)",
    ],
  });
  app.save(signatures);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("signatures"));
  app.delete(app.findCollectionByNameOrId("turnover_packages"));
});
