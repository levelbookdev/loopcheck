# Architecture decision backlog

These are unresolved decisions, not implementation tasks. Recommendations are
provisional and every row identifies the latest point at which delay remains
safe.

## 1. Which product owns service cutover? — **RESOLVED (2026-07-18)**

- **Resolution:** **LoopCheck, permanently**
  ([DECISIONS.md D9](DECISIONS.md#d9--service-cutover-stays-in-loopcheck-semantics-frozen)). Service cutover — notice through
  restoration — is not moving to any sibling. ADR 0006 and the shipped UI stay
  authoritative, and LoopCheck may continue to evolve service semantics.
- **Note on the earlier framing:** this question originally assumed linear
  service acceptance would move to LineCheck. LineCheck is archived, and the
  scope that did move (segment/linear acceptance only — see question 2) went to
  MainLine. Service was never part of that move.

## 2. Should LoopCheck continue Phase 6 segment work? — **RESOLVED (2026-07-18)**

- **Resolution:** No. Linear/segment acceptance is **not LoopCheck's bounded
  context**; it belongs to **MainLine** as an unscheduled future module
  ([DECISIONS.md D10](DECISIONS.md#d10--segment-acceptance-is-owned-by-mainline-correction-of-record)),
  because MainLine already models alignments, stations, and append-only test
  ledgers with derived acceptance. LoopCheck stops at the landed schema (frozen,
  maintenance-only — the shipped migrations stay, not ripped out); **no segment
  execution UI, import, or route is built in LoopCheck.** ADR 0014 is superseded
  and records this.
- **Migration:** none planned. Cross-product record migrations are frozen until
  there are real users.
- **Note on the decision path:** the move was briefly assigned to **LineCheck**
  (2026-07-14) before LineCheck was archived; that assignment is historical.

## 3. Where does equipment preservation change ownership?

- **Why it matters:** storage preservation fits TrenchNote; installed-equipment
  layup may fit LoopCheck; warranty evidence must not split invisibly.
- **Options:** all TrenchNote; all LoopCheck; custody-triggered handoff.
- **Current evidence:** an untracked LoopCheck ADR proposes a recurring tag
  log; no implementation exists; intended TrenchNote boundary includes
  preservation.
- **Recommendation:** custody-triggered handoff, validated against real specs
  and who signs the record.
- **Validate:** manufacturer requirements, job responsibility, tag availability
  before installation, and warranty dispute needs.
- **Decision owner:** Maintainer/domain expert.
- **Latest safe decision point:** before accepting ADR 0015 or seeding a
  preservation template.

## 4. What is the portable identity scheme?

- **Why it matters:** local PocketBase ids and project names cannot safely join
  independently deployed databases.
- **Options:** UUID/ULID public ids issued by each producer; namespaced compound
  ids; externally assigned owner/project ids with local fallback.
- **Current evidence:** LoopCheck tag numbers are project-scoped; services and
  segments use local ids in URLs; no ecosystem deployment id exists.
- **Recommendation:** producer-issued opaque public ids plus preserved business
  ids and explicit project/source deployment references.
- **Validate:** offline creation, collision handling, printed QR compatibility,
  operator cloning/restores, and human reconciliation.
- **Decision owner:** Cross-product architecture owner.
- **Latest safe decision point:** before the first versioned handoff or import.

## 5. Is ADR 0010 ready to accept and land? — **RESOLVED (2026-08-04)**

- **Resolution:** **Yes — ADR 0010 is Accepted**
  ([DECISIONS D26](DECISIONS.md#d26--adr-0010-accepted-the-golden-vector-was-not-a-test-until-it-was-made-one)).
  Acceptance covers the design (frozen snapshot, canonical hash, supersession,
  attestation model). It does **not** perform the D12 contract bump; the two
  collections stay `delta; ADR 0010` in `docs/API.md` until M3.
- **What the investigation found:** two of D6's three gates were already met and
  merely unrecorded (the on-page "not a qualified e-signature" wording ships in
  `sign.html` and `turnover.html`; required-role semantics are ADR 0018 §9). The
  third — "independent verification … tested," which this question's own
  recommendation demanded — was **not** met and had been assumed to be: the
  golden vector was a `console.log` at hook load. On drift it printed one line
  to an unread console and kept sealing packages with unreproducible hashes.
- **Closed by fixing it, not by lowering the bar:** the vector is now enforced
  at `POST /api/turnover/build` (which refuses on mismatch) and asserted by
  `scripts/smoke_test.sh` — pinned algo, digest shape, **hash determinism across
  a rebuild**, supersession. The refusal path was verified by deliberately
  drifting the vector.
- **Still open beside it:** question 9 (minimum free turnover artifact) is no
  longer *blocked* by this one, but is not decided by it either.

### Original framing (retained)

- **Why it matters:** staged signature/turnover code implements a Proposed ADR;
  hashes and attestations become hard to change after records exist.
- **Options:** accept as drafted; revise manifest/hash/auth semantics; defer.
- **Current evidence:** staged collections/hooks/pages exist, but ADR 0010
  review notes retain open issues and no committed golden-vector test was found.
- **Recommendation:** pause commit until canonicalization, file coverage,
  identity/auth, supersession, required roles, and independent verification are
  approved and tested.
- **Validate:** golden vectors across implementations, tamper cases, package
  completeness, Pi performance, and legal wording.
- **Decision owner:** Maintainer with legal/domain review as appropriate.
- **Latest safe decision point:** before the first signature/package migration
  reaches a persistent database.

## 6. What is the authoritative auth access matrix? — **RESOLVED (2026-07-20)**

- **Resolution:** ADR 0011 is Accepted. The narrow accountless flows are
  preserved (public scan/reads; accountless check/punch-flag/LOTO/calibration
  creates); every other write and all office/PII reads require an account.
  Migration `1789000033` closed the segment public-write gap. The office pages
  authenticate through `lc-auth.js`, and `scripts/smoke_test.sh` mechanically
  asserts the matrix across guest, user, and superuser tiers — including the
  field-level PII back-relation expand. The README/DEPLOY internet-exposure
  warning tied to this question has been removed.
- **Still tracked separately:** the API v1 *version bump* for the added
  collections (question 7 below) — a contract-versioning decision, not an auth
  one.

## 7. How should API v1 be reconciled?

- **Why it matters:** published contract v1 originally covered sixteen broadly
  permissive collections; committed code has **32** (16 v1 + 16 delta) and
  selective auth. The API document now exposes that delta but cannot approve its
  own version. The auth/PII half is settled (ADR 0011, Accepted); what remains
  open is the **collection-set** version bump, sequenced to M3 (D12).
- **Options:** version bump for auth/PII changes; declare compatible v1
  additions with corrected rules; temporarily exclude segments from contract.
- **Current evidence:** ADR 0003 requires ADR + version bump for breaking
  changes; auth and removal of PII fields change client behavior.
- **Recommendation:** publish a reviewed compatibility matrix and bump the
  contract for auth/PII semantics; decide segment status separately.
- **Validate:** Bindery LoopCheck, seed scripts, public pages, third-party
  assumptions, and PocketBase REST behavior.
- **Decision owner:** Maintainer/API owner.
- **Latest safe decision point:** before the next tagged release or external
  integration commitment.

## 8. What general offline guarantee is required?

- **Why it matters:** README-level field expectations can be mistaken for
  offline-first behavior; only LOTO has a durable queue/cache.
- **Options:** online-required except LOTO; durable queue for selected field
  actions; full offline application shell and synchronization.
- **Current evidence:** no service worker/IndexedDB; LOTO uses localStorage;
  notice batch is tab-local.
- **Recommendation:** publish workflow-specific guarantees, then implement only
  the high-value queues with idempotency and explicit freshness.
- **Validate:** browser storage limits, photo sizes, device loss, conflicts,
  duplicate append-only events, and auth expiry.
- **Decision owner:** Maintainer/product owner.
- **Latest safe decision point:** before marketing general offline capability
  or adding a second durable queue.

## 9. What is the minimum free turnover artifact?

- **Why it matters:** the paid compiled binder cannot make paid software
  necessary to prove or retrieve core field work.
- **Options:** browser-print HTML only; deterministic core PDF; manifest + HTML
  with paid compilation.
- **Current evidence:** current deliverables use browser printing; ADR 0003
  places advanced compilation in the paid sidecar; ADR 0010 proposes a free
  frozen package and print view.
- **Recommendation:** guarantee a complete free manifest and readable print
  view; decide deterministic PDF based on owner requirements and Pi cost.
- **Validate:** archival requirements, attachments, pagination, signatures,
  offline verification, and accessibility.
- **Decision owner:** Maintainer/product owner.
- **Latest safe decision point:** before accepting the turnover package ADR and
  marketing a Phase 3 deliverable.

## 10. What deployment topology is supported versus illustrative?

- **Why it matters:** restore/replica claims affect evidence durability and
  operator expectations.
- **Options:** support LAN and single VPS only; support VPS-primary/Pi replica;
  add managed topology in paid products.
- **Current evidence:** deployment docs describe all three, but Pi hardware and
  replica validation are explicitly incomplete.
- **Recommendation:** label single-host LAN/VPS as current documented options
  and replica/Pi performance as unvalidated until exercised.
- **Validate:** fresh install, concurrent phones, backups/restores, power loss,
  file storage replication, schema upgrades, and recovery point.
- **Decision owner:** Maintainer/operations owner.
- **Latest safe decision point:** before calling Pi/replication production-
  supported or onboarding external operators.

---

Questions 11–13 came out of the 2026-08-04 review of field observations from a
multi-vendor plant startup ([ADR 0018](adr/0018-multi-vendor-startup-evidence-model.md),
proposed). They gate the M4–M6 track, not M1–M3 — except #13, which is cheapest
to answer immediately.

## 11. What is the right startup phase vocabulary?

- **Why it matters:** the observed sequence (dry checks → I/O checks → clean
  water / wet-mech → seeding → performance) does not map cleanly onto the six
  committed checkout phases, and a tag's required phases derive from which
  templates exist per phase. Getting the vocabulary wrong means re-phasing
  seeded templates later, which re-derives standing for every existing record.
- **Options:** add `wet_commissioning` + `process_seeding` only and map dry/IO
  checks onto the existing `installation`/`energization`/`point_to_point`/
  `loop_check`; add distinct `dry_check` and `io_check` phases and re-phase the
  seeded library; leave the vocabulary alone and express the stages as
  additional templates within existing phases.
- **Current evidence:** ADR 0018 §1 recommends the first option. The mechanical
  acceptance forms already set the precedent that a new *form* at an existing
  phase costs nothing, while a new *phase* changes every affected tag's derived
  denominator. **Strengthened by the 2026-08-04 source reading**: the package's
  own sequence is dry checks → I/O checks → clean water / wet-mech → seeding →
  performance, its dry-check report maps onto `installation` and its I/O-check
  report onto `point_to_point` + `loop_check` without strain, and seeding is
  recorded as a distinct not-yet-scheduled stage. That is the recommended
  option, observed.
- **Recommendation:** the two additive phases; do not re-phase the library.
  This question is probably closeable on the maintainer's say-so alone.
- **Validate:** against the maintainer's own phase sequence on a real job, and
  against whether any observed check has no honest home in the existing six.
- **Decision owner:** Maintainer/domain expert.
- **Latest safe decision point:** before the M4.1 enum-opening migration.

## 12. Does LoopCheck model the asset separately from the position? — **RESOLVED (2026-08-04)**

- **Resolution:** **No — no second identity.** An append-only
  **`equipment_events`** ledger on the tag records that the physical machine
  changed (`replaced` / `rebuilt` / `reinstalled` / `relocated` /
  `nameplate_corrected`), with **nullable** `serial_before` / `serial_after`;
  a **derived** re-verify marker then flags any phase whose standing rests
  entirely on checks older than the tag's latest event. `tags` stays the only
  identity ([ADR 0018 §16](adr/0018-multi-vendor-startup-evidence-model.md),
  [DECISIONS D27](DECISIONS.md#d27--the-asset-behind-a-position-is-an-appended-event-not-a-second-identity)).
  Sized as a scope item in **M5.3**.
- **What decided it:** the serial-keyed asset model fails on contact with the
  source — **actuator serial number reads "N/A" on all six valve reports**, so
  an entire equipment class has no key. And the real requirement was never asset
  lifecycle; it is "a phase passed by a machine later pulled apart must not read
  as current," which is a derivation over dates.
- **Accepted loss:** you cannot ask "where has serial X been installed over
  time," or follow one machine between positions. That is asset management and
  belongs elsewhere. If it ever matters, these events are the substrate the
  heavier model would be built on.

### Original framing (retained)

- **Why it matters:** a `tag` is a P&ID *position*; the serial-numbered machine
  is an *asset* that gets pulled, rebuilt, and reinstalled — possibly in a
  different position — mid-startup. Today they are the same record, so a phase
  passed in March by one machine reads identically to one passed by its
  replacement in May. The observed failure was one tag number appearing for two
  different valves in vendor paperwork, undetectable on paper.
- **Options:** a new `equipment_assets` collection plus an append-only
  install/remove ledger (asset ↔ position over time); a lighter "nameplate
  changed on this tag" append-only event that triggers the re-verification
  prompt without a second identity; do nothing beyond the duplicate-serial and
  nameplate-mismatch warnings in M5.3.
- **Current evidence:** ADR 0018 §11 deliberately defers this and lands only
  the cheap validation half, because a second identity touches every record
  that points at a tag — checks, punch items, warranties, LOTO, calibrations,
  settings, signatures. **The 2026-08-04 source reading makes this live rather
  than hypothetical:** the package records a pump found with a frozen impeller,
  removed, rebuilt with new seals, and re-installed — *between* the clean-water
  and seeding phases, with a standing action item to "confirm the pump re-build
  and installation." Every clean-water result logged against that position was
  produced by a different machine than the one that will run the plant.
- **Recommendation:** decide the *goal* first (is the requirement really
  "re-verify after a swap", or is it full asset lifecycle?). If it is the
  former, the lighter event is probably sufficient and far cheaper.
- **Validate:** what a turnover binder must show after a mid-startup swap; what
  the warranty clock does when the asset changes (ADR 0005's basis/trigger
  provenance); whether QR labels follow the position or the machine.
- **Decision owner:** Maintainer/domain expert.
- **Latest safe decision point:** before any equipment-asset work is scoped;
  it needs its own ADR either way.

## 13. Do ADR 0018's turnover additions land inside `sha256-canon-v1`? — **RESOLVED (2026-08-04)**

- **Resolution:** **Yes — one fold, inside `sha256-canon-v1`, no v2**
  ([DECISIONS D25](DECISIONS.md#d25--d6-amended--the-turnover-manifest-folds-into-sha256-canon-v1-now),
  [ADR 0018 §15](adr/0018-multi-vendor-startup-evidence-model.md)). A hash
  version exists to protect history and there is no history to protect; a v2
  carrying additions no v1 package ever saw would be a boundary that records
  nothing. **Partial folds are forbidden** — each addition alone changes the
  canonical bytes.
- **Precondition, still live:** confirm no `turnover_packages` record carrying
  real signatures exists on any live instance before the fold ships. If one
  does, the decision inverts to `sha256-canon-v2`.
- **Related, and now closed:** the golden vector this decision leans on was a
  `console.log`, not a test. It is now enforced at the build route and asserted
  by `scripts/smoke_test.sh` (question 5, D26) — without which "regenerate the
  golden vector as the acceptance test" would have had nothing to regenerate.

### Original framing (retained)

- **Why it matters:** the vendor report index, the instrument settings table,
  the deferred-cell standing grid, the countersignature QC block, and the
  completeness assertion all enter the canonical bytes a package hashes. A hash
  scheme is evidence only if an independent party can recompute it, so changing
  what enters the bytes after real packages exist means those packages verify
  under a different scheme than new ones.
- **Options:** fold the additions into `sha256-canon-v1` before any real
  package is signed; accept ADR 0010 as-is now and plan `sha256-canon-v2`;
  freeze package building entirely until both ADRs are decided.
- **Current evidence:** no real turnover package has been signed. ADR 0010 is
  Proposed and frozen ([D6](DECISIONS.md#d6--adr-0010-signatures--turnover-stays-proposed-and-frozen));
  its golden-vector and required-role gates are still open, and ADR 0018 §9 is
  the concrete proposal for the required-role gate.
- **Recommendation:** fold first, decide **with** question #5, and accept the
  two ADRs together. This is the cheapest moment this decision will ever have.
- **Validate:** golden vectors across the goja builder and the sidecar; whether
  a manifest carrying vendor reports and settings stays buildable on a Pi.
- **Decision owner:** Maintainer/API owner.
- **Latest safe decision point:** **before the first real turnover package is
  signed** — this is the one question here that gets more expensive with time
  rather than staying flat.
