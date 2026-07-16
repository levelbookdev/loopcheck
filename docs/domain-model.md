# LoopCheck domain model

This document separates the committed model from candidate additions.
`CURRENT` means present in migrations at commit `3da73d0` on 2026-07-12.
PocketBase record ids are local technical ids unless a business identifier is
called out explicitly.

## Current project, subject, and template records

| Entity | Purpose and owner | Identifier | Mutability and lifecycle | Relationships and evidence | Import/export |
| --- | --- | --- | --- | --- | --- |
| `projects` | Capital-project context owned by LoopCheck. | PocketBase id; human name is display-only. | Editable registry. | Parent of systems, tags, services, segments, punches, and office records. | Equipment/service CSV selects a project; no project handoff contract exists. |
| `systems` | Process-system grouping and startup order owned by LoopCheck. | PocketBase id; `number` is the business label. | Editable, including planning facts. | Project child; optional self-parent; groups tags and system checks. | Read by boards and the LoopCheck sidecar API. |
| `tags` | Plant asset/equipment identity owned by LoopCheck. | PocketBase id locally; `tag_number` is the project-scoped business id and QR identifier. | Editable equipment registry. | Project, optional system; subject of checks, punches, warranties, claims, closeout, and LOTO. | Equipment CSV import; tag-ledger CSV export. |
| `services` | Customer service-connection work item currently owned by LoopCheck. | PocketBase id in `/s/{id}`; address/station are business identifiers. | Editable field-facing registry. | Project; subject of checks and punches; one protected contact record. | Service CSV import; cutover print view. |
| `service_contacts` | Customer name/phone PII owned by LoopCheck only while service cutover remains here. | One record per service. | Auth-gated editable record; admin-only delete. | Required service relation; not exposed to public pages. | Current service importer has not been reconciled with the split. |
| `segments` | Pipeline acceptance subject currently present in LoopCheck schema. | PocketBase id; project-scoped `segment_id` is the business label. | Editable registry; currently public create/update due to an unresolved rule gap. | Project; fourth optional subject relation on checks and punches. | Segment templates exist; import, page, board, package, and clean route do not. |
| `checklist_templates` | Living definitions for a subject type, phase, and recurrence. | PocketBase id; `template_key` is a stable opaque library id when set. | Editable definition. | Parent of ordered template items; selected by subject kind/type. | Seed JSON is authoritative for built-in templates. |
| `template_items` | Ordered prompts with one of four fixed response types. | PocketBase id plus sequence within a template. | Editable definition. | Belongs to a template; prompt/response metadata are frozen into executions. | Loaded from `seed/`; not a standalone handoff format. |

`services` and `segments` are current schema facts but are boundary concerns:
their long-term ownership is evaluated in
[`overlap-and-migrations.md`](overlap-and-migrations.md).

## Current execution and evidence records

| Entity | Purpose and owner | Identifier | Mutability and lifecycle | Relationships and evidence | Import/export |
| --- | --- | --- | --- | --- | --- |
| `checks` | Authoritative checklist execution event. | PocketBase id; no separate public event id. | Append-only. Result is `pass`, `fail`, `incomplete`, or `pending`; a later check may point to the open event via `resolves`. | Exactly one of tag/system/service/segment; optional template and test equipment; owns check items. | Tag ledger CSV and print record; future handoff candidate. |
| `check_items` | Authoritative frozen answers and prompts for one check. | PocketBase id; ordered by creation/template sequence. | Append-only. | Check parent; optional source template item; attachments may point here. | Included in tag CSV and print record. |
| `punch_items` | Defect/blocker lifecycle record. | PocketBase id; no cross-product public id. | Mutable from open to closed; server-side delete unavailable to ordinary clients. Closure fields preserve attribution but the record is not an append-only event stream. | Project and optional tag/system/service/segment; optional source and closing checks; photo attachments. | Read by boards/packages; no dedicated export. |
| `test_equipment` | Shared test-instrument registry. | PocketBase id; serial number is the human identity. | Editable registry. | Referenced by checks; calibration certificates use attachments. | Not currently imported/exported as a contract artifact. |
| `attachments` | Polymorphic evidence-file envelope internal to LoopCheck. | PocketBase id and PocketBase file name. | Append-only metadata/file record. | `parent_collection` + `parent_id`; relationship is conventional, not a typed foreign key. | File URL is public API surface where rules permit. |
| `loto_events` | Safety-visibility apply/release ledger; never an energy-control authority. | PocketBase id; optional physical `lock_id`. | Append-only apply or release. | Project/tag; release references its apply; apply contains required photo atomically. | Displayed on tag/project boards; no export. |

The `checks` ledger is the authoritative fact for performed checkout. Standing
is a query over that ledger and the applicable template set. `punch_items` is
authoritative for the reported defect and recorded closure, but its `status`
is mutable workflow state rather than an immutable event fold.

## Current warranty and closeout records

| Entity | Purpose and owner | Identifier | Mutability and lifecycle | Relationships and evidence | Import/export |
| --- | --- | --- | --- | --- | --- |
| `warranties` | Contract provenance for an equipment warranty. | PocketBase id; tag + vendor/basis are business context. | Editable facts; end date is never stored. | Project/tag; attachments may hold certificates. | Equipment/warranty CSV import; print package. |
| `closeout_requirements` | Current state of a deliverable owed for a tag. | PocketBase id. | Editable `required` → `received` → `accepted` workflow. | Project/tag; every UI transition is intended to append a log record. | CSV-created; closeout board/package. |
| `closeout_log` | Authoritative history of closeout state transitions. | PocketBase id. | Append-only. | Belongs to a closeout requirement. | Print package reads the current requirement; log has no dedicated export. |
| `warranty_claims` | Equipment warranty issue and resolution. | PocketBase id. | Editable while open, frozen after `closed_at` is set; corrections then require a new claim. | Project/tag; optional evidence by attachment convention. | Print package; no dedicated export. |

Warranty expiry is derived from basis, clock-start date, and duration. The
closeout requirement's current status is stored for workflow convenience;
`closeout_log` is the evidence trail that should explain changes.

## Current derived states

| Derived state | Inputs | Stored? |
| --- | --- | --- |
| Tag checkout standing | Applicable templates, `tags.phases_na`, and tag checks folded by phase. | No |
| Training milestone | Applicable training template, `phases_na`, and training checks. | No |
| Service cutover phase/standing | Service templates and service checks. | No |
| Segment acceptance | Segment templates and segment checks. Schema supports inputs, but no complete UI derives it yet. | No |
| Rotation interpretation | Hand/Auto direction answers in check items. | No |
| System/project readiness | Tag/system checks and open A-severity punches. | No |
| Active LOTO | Apply events without a referencing release. | No |
| Warranty end | `clock_start_date` plus `duration_months`. | No |

## Proposed or active-development records

| Entity/concept | Status | Intended purpose | Constraint before adoption |
| --- | --- | --- | --- |
| `turnover_packages` | `UNKNOWN` — staged at session start; ADR 0010 remains Proposed. | Immutable, hashed snapshot of a project/system ledger. | Review ADR status, canonicalization, manifest completeness, auth, contract version, and golden-vector tests. |
| `signatures` | `UNKNOWN` — staged at session start; ADR 0010 remains Proposed. | Append-only attestation bound to a frozen hash. | Resolve identity/auth semantics and distinguish recorded attestation from qualified e-signature. |
| Shutdown/runbook records | `PROPOSED` Phase 4. | Role-aware, ordered execution with holds/offsets. | Do not force runbook semantics into flat checklist tables. |
| Recurring location execution | `PROPOSED` Phase 5. | Compliance logs against locations and recurring tag work. | Define location ownership and recurrence/execution UI. |
| Cross-product lifecycle events and handoff manifests | `PROPOSED`. | Versioned exports carrying provenance between bounded contexts. | Approve identifiers, schemas, compatibility, and authority rules before code. |

No proposed row is part of the current API contract merely because a draft ADR,
seed file, or uncommitted migration exists.

