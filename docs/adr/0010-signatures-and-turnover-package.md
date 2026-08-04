# ADR 0010 — Signatures & the turnover package: a signed, frozen snapshot over the append-only ledger

**Status:** **accepted** (2026-08-04) · **Date:** 2026-07-10

> **Accepted 2026-08-04** by maintainer decision, resolving
> [open-questions #5](../open-questions.md) and closing
> [D6](../DECISIONS.md#d6--adr-0010-signatures--turnover-stays-proposed-and-frozen)'s
> freeze. D6 named three gates; here is where each landed:
>
> 1. **Golden-vector / canonicalization test — NOW MET, and it was not before.**
>    D6 assumed the fixture was a test. It was a `console.log`: on drift it
>    printed one line to a server console (a trailer Pi's, typically unread) and
>    kept sealing packages with hashes no independent verifier could reproduce.
>    Fixed as part of this acceptance — `verifyGoldenVector()` moved beside the
>    serializer, `POST /api/turnover/build` **refuses** on mismatch rather than
>    sealing unverifiable evidence, and `scripts/smoke_test.sh` asserts the algo,
>    the digest shape, **hash determinism across a rebuild**, and supersession.
>    The refusal path was verified by deliberately drifting the vector and
>    confirming the build fails. Deliberately *not* a throw at load: a turnover
>    canonicalizer must never take down an instance serving QR scans, LOTO
>    status, and field checks — the blast radius stays scoped to builds.
> 2. **Required-role semantics — MET by design.**
>    [ADR 0018 §9](0018-multi-vendor-startup-evidence-model.md) defines them:
>    `required_signature_roles` is template data frozen onto the check, the
>    missing-countersignature list is derived, and the roles come from the GC's
>    template **never** from whatever the vendor's paper happened to provide.
> 3. **Legal wording (C4) — MET in shipped code.** Both `sign.html` and
>    `turnover.html` carry the "records an attestation, not a qualified
>    electronic signature" caveat on the page, not only in this ADR.
>
> **What acceptance does NOT do.** It does not perform the D12 contract bump —
> `turnover_packages` and `signatures` stay marked `delta; ADR 0010` in
> [docs/API.md](../API.md) until M3 reconciles the whole collection set. An
> accepted ADR is a settled *design*; the published *contract version* is a
> separate act with its own sequencing. Do not read this Status line as a
> contract guarantee.

> **The manifest allowlist and canonical form are unfrozen for one fold**
> (2026-08-04, DECISIONS **D25** amending D6). ADR 0018 adds eight
> hash-affecting entries to the manifest, and they land **together, in
> `sha256-canon-v1`** — not a v2 — because no real package has been signed, and
> a version boundary that protects no history is worse than none. See
> [ADR 0018 §15](0018-multi-vendor-startup-evidence-model.md) for the decision
> and the enumerated additions.
>
> **Precondition before the fold ships:** confirm no `turnover_packages` record
> carrying real signatures exists on any live instance. If one does, the
> additions go behind `sha256-canon-v2` instead. The golden vector is
> regenerated as the acceptance test; **partial folds are forbidden**, since
> each addition alone changes the canonical bytes.
>
> ~~**This does not accept ADR 0010.** C4's on-page wording, required-role
> semantics, and the D12 contract bump still gate acceptance.~~
> **Superseded 2026-08-04** — see the acceptance block at the top of this file.
> C4 and required-role semantics are met; the D12 contract bump is explicitly
> *not* a precondition of acceptance and remains M3 work.

**Implementation status (committed + review-hardened, 2026-07-12):** the
migration (`turnover_packages` + `signatures`, `1789000026`), the server
builder/canonicalizer (`pb_hooks/turnover.pb.js` + `turnover_canon.js`, with a
golden-vector check enforced at build time and asserted by the smoke test —
see the acceptance block; it was load-time-log-only until 2026-08-04), the auth
helper (`lc-auth.js` +
`login.html`), and the signing/turnover pages (`sign.html`, `turnover.html`)
are in the committed baseline and were hardened by a code-review pass
(single scoped `check_items` query, `//`+`/\` open-redirect guard,
drift-by-append-only-count, truncation flag, sticky signature pad). Review
comments C1–C3 are folded in below; C4 (on-page "not a qualified e-signature"
caveat) and C5 (ready-to-witness) ship in the UI. This is **not** yet
**Accepted**: the formal contract decision + version bump remain the
maintainer's call — the two collections sit as `delta; ADR 0010` in
[docs/API.md](../API.md) — as does auth-lockdown finalization ([ADR 0011](0011-auth-lockdown.md)).

*Revised 2026-07-10 after design review — comments C1–C3 (hash
canonicalization, manifest field coverage, supersession & re-signing) folded
in below; see [`0010-review-notes.md`](0010-review-notes.md) for the full
review, including still-open C4–C7.*

Phase 3. Adds two core collections — `turnover_packages` (an append-only
frozen snapshot of what a system's checkout looked like at a moment) and
`signatures` (append-only attestations bound to immutable content) — plus a
`pb_hooks` route that assembles a package server-side, and a free
print-friendly turnover view. The compiled, branded PDF binder stays the paid
sidecar's job (ADR 0003). Free tier gets the facts and the print view; paid
gets the office deliverable.

## Context

The core promise (CLAUDE.md, question 3) is: *prove it — to the engineer of
record, the owner, or a dispute — with signed, timestamped, immutable
records.* Phases 1–2 built the immutable records. Phase 3 builds the
**signature** and the **turnover deliverable** those records feed.

Three forces pull on the design:

1. **A turnover deliverable attests to a moment, but the ledger keeps
   growing.** "System 3 is ready for startup, signed by the contractor and
   accepted by the EOR" is a claim about the ledger *as it stood on the day
   it was signed*. Readiness is **derived** (hard constraint #4) from checks,
   open A-punch items, and required phases — and a check appended next week
   changes that derivation. A signature over a live derived verdict silently
   changes meaning. So the thing that gets signed must be **frozen**.

2. **The field tier has no accounts** (hard constraint #1). A witness
   standing at the equipment on a $40 Android must be able to sign. That
   rules out per-user cryptographic keypairs and qualified e-signature flows.
   The honest signature here is a recorded attestation: a name, a role, a
   time, and a binding to exactly what was attested — made trustworthy by the
   same immutability that makes the ledger trustworthy, not by PKI.

3. **The compiled binder is the paid line** (ADR 0003: "the ledger is free,
   insight about the ledger is paid"; the *compiled turnover binder* is named
   there as premium). But ADR 0003 also binds us: any capability premium
   needs **lands in core first**. The signature facts and the frozen snapshot
   are core; the paginated, sealed, bookmarked PDF is the sidecar.

## Decision

### A signature is a recorded attestation, not a qualified e-signature

Like the LOTO board (ADR 0007), this module is deliberate about what it is
and is not. A `signatures` record states that **a named person, in a stated
role, attested to specific frozen content at a stated time** — and that
statement is itself immutable. It is **not** an ESIGN/eIDAS/PKI qualified
electronic signature, and no page may imply it is. What makes it defensible
in a dispute is the append-only ledger plus the content binding below, not
cryptographic identity. (Signer *identity* trust ultimately rests on the auth
lockdown, still the open ADR — see Consequences.)

The typed name is the signature. A drawn-signature image is **optional**,
attached through the existing polymorphic `attachments` collection
(`parent_collection='signatures'`) — never a required field, because
requiring a canvas scribble would break the no-install field tier for the
witness who just needs to type their name.

### `turnover_packages` — an append-only frozen snapshot

The subject that gets signed. When a package is built, the core freezes:

- **scope**: `project` + optional `system` (a system turnover is the common
  case; a project-wide or multi-system package is the same shape).
- **manifest** (JSON): the ordered list of included records. Each entry is
  `{collection, id}` plus an explicit, **per-collection field allowlist** of
  the immutable content the hash covers — not a vague "key fields," because
  what is omitted is what can be tampered without detection. For a `check`:
  `result`, `phase`, `performed_by`, `performed_at`, and its **ordered
  `check_items`** (`prompt`, `response_type`, `value`, `result`) — the
  answered lines *are* the substance a dispute turns on, so the check id and
  result alone are not enough. For a `punch_item`: `severity` + `status`. For
  `loto_events`: the derived active-lock state. For
  `warranties`/`closeout_requirements`: the scope-relevant frozen fields.
  **Attachments referenced by any included record contribute a digest of their
  file bytes** (or, if per-byte hashing is too heavy for a Pi at build time,
  `{id, filename, size}` with the residual swap risk stated) — photos are
  evidence, and on the world-writable instance below an unbound photo can be
  swapped without changing the hash.
- **standing_snapshot**: the derived readiness verdict *at freeze time*,
  frozen into the record.
- **content_hash** + **hash_algo**: SHA-256 over the **canonical
  serialization** defined in the next section — an ambiguous "canonical" is
  not verifiable across the three parties that must agree on the bytes (the
  goja builder, the paid sidecar, an outside expert's tool), so the exact form
  is pinned and versioned.
- **generated_at / generated_by**, **title**, and an optional
  **supersedes** self-relation (a re-issued package points at the one it
  replaces).

`updateRule: null`, `deleteRule: null` — same enforcement as `checks`. A
package is never edited; a turnover issued after more work is a **new**
package that `supersedes` the old one. The superseded package and its
signatures stay in the ledger — that history is the point.

**Signatures do not carry forward.** Each signature is bound by its
`signed_content_hash` to one snapshot, so a new package starts with **zero
signatures** and every signer must re-attest — one appended check invalidates
the prior sign-off, by design. The **current package for a scope** is derived
(the head of the `supersedes` chain — the latest package no other package
supersedes), the same derived-status discipline as everywhere else. This is
the LOTO stale-status failure mode wearing a new hat: a superseded package
still carrying real signatures must never read as current acceptance. So the
print view and any board **mark a superseded package unmistakably**
("SUPERSEDED by {id} on {date} — signatures below attest the prior snapshot"),
show for the current package which required signatures are still outstanding,
and surface a derived warning when the live ledger has drifted past a signed
package ("signed, but N checks appended since freeze — re-issue to
re-attest").

**Freezing a derived verdict is not a violation of hard constraint #4.** The
distinction is exactly the one `checks` already make: the *live* status stays
derived from the library and the ledger; the package freezes a **copy** of
what that derivation produced, the same way `check_items.prompt` freezes a
copy of living template text. The live readiness view still computes from
scratch. Nothing stored can drift, because the frozen copy is historical
evidence, not a status field anyone reads as "current."

### The canonical hash — a verifiable seal, not just "a hash"

A hash is evidence only if an independent party can **recompute** it. The core
builder (goja in `pb_hooks`), the paid sidecar, and a disputing expert's tool
run in different languages and will disagree on the bytes unless the
serialization is pinned exactly. `content_hash` is therefore SHA-256 over this
canonical form, stored with `hash_algo: "sha256-canon-v1"` so the scheme can
evolve without invalidating old packages:

- JSON with object keys sorted lexicographically by UTF-8 byte order, no
  insignificant whitespace; strings in Unicode **NFC**.
- Integers serialized as integers; any decimals as fixed-precision decimal
  **strings** (never floats); booleans literal; `null` fields omitted, with
  "absent == null" documented.
- Timestamps as **RFC 3339 in UTC**, fixed precision.
- Only the per-collection field allowlist above enters the bytes; adding a
  schema field later must not silently change historical hashes.

A **golden vector** — a fixed manifest, its exact canonical bytes, and the
resulting hex digest — ships as a test that both the core and the sidecar
assert against. That one fixture is the cheapest defense against silent
divergence, and it is what lets a third party verify a turnover years later.

### The package is assembled server-side, in `pb_hooks`

A client cannot be trusted to compute the manifest and hash of what it claims
the ledger contains — a forged manifest would let someone sign a package that
omits the failing check. So package creation is a **core `pb_hooks` route**
(e.g. `POST /api/turnover/build` with `{project, system?}`): it queries the
ledger itself, builds the canonical manifest, computes the hash, and creates
the append-only `turnover_packages` record. Precedent: `pb_hooks/` already
serves the core's own `/t/{tag_number}` route (ADR 0003 keeps `pb_hooks` for
core, not premium). The client then collects signatures against the frozen
package id it gets back.

### `signatures` — append-only, polymorphic subject

Fields: `subject_collection` + `subject_id` (a `turnover_packages` id in the
common case; the same collection also signs a single `check` — e.g. a
witnessed hold point — with no schema change), `signer_name`, `signer_role`
(contractor / owner / engineer / vendor / witness / other — the punch-item
`assigned_party` vocabulary plus *witness*), `signer_title` (free-text
capacity), `signed_at` (client-set, like `performed_at` — the person signed
when they signed), `statement` (the attestation wording, **frozen** onto the
record because the exact language is what a dispute turns on — contractor
"certify performed and accurately recorded", owner "accepted for beneficial
use", differ by role), and `signed_content_hash` (copied from the package at
sign time, so each signature is self-contained evidence of *which* frozen
content it covers). `updateRule: null`, `deleteRule: null`.

The Phase-2 `checks.performed_by` / `witnessed_by` free-text names stay as
they are — capture-time attribution. Signatures are the heavier, explicit,
content-bound sign-off layer on top; this is additive, not a retrofit.

### The free/paid line

- **Core / free (AGPL):** `turnover_packages`, `signatures`, the
  `pb_hooks` build route, and a **print-friendly HTML turnover view**
  (`turnover.html`) — the same free-deliverable pattern as `cutover.html` and
  `closeout-package.html`. A self-hoster on a Pi can build a package, collect
  signatures, and print a clean turnover record with zero premium code.
- **Paid sidecar:** the **compiled binder** — cover sheet, EOR seal block,
  per-system tabs, embedded check photos, bookmarks, pagination, the filed
  commissioning binder the owner archives. It reads the frozen packages,
  signatures, checks, and attachments through the public API (ADR 0003),
  writes nothing, and runs off-box.

This keeps the promise both ways: the field tier is never crippled (the
signed record and a printable view are free), and premium is unblocked
because every fact it compiles already lives in core.

## Consequences

- **Two new core collections and one `pb_hooks` route.** The contract grows
  from sixteen to eighteen collections — **additive**, no breaking change,
  but it is a contract change: it needs the ADR-0003 version bump announced
  in release notes.
- **A new pattern: a deliberately frozen derived verdict.** Documented above
  as consistent with constraint #4; ARCHITECTURE.md's decisions list should
  record the distinction when this is accepted, so a future reader doesn't
  read `standing_snapshot` as a status field.
- **Signer-identity trust still rests on the open auth ADR.** The content
  hash defends against *content* tampering regardless of auth. But on the
  current accountless, world-writable instance (DEPLOY.md), anyone could POST
  a `signatures` record with any name — so identity is only as trustworthy as
  the deployment until the auth lockdown lands. This module raises the stakes
  on that open problem and must be honest about it on every signing surface,
  LOTO-style, rather than implying a signature proves who signed.
- **Photos in the binder** need no new plumbing: `attachments` is already
  polymorphic and file-served by URL; the sidecar fetches them.
- Phase 4 shutdown runbooks and Phase 6 segment acceptance packages reuse
  this exact machinery — a runbook execution and a segment's hydro +
  disinfection + passing bac-t are just other frozen snapshots signed by the
  same collection.

## Rejected

- **A `signed` boolean or `signed_by` field on `checks` / `systems`.** Stored
  status that drifts, holds only one signer, carries no role and no content
  binding, and can't express "signed on the 3rd, superseded on the 10th."
  Rejected for the same reason status is never stored.
- **Storing the rendered PDF in core.** The compiled binder is the paid
  deliverable and a heavy binary that would bloat the trailer Pi; core stores
  facts, the free tier prints HTML, and premium compiles the PDF off-box.
- **Per-user cryptographic keypairs / a qualified e-signature flow.** Breaks
  the accountless field tier (hard constraint #1), is heavy, and overclaims
  legal weight the product should not assert. The attestation-plus-immutable-
  ledger model is the honest scope. Revisit only if a customer contractually
  requires ESIGN/eIDAS — and then as a new ADR, not a quiet upgrade.
- **Client-side manifest and hash.** Untrustworthy — a client could sign a
  package that misrepresents the ledger. The core assembles it server-side.
- **Signing the live derived readiness with no freeze.** The ledger grows, so
  the signed verdict would silently change meaning after the fact. The
  package freezes the snapshot; a later state is a new, superseding package.
