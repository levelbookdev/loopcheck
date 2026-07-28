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
- the long-term authoritative test/acceptance system for linear pipe segments;
- a shared database or runtime package for the product family;
- dependent on a paid product for field execution or basic evidence retrieval.

**Customer service connections are NOT a non-goal.** Service cutover — notice
through restoration — is LoopCheck's permanently
([DECISIONS.md D9](DECISIONS.md#d9--service-cutover-stays-in-loopcheck-semantics-frozen)),
with its semantics frozen at the shipped tracker. The segment exclusion above is
`DECIDED` (D10), not merely proposed: MainLine owns future segment acceptance,
and LoopCheck's landed segment schema stays frozen at maintenance-only.

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

### MainLine

Primary question:

> Has this linear infrastructure completed the required acceptance sequence?

**CURRENT sibling evidence.** MainLine owns station-based pipeline construction
records: alignments, stations, and append-only test ledgers with derived
acceptance.

**DECIDED boundary (2026-07-18,
[DECISIONS.md D10](DECISIONS.md#d10--segment-acceptance-is-owned-by-mainline-correction-of-record)).**
**MainLine** owns test segments, pressure/gravity testing, flushing,
disinfection, sampling/lab-result attachment, and clearance for service — as an
**unscheduled future module**, not shipped capability. LoopCheck may consume a
segment accepted or placed-in-service event when plant startup depends on it; it
should not become the second authoritative ledger for those facts. LoopCheck's
landed segment schema slice stays, frozen at maintenance-only, and no
cross-product record migration is planned (migrations are frozen until there are
real users).

**Service cutover is NOT part of this boundary.** Notice through restoration
stays in **LoopCheck permanently**
([DECISIONS.md D9](DECISIONS.md#d9--service-cutover-stays-in-loopcheck-semantics-frozen)) — only segment/linear acceptance moved.

> *Historical note:* this scope was briefly assigned to **LineCheck**
> (2026-07-14). LineCheck is archived; the scope folded into MainLine.

### `bindery-*` products

**DECIDED for LoopCheck's paid boundary.** Bindery products own optional
coordination, managed operations, notification delivery, portfolio aggregation,
integrations, and advanced deliverable compilation. They use their own
databases and public versioned contracts. They do not acquire authority over
core field facts and are never prerequisites for core field execution.

The local Bindery LoopCheck README confirms a separate PocketBase database
and read-only HTTP use of LoopCheck. The local Bindery TrenchNote README
confirms a separate read-only sidecar. (A `linecheck-lookahead` directory also
existed locally at the time of this survey with no README to inspect; LineCheck
is archived, so it is historical.)

## Current overlaps and boundary fences

| Area | Current location | Recommended owner | Fence now |
| --- | --- | --- | --- |
| Service notice through restoration | Full LoopCheck workflow | **LoopCheck (settled, D9)** | No move. Maintain and evolve in LoopCheck; do not add a second cross-product master. |
| Pipeline segment tests and bac-t | LoopCheck schema/templates, frozen maintenance-only, no execution UI. | **MainLine (future module, D10)** | No LoopCheck segment execution work. Preserve landed schema/data; no migration planned. |
| Stored-equipment preservation | Untracked LoopCheck ADR proposal; no committed implementation. TrenchNote owns storage/preservation lifecycle by intended boundary. | Usually TrenchNote before installation; project-specific handoff may transfer responsibility. | Decide the custody-to-commissioning handoff before adding a LoopCheck recurring template. |
| Closeout/acceptance packages | LoopCheck for plant tags; MainLine would own segment packages in its future module. | Each core for its own facts; optional paid compiler aggregates. | Do not create a universal package database or copy mutable source facts. |
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

