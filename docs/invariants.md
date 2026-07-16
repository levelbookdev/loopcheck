# LoopCheck invariants

Invariants are rules that should survive implementation changes. This file
separates protections already enforced from desired ecosystem guarantees that
still need design or verification.

## Confirmed current invariants

1. **Executed checks are append-only.** `checks` and `check_items` reject
   update and delete. Corrections and retests are new checks; failures remain
   visible. (`pb_migrations/1789000005_create_checks.js`,
   `1789000006_create_check_items.js`)
2. **Evidence records are not silently rewritten.** `attachments` rejects
   update/delete; LOTO applies/releases and closeout transitions are append-only
   records. (`1789000008`, `1789000012`, `1789000015`)
3. **Late results append rather than mutate collection events.** A pending
   check is resolved by a second check through `checks.resolves`.
   (`1789000023_migration_k_open_resolve.js`)
4. **Current operational standing is derived.** Tags, services, systems,
   rotations, segment acceptance, active LOTO, and warranty end dates do not
   rely on stored current-status fields.
5. **Historical prompts are frozen.** An executed check reads its
   `check_items.prompt` and frozen capture fields rather than re-rendering the
   living template.
6. **A check has exactly one subject.** The server create rule requires one of
   tag, system, service, or segment. (`1789000024_migration_l_segments.js`)
7. **Tag numbers are project-scoped business identifiers.** QR labels encode
   a plain `/t/{tag_number}` URL; collisions across projects are handled at
   lookup rather than by changing the printed identifier.
8. **Service PII is structurally separated.** Customer name and phone live in
   auth-gated `service_contacts`, never in the publicly readable `services`
   collection or QR URL. (`1789000020_migration_i_pii_split.js`)
9. **LOTO is visibility, never authorization.** Displays carry freshness and
   physical-verification language; the application does not determine who may
   work or release a lock.
10. **The basic field ledger does not depend on the paid sidecar.** Core field
    capture, public REST access as permitted, CSV retrieval, and print views
    reside in this AGPL repository. (ADR 0003)
11. **Seed templates have one authoritative source.** Built-in domain content
    lives under `seed/`; migrations load it rather than copy it.
12. **Acceptance values governed by contract documents remain explicit.** A
    `confirm_per_spec` item identifies the check while the project supplies the
    governing value/reference; the library does not silently universalize it.

## Confirmed lifecycle exceptions

Append-only does not mean every collection is immutable:

- `punch_items` stores an open/closed lifecycle and closure attribution.
- `closeout_requirements` stores current workflow status while
  `closeout_log` appends the transition history.
- `warranty_claims` may change while open and freeze once closed.
- Registries and living definitions (`projects`, subjects, templates, test
  equipment, warranties) are editable.

Code and documentation should name these as lifecycle/registry records, not
as immutable execution facts.

## Desired future invariants

The following are `PROPOSED` until accepted and mechanically enforced:

1. **Signed content never changes meaning silently.** A signature should bind
   to a versioned canonical snapshot; later work creates a superseding snapshot
   and requires new attestations.
2. **Corrections remain traceable across every signed record type.** A void,
   supersession, correction, or external result should reference what it
   affects and preserve the original.
3. **Units and calculation methods are explicit.** Every calculated acceptance
   fact should retain input units, method identifier/version, comparison, and
   rounding policy. LoopCheck's current generic value/unit answers do not yet
   establish a calculation contract.
4. **Evidence hashes are reproducible.** If hashing is adopted, canonical bytes,
   included fields/files, algorithm/version, and golden vectors must be public
   enough for independent verification.
5. **Project identity is portable and unambiguous.** Cross-product handoffs
   should not rely on unrelated local PocketBase ids accidentally matching.
6. **Imports preserve provenance.** Imported facts should record producing
   application, contract/schema version, source project/public id, export/event
   id, and import time without taking authority away from the producer.
7. **Lifecycle handoffs are idempotent and versioned.** Re-importing a manifest
   should not duplicate authoritative events; incompatible versions should fail
   explicitly.
8. **Each application remains authoritative for its bounded context.** An
   importer may reference or project a neighbor's fact but should not silently
   become its second mutable master.
9. **Basic field execution and data retrieval stay usable without paid
   aggregation.** Managed hosting, portfolio views, notifications, and compiled
   deliverables may be paid; capture and basic evidence export may not.
10. **Offline state is honest.** Cached safety/acceptance data must expose age
    and uncertainty; a queued local write must never be presented as a server-
    accepted fact.

Draft shapes supporting these goals are in
[`ecosystem-contracts.md`](ecosystem-contracts.md). They are not implemented
contracts.

