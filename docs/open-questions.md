# Architecture decision backlog

These are unresolved decisions, not implementation tasks. Recommendations are
provisional and every row identifies the latest point at which delay remains
safe.

## 1. Which product owns service cutover?

- **Why it matters:** LoopCheck has a full implementation; the intended
  ecosystem assigns linear service acceptance/restoration to LineCheck.
- **Options:** keep permanently in LoopCheck; move future work to LineCheck
  with legacy LoopCheck support; dual-write/share ownership.
- **Current evidence:** ADR 0006 and current UI make LoopCheck authoritative
  today; local LineCheck is pre-alpha and does not yet implement service
  cutover.
- **Recommendation:** LineCheck owns future records after feature parity and a
  lossless migration; reject steady-state dual-write.
- **Validate:** field workflow parity, PII, offline behavior, QR compatibility,
  record/evidence reconciliation.
- **Decision owner:** Maintainer/product owner for LoopCheck and LineCheck.
- **Latest safe decision point:** before expanding LoopCheck service semantics
  or designing the LineCheck service model.

## 2. Should LoopCheck continue Phase 6 segment work?

- **DECIDED (2026-07-14):** No. The maintainer moved linear/segment acceptance
  to **LineCheck**. LoopCheck stops at the landed schema (frozen,
  maintenance-only — the shipped migrations stay, not ripped out); **no segment
  execution UI, import, or route is built in LoopCheck.** ADR 0014 is superseded
  and records this. The recommendation below is the one that was adopted.
- **Why it matters:** schema/templates have landed while LineCheck is centered
  on the same acceptance domain.
- **Options:** complete in LoopCheck; stop and move ownership to LineCheck;
  intentionally split certain segment types.
- **Current evidence:** LoopCheck has no complete segment UI; LineCheck plans a
  richer test/calculation/evidence model.
- **Recommendation:** stop LoopCheck UI work and make LineCheck the target
  owner; preserve the landed schema pending migration policy.
- **Validate:** whether any plant-internal segment genuinely belongs to
  LoopCheck and whether LineCheck contract covers it.
- **Decision owner:** Maintainer/domain architect.
- **Latest safe decision point:** before a segment import, QR route, execution
  page, or production data is created in LoopCheck.

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

## 6. What is the authoritative auth access matrix?

- **Why it matters:** backend lockdown is committed, office UI token use is
  incomplete, and later segments reopened public writes.
- **Options:** preserve current public field creates with authenticated office
  actions; require shared field login for more writes; broader public access.
- **Current evidence:** migration 0019 defines a selective model, migration
  0020 protects PII, committed pages do not consistently send tokens, and
  migration 0024 leaves segment writes public.
- **Recommendation:** keep the narrow accountless flows required by the product,
  authenticate office setup/closure/signature work, and mechanically test every
  collection/operation pair.
- **Validate:** cheap-phone scan flow, abuse/rate limits, token refresh, offline
  replay, service account permissions, and all office pages.
- **Decision owner:** Maintainer/security owner.
- **Latest safe decision point:** before any internet-facing production use.

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
