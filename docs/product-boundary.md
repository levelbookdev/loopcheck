# LoopCheck product boundary

Status labels in this document mean:

- `CURRENT`: confirmed in the repository today.
- `DECIDED`: selected by an accepted LoopCheck ADR or hard constraint.
- `PROPOSED`: recommended direction requiring maintainer review.
- `UNKNOWN`: repository evidence is insufficient.

## Bounded context

**DECIDED.** LoopCheck owns plant-asset and process-system commissioning:

> Is this plant asset or process system ready to operate and turn over?

Its primary object is the project-scoped equipment tag identified in the field
by its P&ID `tag_number`. Systems group those tags into commissioning and
startup scopes. LoopCheck's authoritative facts are performed checkout events,
their frozen answers/evidence, equipment punch items, and plant-turnover facts.

## Owned workflows

| Workflow | Status | Boundary rationale |
| --- | --- | --- |
| Equipment identity and system grouping | `CURRENT` | Plant tags and process systems are LoopCheck's working language. |
| Installation, electrical, controls, loop, startup, functional, and performance checks | `CURRENT` | These establish whether installed plant equipment is ready to operate. |
| Equipment/system punch visibility | `CURRENT` | A-punch blockers are direct readiness inputs. |
| Rotation/VFD interpretation | `CURRENT` | Specialized commissioning capture over the ordinary check ledger. |
| LOTO visibility during commissioning | `CURRENT` | Relevant to tagged plant equipment, with strict non-authority framing. |
| Training milestone and plant closeout/warranty facts | `CURRENT` | They support asset turnover and owner handoff. |
| Signed frozen turnover snapshot | `PROPOSED` / active development | Fits LoopCheck, but ADR 0010 is still Proposed and implementation is not committed at the baseline. |
| Shutdown runbook execution | `DECIDED` future scope | Plant startup/shutdown coordination fits the process-system boundary; Phase 4 UI is not built. |

## Explicit non-goals

**DECIDED.** LoopCheck is not:

- a forms designer or universal workflow engine;
- an ERP, scheduler, cost system, daily report, document-management suite, or
  general project-management product;
- the authority for physical LOTO or permission to work;
- the authoritative inventory/custody ledger for material before installation;
- the long-term authoritative test/acceptance system for linear pipe segments
  or customer service connections;
- a shared database or runtime package for the product family;
- dependent on a paid product for field execution or basic evidence retrieval.

The last two linear-infrastructure exclusions are `PROPOSED` ecosystem
boundaries, because current LoopCheck code deviates from them.

## Neighboring bounded contexts

### TrenchNote

Primary question:

> Where is this physical material or asset, and what happened to it?

**CURRENT sibling evidence.** The local TrenchNote README describes receipt,
movement, location, custody, reservations, bulk consumption/installation
references, meter readings, and inspections. Its movement/inspection ledgers
are authoritative for physical custody history.

**PROPOSED boundary.** TrenchNote owns receipt, inspection, storage,
preservation while stored, custody, movement, release/issue, and a reference to
consumption or installation. LoopCheck may consume a release/installed handoff
and start commissioning evidence; it should not recreate the upstream custody
ledger. A preservation feature proposed in LoopCheck should be reviewed against
this boundary before implementation.

### LineCheck

Primary question:

> Has this linear infrastructure or service connection completed the required
> acceptance sequence?

**CURRENT sibling evidence.** The local LineCheck README identifies physical
test segments, pressure-test records, readings, calculations, witness
attestations, signatures, canonical snapshots, hashes, locking, and exports as
its first vertical slice. Its roadmap assigns flushing, disinfection,
bacteriological sampling, clearance for service, and segment packages to later
LineCheck phases. It is pre-alpha.

**PROPOSED boundary.** LineCheck owns test segments, pressure/gravity testing,
flushing, disinfection, sampling/lab-result attachment, clearance for service,
service cutover, and restoration. LoopCheck may consume a segment/service
accepted or placed-in-service event when plant startup depends on it; it should
not remain the second authoritative ledger for those facts.

### `*-lookahead` products

**DECIDED for LoopCheck's paid boundary.** Lookahead products own optional
coordination, managed operations, notification delivery, portfolio aggregation,
integrations, and advanced deliverable compilation. They use their own
databases and public versioned contracts. They do not acquire authority over
core field facts and are never prerequisites for core field execution.

The local LoopCheck-Lookahead README confirms a separate PocketBase database
and read-only HTTP use of LoopCheck. The local TrenchNote-Lookahead README
confirms a separate read-only sidecar. `linecheck-lookahead` exists locally but
had no README to inspect.

## Current overlaps and boundary fences

| Area | Current location | Recommended owner | Fence now |
| --- | --- | --- | --- |
| Service notice through restoration | Full LoopCheck workflow | LineCheck | Maintain existing users; do not expand semantics or add a second cross-product master. |
| Pipeline segment tests and bac-t | LoopCheck schema/templates; incomplete UI. LineCheck pre-alpha owns pressure-test MVP and plans later acceptance stages. | LineCheck | Stop new LoopCheck segment execution work until ownership and migration are approved. Preserve landed schema/data. |
| Stored-equipment preservation | Untracked LoopCheck ADR proposal; no committed implementation. TrenchNote owns storage/preservation lifecycle by intended boundary. | Usually TrenchNote before installation; project-specific handoff may transfer responsibility. | Decide the custody-to-commissioning handoff before adding a LoopCheck recurring template. |
| Closeout/acceptance packages | LoopCheck for plant tags; LineCheck plans segment packages. | Each core for its own facts; optional paid compiler aggregates. | Do not create a universal package database or copy mutable source facts. |
| Evidence files/signatures | Similar concepts in both products. | Producing core remains authoritative. | Share conceptual envelopes/version vocabulary, not runtime packages or database tables. |

Detailed migration analysis is in
[`overlap-and-migrations.md`](overlap-and-migrations.md).

## Areas LoopCheck should not expand further

Until the ownership questions are decided, LoopCheck should not add:

- segment import, segment QR routes, new linear test types, laboratory
  integration, segment clearance authorization, or segment acceptance UI;
- new service-customer communication/notification automation or restoration
  semantics beyond maintaining the shipped cutover tracker;
- material receipt, yard location, custody, storage inspection, or movement
  ledgers;
- a universal identity/auth service, shared PocketBase database, cross-repo
  code package, or direct database reader;
- paid-only capture, evidence access, or basic field exports.

This fence does not authorize removal. Current users and evidence must remain
supported until a versioned, tested migration exists.

