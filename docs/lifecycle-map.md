# Ecosystem lifecycle map

**Status: PROPOSED.** This is an ownership and handoff map, not one shared
application, database, or workflow engine. Current deviations are called out
below.

```mermaid
flowchart LR
    A["Receive and inspect"] --> B["Store and preserve"]
    B --> C["Release or issue"]
    C --> D["Install"]
    D --> E["Test or check out"]
    E --> F["Start or place in service"]
    F --> G["Accept"]
    G --> H["Turn over"]

    TN["TrenchNote: custody authority"] --- A
    TN --- B
    TN --- C
    LC["LoopCheck: plant commissioning authority"] --- D
    LC --- E
    LC --- F
    LC --- H
    LINE["MainLine: linear acceptance authority (future module)"] --- E
    LINE --- F
    LINE --- G
```

The overlapping boxes are deliberate lifecycle boundaries, not permission to
duplicate authoritative facts. Installation means different things in each
context: TrenchNote may record that a physical item left stock/was consumed;
LoopCheck records whether installed plant equipment passed checkout; MainLine
would record whether installed pipe passed its acceptance sequence.

**Service connections are LoopCheck's, permanently** — notice through
restoration ([DECISIONS.md D9](DECISIONS.md#d9--service-cutover-stays-in-loopcheck-semantics-frozen)). Only segment/linear acceptance
sits with MainLine, and there only as an unscheduled future module
([D10](DECISIONS.md#d10--segment-acceptance-is-owned-by-mainline-correction-of-record));
this scope was briefly LineCheck's, and LineCheck is archived.

## Stage ownership and evidence

| Lifecycle stage | Proposed authoritative application | Authoritative fact/evidence | Candidate handoff |
| --- | --- | --- | --- |
| Material/equipment received | TrenchNote | Receipt event, quantity/asset, vendor/PO reference, condition, packing-slip evidence, time/location. | `material.received` or asset reference available to downstream project systems. |
| Inspected at receipt | TrenchNote | Inspection event and delivery exception evidence. | Exception/acceptance reference; do not copy the entire mutable catalog. |
| Stored and preserved | TrenchNote while custody/storage is the concern | Location/custodian movements and preservation inspections. | `asset.released_for_installation` with latest relevant evidence references. |
| Released/issued/consumed | TrenchNote | Append-only movement/consumption event identifying job/destination or installation reference. | Project + asset/material external reference and release event id. |
| Plant equipment installed | LoopCheck | Tag identity plus installation-phase check and punch evidence. | `plant_asset.installation_checked` for startup coordination. |
| Linear infrastructure installed | MainLine (future module) | Segment identity and installation/pre-test evidence defined by project requirements. Service connections stay LoopCheck's. | Test-ready lifecycle event. |
| Plant equipment checked out | LoopCheck | Append-only checks/items, test-equipment references, open blockers, derived phase standing. | `plant_asset.checkout_phase_passed`; consumers retain LoopCheck provenance. |
| Pipeline segment tested | MainLine (future module) | Pressure/gravity tests, readings, calculations, evidence, witnesses, locked snapshots. | `linear_subject.test_accepted` with method/version and evidence references. |
| Started/placed in service | LoopCheck for plant systems and service connections; MainLine for pipeline segments | Domain-specific startup or clearance evidence. | An explicit event consumed by the neighboring system only when needed. |
| Accepted | Producing domain core | Plant signoff and service cutover in LoopCheck; segment acceptance in MainLine. | Versioned acceptance event, never inferred by reading another database. |
| Turned over | LoopCheck for plant assets/systems and services; MainLine for linear packages | Frozen basic package/index in the core; compiled portfolio/binder may be paid. | Handoff manifest with source record/evidence references. |

## Current deviations

- **CURRENT (settled, not a deviation):** LoopCheck owns and executes service
  cutover from notice through restoration — permanently, per D9.
- **CURRENT schema/library only:** LoopCheck contains `segments`, segment test
  phases/templates, and open-to-resolve checks, frozen at maintenance-only with
  no execution UI.
- **FUTURE sibling direction:** MainLine would own segment testing and
  acceptance (flushing, disinfection, sampling, clearance, segment packages) as
  an unscheduled future module. Nothing is scheduled and no migration is
  planned.
- **UNKNOWN:** No versioned lifecycle-event or handoff-manifest exchange is
  implemented between the local product repositories.

Until migration, LoopCheck remains authoritative for records it already
created. Declaring a future owner does not retroactively move or invalidate
evidence.

## Handoff rules

**PROPOSED:**

1. The producer exports a versioned manifest or lifecycle event over a public
   contract; the consumer never reads the producer's SQLite/PocketBase files.
2. The payload carries stable source identity, project scope, event/export id,
   schema version, timestamps, and evidence references/hashes where available.
3. The consumer stores provenance and a local reference/projection. It does not
   become a second editable master of the source fact.
4. Re-import is idempotent. Correction/supersession arrives as a new event with
   a reference to the prior event.
5. Each application remains independently deployable and usable if every
   neighbor and paid product is absent.

Draft vocabulary is in
[`ecosystem-contracts.md`](ecosystem-contracts.md); it is non-binding.

