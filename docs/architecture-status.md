# Architecture status register

Snapshot: commit `3da73d0`, 2026-07-12. `CURRENT` is implemented in that
commit; `DECIDED` is supported by accepted ADRs/constraints; `PROPOSED` needs
review; `UNKNOWN` lacks evidence. A topic may have more than one label when
implementation and decision state differ.

| Topic | Status | Current implementation | Intended direction | Risk if changed now | Needed decision |
| --- | --- | --- | --- | --- | --- |
| Frontend stack | `CURRENT`, `DECIDED` | Static HTML/CSS + Alpine.js; vendored JS; no app build. | Keep no-build, same-origin, low-weight field pages. | High: breaks cheap-device/self-hosting constraint and page conventions. | None unless maintainer explicitly reopens locked stack. |
| Backend and persistence | `CURRENT`, `DECIDED` | One PocketBase 0.39.x process and embedded SQLite per deployment. | Keep one core database per product. | High: migrations, rules, hooks, deployment, and API all depend on it. | Define upgrade compatibility policy before changing PocketBase version. |
| Public identifier strategy | `CURRENT` locally; `PROPOSED` ecosystem-wide | Tag number is project-scoped business id; service/segment URLs use local record ids. | Stable product/project/entity ids distinct from local database ids in handoffs. | High after printed labels or cross-product imports exist. | Choose project/public-id issuance and collision rules before first handoff. |
| Offline storage | `CURRENT` partial | LOTO cache/outbox in `localStorage`; notice batch survives only in-tab; no general cache. | Explicit per-workflow offline policy with honest freshness. | Safety/data-loss risk if generalized casually. | Which non-LOTO workflows require durable offline support and what storage is acceptable? |
| Synchronization | `CURRENT` partial, `PROPOSED` general | LOTO retries queued events; no general idempotency/conflict protocol. | Client-generated mutation ids and explicit conflict policy where durable queueing is added. | Duplicate append-only records or false success. | Define idempotency and server ordering before a general queue. |
| Append-only facts | `CURRENT`, `DECIDED` | Checks/items/attachments/LOTO/closeout log immutable; open→resolve uses linked checks. | Extend traceable correction/supersession to every signed/external-result record. | Very high: evidence credibility and API contract. | Clarify void/correction vocabulary before signatures and imports. |
| Derived status | `CURRENT`, `DECIDED` | Browser folds ledgers/templates; no tag/system stored status. | Keep live status derived; permit explicitly historical frozen snapshots only. | High: stored current state will drift. | Approve how a frozen turnover standing is labeled so it cannot appear live. |
| Signature capture | `PROPOSED`, `UNKNOWN` active work | No committed signature collection/UI at baseline; staged implementation exists; ADR 0010 is Proposed. | Append-only attestation bound to immutable content; authenticated signer path. | Identity and legal-framing risk if landed without approved semantics. | Accept/revise ADR 0010 and ADR 0011; define required roles and signature meaning. |
| Record locking/supersession | `CURRENT` for immutable checks; `PROPOSED` for packages | Check records are born immutable; warranty claims freeze on close. | Frozen packages supersede rather than update; signatures do not carry forward. | Historical signoff can be misread as current. | Define current-package derivation, voids, and supersession UX. |
| Evidence hashing | `PROPOSED`, `UNKNOWN` active work | No committed hash contract; staged canonicalization/hook files exist. | Versioned canonical bytes, file inclusion policy, SHA-256 identifier, golden vectors. | A non-reproducible hash creates misleading assurance. | Review allowlists, Unicode/time/number rules, file hashing, and test vectors. |
| PDF generation | `CURRENT` browser print; `DECIDED` paid boundary | Free print-friendly HTML; no committed PDF renderer. | Basic record/index remains free; advanced compiled binder may run in paid sidecar. | Paywalling evidence would violate constraints; server PDF may burden Pi. | Define minimum free turnover artifact and whether deterministic core PDF is required. |
| API versioning | `DECIDED`, `CURRENT` drift | `docs/API.md` calls 16 collections v1; committed schema has 18 and selective auth. | Reconcile contract, define additive vs breaking policy, publish compatibility fixtures. | Existing clients/sidecar may silently mis-handle rules or fields. | Decide version bump for auth/PII split and status of segments in the contract. |
| Cross-product handoffs | `PROPOSED` | No implemented manifest/event exchange found. | Versioned exports/events with provenance; no direct DB coupling. | Premature shapes create permanent identifiers and duplicate masters. | Approve bounded contexts, stable ids, first concrete handoff, and ownership. |
| Paid/core boundary | `DECIDED`, `CURRENT` sidecar | ADR 0003; LoopCheck-Lookahead has separate DB and read-only HTTP consumption. | Core owns field facts/basic export; paid owns optional aggregation and compilation. | High legal/product risk if premium gains private access or required field features. | Clarify whether sidecar service-account role needs mechanical read-only enforcement. |
| Service-cutover ownership | `CURRENT` LoopCheck; `PROPOSED` LineCheck | Complete LoopCheck workflow from notice through restoration. | LineCheck becomes future owner of linear service acceptance/cutover. | Immediate move would strand users/evidence; dual-write creates split authority. | Approve ownership, minimum LineCheck readiness, and migration compatibility window. |
| Segment-acceptance ownership | `DECIDED` — LineCheck (2026-07-14) | LoopCheck has segments/templates but no complete UI; LineCheck owns pre-alpha pressure-test slice. | **Adopted:** LoopCheck expansion stopped; LineCheck is authoritative; landed schema frozen (maintenance-only, not ripped out), references migrated deliberately after LineCheck parity + versioned importer. | Building both now hardens incompatible semantics. | **Resolved** — ADR 0014 superseded; no LoopCheck segment UI/import/route to be built. |
| Deployment topology | `CURRENT` LAN/VPS docs; `PROPOSED` replica | Single PocketBase deployment; Caddy/systemd guidance; Pi/replica claims not hardware-validated. | Independently self-hostable core; optional managed/replica operations. | Data-loss/security risk if aspirational topology is treated as tested. | Validate Pi and restore/replication procedure before calling it supported. |
| Authentication | `CURRENT` backend; incomplete client reconciliation | Selective lockdown + PII split committed; office pages lack general auth fetch; later segments are public-write. | Preserve public scan/read and accountless flag/check/LOTO paths while authenticating office work/signatures. | Immediate production/security and usability risk. | Reconcile rules/UI, accept or supersede ADR 0011, test every access-matrix cell. |

## Stabilization gates

Before major refactoring, the safest gates are:

1. reconcile authentication rules, client token use, and PII/service import;
2. reconcile the public API contract with all committed migrations;
3. decide linear-infrastructure ownership before more segment/service work;
4. approve signature/hash semantics before landing active Phase 3 work;
5. expand the smoke test to the current collection set and new invariants;
6. define the first concrete handoff only after identifiers and authority are
   settled.

