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

## 5. Is ADR 0010 ready to accept and land?

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
  permissive collections; committed code has eighteen and selective auth. The
  API document now exposes that delta but cannot approve its own version.
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
