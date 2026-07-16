# Product overlap and candidate migrations

**Status: PROPOSED analysis.** No migration is authorized by this document.
Current LoopCheck records remain authoritative until an approved replacement
has imported and verified them.

## Summary

The local product family points toward clean bounded contexts, but LoopCheck
currently contains two meaningful pieces of LineCheck's intended domain and
has an active proposal near TrenchNote's intended domain.

| Capability | Current evidence | Boundary assessment | Recommendation |
| --- | --- | --- | --- |
| Service notice/cutover/restoration | Complete LoopCheck `services` workflow, six phases, checks/punches, imports, QR/page/board. | Wrong long-term context: linear service acceptance/cutover. | Maintain in LoopCheck, freeze expansion, migrate to LineCheck only after equivalent field capability and a versioned importer exist. |
| Pipeline segment acceptance | LoopCheck `segments`, four-way check subject, segment phases/templates, pending/resolves; no execution UI. LineCheck pressure-test MVP and later acceptance roadmap. | Active duplication risk; easiest safe point is now, before LoopCheck UI/data adoption grows. | **DECIDED (2026-07-14):** stop LoopCheck implementation beyond maintenance; LineCheck is the target authority. (ADR 0014 superseded.) |
| Stored equipment preservation | Untracked LoopCheck ADR 0015 proposal; no committed schema/template/UI. TrenchNote intended to own storage and preservation. | Boundary depends on custody: pre-install storage normally belongs to TrenchNote; post-install layup may belong to LoopCheck. | Split by lifecycle trigger, not by generic template reuse. Validate with real responsibility/warranty practice before accepting the ADR. |
| Evidence/signature concepts | LoopCheck proposed turnover signature/hash; LineCheck current design includes signatures/canonical snapshots/hashes. | Same concept, different authoritative records. | Align vocabulary/envelopes where useful; do not create a shared runtime library or universal Evidence table. |
| Project/system identity | Each product has local ids and project records. | Duplicate names with no portable identity. | Approve project/public ids before cross-product import; preserve each local database. |
| Closeout packages | LoopCheck plant package direction; LineCheck segment acceptance package direction. | Legitimate parallel concepts, not necessarily duplication. | Each core emits a basic package/index for facts it owns; optional sidecar compiles across them. |

## Service cutover migration

### Current owner and semantics

**CURRENT.** LoopCheck owns `services`, protected `service_contacts`, six
service templates/phases, service-subject checks and punches, CSV import,
notice batch logging, `/s/{id}`, labels, and the cutover board. Those records
are real LoopCheck evidence and cannot be relabeled as LineCheck data by
documentation alone.

### Candidate target

**PROPOSED.** LineCheck owns new service-connection acceptance and restoration
once it has production-ready identity, auth, offline, evidence, signature, and
export capabilities. LoopCheck then consumes only the placed-in-service fact
needed by plant/system startup, if any.

### Prerequisites

- accepted ownership ADRs in both repositories;
- LineCheck service entity/lifecycle capable of representing every shipped
  LoopCheck phase and evidence link without loss;
- stable project/service/source-event identifiers;
- export from LoopCheck and idempotent import into LineCheck, including PII
  rules, checks/items, punches, attachments, timestamps, and user-entered names;
- mapping rules for mutable punch/closeout state and immutable check evidence;
- read-only reconciliation report proving counts, hashes where available, and
  unresolved exceptions;
- a compatibility period for printed `/s/{id}` QR labels and old bookmarks;
- explicit deprecation/support policy before any write path is disabled.

### Risks and preservation requirements

- Addresses and stations are not guaranteed global ids; local record ids cannot
  be copied without source-deployment provenance.
- PII must remain structurally protected during export/import and never enter a
  public manifest.
- Original LoopCheck check ids, performed/created timestamps, frozen prompts,
  photos, failures, and punch closure evidence must remain traceable.
- Dual-write is rejected as a steady state: it creates two mutable authorities
  and conflicting offline behavior.
- Existing `/s/` QR URLs need a stable read-only resolver or an explicit label
  replacement campaign; silent breakage is unacceptable.

## Segment acceptance migration

### Current owner and semantics

**CURRENT schema.** LoopCheck has `segments`, `segment_type`, six segment
phases, fourth-subject relations on checks/punches, `pending`, and `resolves`.
The seed library contains pressure/gravity acceptance templates. No committed
segment import/page/board/package or resolve UI exists.

**CURRENT sibling direction.** LineCheck's pre-alpha architecture centers its
first vertical slice on pressure-test segments, readings, project-specific
calculation contracts, witnesses, signatures, locking, and exports. Its roadmap
adds disinfection, sampling, clearance, and acceptance packages.

### Recommendation

**DECIDED (2026-07-14).** The maintainer adopted this: do not add LoopCheck
segment execution UI; LineCheck matures as the authoritative implementation.
LoopCheck retains its additive schema, frozen at maintenance-only, until a later
decision on whether to deprecate it, export any created records, or keep it as a
read-only legacy compatibility surface. ADR 0014 is superseded and records the
decision.

The schema similarity is misleading: LoopCheck's generic value/check items do
not preserve LineCheck's planned calculation method versions, units,
readings/evidence rules, locking, or authoritative server calculation. Mapping
must be semantic, not table-to-table aesthetic normalization.

## Preservation boundary

**PROPOSED rule.** Ownership follows custody/responsibility:

- before release/installation, TrenchNote owns location, custody, and required
  storage-preservation inspections;
- after installation or formal transfer into commissioning custody, LoopCheck
  may own manufacturer layup/periodic commissioning preservation against the
  equipment tag;
- the handoff references the upstream asset/release/preservation evidence;
  neither product copies and edits the other's ledger.

This distinction should be validated against real warranty language and field
responsibility before accepting the active preservation proposal.

## Recommended order

1. Freeze new LoopCheck linear-infrastructure expansion; do not remove
   anything.
2. Reconcile LoopCheck auth/API/test drift so its existing data is exportable
   and trustworthy.
3. Approve product boundaries and portable identity rules.
4. Stabilize LineCheck's pressure-test vertical slice and versioned contracts.
5. Define one service/segment export-import fixture with fictional evidence and
   lossless reconciliation criteria.
6. Pilot one-way import into LineCheck; LoopCheck remains source during pilot.
7. Establish LineCheck as writer for new records; retain LoopCheck legacy reads
   and QR resolution for a documented compatibility window.
8. Only after verified adoption, decide whether a later LoopCheck migration
   removes, archives, or permanently preserves the overlapping schema.

The product family should never require all applications to be installed for
one of them to remain useful.

