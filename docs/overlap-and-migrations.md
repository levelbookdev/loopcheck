# Product overlap and candidate migrations

> **MIGRATIONS FROZEN (2026-07-18).** Record migrations between products are
> frozen until there are real users. No cross-product import, export, or
> transfer of records is authorized, planned, or scheduled. The analysis below
> is preserved as thinking — a record of how the boundaries were reasoned
> about — not as a plan to execute. Two rows are also settled by later
> decisions: **service cutover stays in LoopCheck permanently**, and
> **segment acceptance is MainLine's**, not LineCheck's — LineCheck is
> archived and its scope folded into MainLine as an unscheduled future module.
> LoopCheck's shipped segment schema slice stays frozen exactly as it is.

**Status: HISTORICAL analysis.** No migration is authorized by this document.
Current LoopCheck records remain authoritative. The ownership conclusions have
been corrected in place to match D9/D10; the migration sequences are retained as
abandoned reasoning, not pending work.

## Summary

The local product family points toward clean bounded contexts. At the time of
this analysis LoopCheck contained two capabilities that looked like a sibling's
domain, plus an active proposal near TrenchNote's. Both have since been settled:
**service cutover stays in LoopCheck** (D9) and **segment acceptance is
MainLine's future module** (D10).

| Capability | Current evidence | Boundary assessment | Recommendation |
| --- | --- | --- | --- |
| Service notice/cutover/restoration | Complete LoopCheck `services` workflow, six phases, checks/punches, imports, QR/page/board. | *(Assessment at the time: wrong long-term context.)* | **SETTLED (D9): stays in LoopCheck permanently.** No migration. The "migrate to a sibling" recommendation this row originally carried was rejected. |
| Pipeline segment acceptance | LoopCheck `segments`, four-way check subject, segment phases/templates, pending/resolves; no execution UI. | Active duplication risk at the time. | **SETTLED (D10): MainLine owns it as an unscheduled future module.** LoopCheck implementation stops at maintenance; landed schema frozen. (ADR 0014 superseded. Briefly assigned to LineCheck, now archived.) |
| Stored equipment preservation | Untracked LoopCheck ADR 0015 proposal; no committed schema/template/UI. TrenchNote intended to own storage and preservation. | Boundary depends on custody: pre-install storage normally belongs to TrenchNote; post-install layup may belong to LoopCheck. | Split by lifecycle trigger, not by generic template reuse. Validate with real responsibility/warranty practice before accepting the ADR. |
| Evidence/signature concepts | LoopCheck turnover signature/hash; sibling designs also include signatures/canonical snapshots/hashes. | Same concept, different authoritative records. | Align vocabulary/envelopes where useful; do not create a shared runtime library or universal Evidence table. |
| Project/system identity | Each product has local ids and project records. | Duplicate names with no portable identity. | Approve project/public ids before cross-product import; preserve each local database. |
| Closeout packages | LoopCheck plant package direction; a segment acceptance package would belong to MainLine's future module. | Legitimate parallel concepts, not necessarily duplication. | Each core emits a basic package/index for facts it owns; optional sidecar compiles across them. |

## Service cutover migration — **ABANDONED (D9)**

> This whole section is superseded. **Service cutover stays in LoopCheck
> permanently**; there is no candidate target and no migration. It is preserved
> only as a record of the analysis that led to that decision.

### Current owner and semantics

**CURRENT.** LoopCheck owns `services`, protected `service_contacts`, six
service templates/phases, service-subject checks and punches, CSV import,
notice batch logging, `/s/{id}`, labels, and the cutover board. Those records
are real LoopCheck evidence and cannot be relabeled as another product's data by
documentation alone.

### Candidate target *(rejected)*

The analysis once proposed that a linear-infrastructure sibling would own new
service-connection acceptance and restoration once it had production-ready
identity, auth, offline, evidence, signature, and export capabilities. **That
proposal was rejected** — service cutover is LoopCheck's.

### Prerequisites *(moot — recorded for reasoning only)*

- accepted ownership ADRs in both repositories;
- a target service entity/lifecycle capable of representing every shipped
  LoopCheck phase and evidence link without loss;
- stable project/service/source-event identifiers;
- export from LoopCheck and idempotent import into the target, including PII
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

## Segment acceptance migration — **NO MIGRATION PLANNED (D10)**

> Ownership of future segment acceptance is **MainLine's**, as an unscheduled
> module. LoopCheck's landed schema slice stays frozen. Cross-product record
> migrations are frozen until there are real users, so nothing below is a plan.

### Current owner and semantics

**CURRENT schema.** LoopCheck has `segments`, `segment_type`, six segment
phases, fourth-subject relations on checks/punches, `pending`, and `resolves`.
The seed library contains pressure/gravity acceptance templates. No committed
segment import/page/board/package or resolve UI exists.

**FUTURE sibling direction.** MainLine already models alignments, stations, and
append-only test ledgers with derived acceptance, which is why the segment scope
folded into it. A future MainLine module would cover pressure-test segments,
readings, calculation contracts, witnesses, disinfection, sampling, clearance,
and acceptance packages. Nothing there is scheduled.

### Recommendation

**DECIDED (2026-07-18).** Do not add LoopCheck segment execution UI; MainLine is
the future authority. LoopCheck retains its additive schema, frozen at
maintenance-only. ADR 0014 is superseded and records the decision; the scope was
briefly assigned to LineCheck (2026-07-14) before LineCheck was archived.

The schema similarity is misleading: LoopCheck's generic value/check items do
not preserve a linear-acceptance product's calculation method versions, units,
readings/evidence rules, locking, or authoritative server calculation. Any
future mapping must be semantic, not table-to-table aesthetic normalization.

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

## Recommended order — **steps 4–8 abandoned**

Steps 1–3 were done and remain the standing posture; steps 4–8 described a
cross-product migration that is **not happening** (D9 keeps service in
LoopCheck; D10 plans no segment migration). They are struck through rather than
deleted so the reasoning survives.

1. ✅ Freeze new LoopCheck linear-infrastructure expansion; do not remove
   anything.
2. ✅ Reconcile LoopCheck auth/API/test drift so its existing data is
   trustworthy. *(The auth half landed with ADR 0011.)*
3. ✅ Approve product boundaries and portable identity rules. *(D9/D10.)*
4. ~~Stabilize a sibling's pressure-test vertical slice and versioned
   contracts.~~
5. ~~Define one service/segment export-import fixture with fictional evidence
   and lossless reconciliation criteria.~~
6. ~~Pilot one-way import into the sibling; LoopCheck remains source during
   pilot.~~
7. ~~Establish the sibling as writer for new records; retain LoopCheck legacy
   reads and QR resolution for a compatibility window.~~
8. ~~Only after verified adoption, decide whether a later LoopCheck migration
   removes, archives, or permanently preserves the overlapping schema.~~

The product family should never require all applications to be installed for
one of them to remain useful.

