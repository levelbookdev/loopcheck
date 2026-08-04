# LoopCheck — Public API contract v1 and implementation delta

This document is the **boundary** decided in
[ADR 0003](adr/0003-core-premium-sidecar-boundary.md): the interface that
premium modules, integrations, and any third-party tool may build on — all
with exactly the same access. If it isn't described here, it isn't
contract, and building on it is at your own risk.

LoopCheck's API **is** [PocketBase's standard REST
API](https://pocketbase.io/docs/api-records/) — the core adds collections,
rules, and two clean HTML routes, not a parallel application API. Everything below is
reachable at the same origin that serves the pages. Current release is
tested against **PocketBase 0.39.6**; a PocketBase upgrade that changes
REST behavior is a breaking change to this contract.

> **Contract reconciliation required (CURRENT, 2026-07-20).** Contract v1 was
> published for the original sixteen collections. Committed migrations have
> since added `service_contacts`, `segments`, `service_visits`,
> `test_standards`, `calibrations`, and `calibration_points`, removed PII fields from
> `services`, and applied selective authentication. The **auth and PII
> semantics are now settled**: ADR 0011 is Accepted, the access matrix below is
> the reconciled policy (no public write rule survives outside the deliberate
> accountless field paths), and `scripts/smoke_test.sh` asserts it across three
> tiers. What is still not promoted into an approved v1 stability promise is the
> **collection set**: the six added collections remain marked **delta** pending
> a formal contract version bump, and ADR 0014 (segments) is superseded — the
> segment application moved to MainLine, though the shipped schema slice stays.
> Resolve the collection-set version before an external release or integration
> commitment.

## Contract collections

The committed schema has twenty-four application collections. The original
sixteen are the published v1 set; rows marked **delta** are implemented but
await a contract decision. `public` means no user token, `auth` means an
ordinary authenticated user, and `admin-only` means no ordinary record-rule
operation. Shape-specific create rules still apply in addition to auth.

| Collection | Contract status | Read | Create | Update | Delete |
|---|---|---|---|---|---|
| `projects` | v1 | public | auth | auth | admin-only |
| `systems` | v1 | public | auth | auth | admin-only |
| `tags` | v1 | public | auth | auth | admin-only |
| `services` | v1, changed shape | public, PII-free | auth | auth | admin-only |
| `service_contacts` | **delta** | auth | auth | auth | admin-only |
| `segments` | **delta; ADR 0011** | public | auth | auth | admin-only |
| `checklist_templates` | v1 | public | auth | auth | admin-only |
| `template_items` | v1 | public | auth | auth | admin-only |
| `checks` | v1 | public | public, subject rule | **never** | **never** |
| `check_items` | v1 | public | public | **never** | **never** |
| `punch_items` | v1 | public | public | auth, lifecycle close | admin-only |
| `test_equipment` | v1 | public | public | auth | admin-only |
| `test_standards` | **delta; ADR 0016** | public | auth | auth | admin-only |
| `calibrations` | **delta; ADR 0016** | public | capture route only | **never** | **never** |
| `calibration_points` | **delta; ADR 0016** | public | capture route only | **never** | **never** |
| `attachments` | v1 | public | public for check-item/punch/service-visit parents; otherwise auth | **never** | **never** |
| `warranties` | v1 | auth | auth | auth | admin-only |
| `closeout_requirements` | v1 | auth | auth | auth, log every change | admin-only |
| `closeout_log` | v1 | auth | auth | **never** | **never** |
| `warranty_claims` | v1 | auth | auth | auth **only while open** | admin-only |
| `loto_events` | v1 | public | public, LOTO shape rule | **never** | **never** |
| `service_visits` | **delta; ADR 0017** | public | public, tag XOR system + same-project rule | **never** | **never** |
| `turnover_packages` | **delta; ADR 0010** | public | build route only (createRule `null`) | **never** | **never** |
| `signatures` | **delta; ADR 0010** | public | auth | **never** | **never** |

`segments` was created after the auth migration and had briefly kept public
create/update rules; migration `1789000033` (ADR 0011) closed that gap, so its
create/update now require auth like `tags`, with reads public. No collection
carries a public write rule except the deliberate accountless field paths
(`checks`/`check_items`/`punch_items` create, `test_equipment` create, the
`loto_events` and `service_visits` shape-ruled creates, and the parent-scoped
`attachments` create).

Field-level shapes are defined by the migrations in `pb_migrations/` and
explained in [ARCHITECTURE.md](../ARCHITECTURE.md). Load-bearing semantics
for API clients:

- **Auth-refusal status codes are per-operation, not a uniform 401/403.** This
  is standard PocketBase behavior worth stating because it trips up auth
  probes: a rule-denied **list** returns `200` with an empty `items` array
  (never 401), a denied **view** returns `404`, a denied **create** returns
  `400`, and a denied **update/delete** returns `403` (or `404`). A client
  detecting "am I still authenticated?" must therefore inspect the *data* on a
  read, not the status — an expired token reads exactly like a guest. The core
  frontend detects expiry via the `auth-refresh` endpoint for this reason
  (ADR 0011 §6), and `scripts/smoke_test.sh` asserts denials on data presence
  plus a paired positive, never on a bare status code.
- **`checks`, `check_items`, `attachments`, `calibrations`,
  `calibration_points`, and `service_visits` are append-only**
  (ADR 0001, hard constraint #2). No client — premium, third-party, or
  future core code — can ever update or delete one. Corrections are new
  records.
- **The check subject rule** (enforced server-side; malformed records are
  rejected no matter who sends them): a check is about exactly one of
  `tag` XOR `system` XOR `service` XOR `segment`. Equipment checkout sets
  `tag`; a system-level event sets `system`; a service cutover phase sets
  `service`; a pipeline acceptance test sets `segment` (migrations
  `1789000013` and `1789000024`).
- **`services` semantics (ADR 0006):** `address` is the human-facing
  identifier (unique per project together with `station`); the URL/QR key
  is the record id (`/s/{id}`), never the address. `services` is structurally
  PII-free. `customer_name` and `customer_phone` live only in the auth-gated,
  one-to-one `service_contacts` collection and must never be placed in URLs,
  QR payloads, or public exports (migration `1789000020`). A service's
  **required phases** = the phases
  that have a `subject_kind='service'` template; its **standing** = its
  checks folded per phase (any pass wins; else any fail; else started).
  The service phase values are `notice | locate_pothole | new_service |
  meter | tie_over | restoration`; phase sets are per-subject-kind by
  convention — clients must not write equipment phases on service checks
  or vice versa.
- **`segments` semantics (implementation delta, ADR 0014 still Proposed):**
  `segment_id` is the project-scoped business label; `segment_type` is
  `pressure_main | force_main | gravity_sewer`. A segment uses its local
  PocketBase id as the planned route key, but no committed `/seg/` hook or
  segment page exists. Required phases derive from `subject_kind='segment'`
  templates whose `tag_type` equals the segment type. Phase values are
  `hydro | disinfection | bac_t | air_test | deflection | vacuum`.
- **Open→resolve checks (ADR 0012):** `result` also accepts `pending`. A later
  pass/fail check sets `resolves` to the pending check; neither record is
  edited. No committed UI yet executes this linked pair, so API clients must
  not infer a complete end-user workflow from the schema alone.
- **Frozen-copy pattern:** `check_items.prompt` and
  `checks.witness_required` are copied from the template at execution time,
  and `checks.test_equipment_note` freezes what instrument was used
  ("Fluke 754 s/n 8823, cal due 2026-09-01"). Read the frozen values when
  rendering history; templates and the equipment registry are living,
  checks are frozen.
- **`test_equipment` is a global registry** (ADR 0004) — serial numbers
  are the identity; it is deliberately not per-project. Checks reference
  up to 3 records via `test_equipment_used`. Calibration certificates
  attach via `attachments` (`parent_collection='test_equipment'`).
- **Instrument calibration is a separate append-only ledger** (ADR 0016).
  `test_standards` is the editable global registry. `calibrations` belongs to
  one instrument tag and freezes the standard identity, certificate due date,
  technician/company, performed date, interval, result, notes, and
  `standard_expired_at_use`; its ordered `calibration_points` always carry
  expected/as-found/as-left/unit/tolerance together. `next_due` is derived by
  day-clamped calendar-month addition (`performed_at + interval_months`) and is
  never stored. Create the complete record through
  `POST /api/calibrations/capture` as multipart form data: header fields,
  `points_json`, and optional `report`. `client_token` is required and makes a
  retry idempotent. Direct records-API creates are denied so an immutable
  header cannot be stranded without its points. The endpoint computes the
  expired-at-use flag server-side and does not reject an expired standard.
- **Punch evidence links** (ADR 0004): `punch_items.source_check` is the
  failed check that spawned the item; `punch_items.closing_check` is the
  passing retest that justified closure. Both optional — clients doing
  retest analytics use the links where present and fall back to inference
  (failed check → later check, same tag + phase) where not.
- **Operational standing is derived, never stored on tag/system/service/
  segment subjects.** Lifecycle records such as punch items and closeout
  requirements intentionally have stored workflow statuses; the following
  readiness/acceptance states do not:
  - A tag's **required phases** = the **six checkout phases** (installation,
    point_to_point, energization, loop_check, functional, performance) that
    have a `checklist_templates` record for its `tag_type`
    (`filter=(tag_type='pump_centrifugal' && phase != '')`), **minus any
    phase key listed in `tags.phases_na`** (ADR 0009 — a forgiving
    space/comma list of phases that don't apply to that specific tag;
    normalize before comparing). Blank `phases_na` = all templated phases
    apply.
  - The **`training` phase is a milestone, not a checkout phase** (ADR 0013):
    it is a valid `phase` value (a witnessed training event) but is
    excluded from the six-phase checkout fold — derive and present it apart,
    the way the readiness matrix does. Other valid values include the six service
    phases, six segment phases, and `leak_test`; phase meaning remains scoped by
    subject kind/type.
  - A tag's **standing** = its checks evaluated against those six phases.
  - A system's **readiness** = its tags' checks + its own checks + open
    A-severity `punch_items`.
- **`punch_items` lifecycle:** `status` is `open | closed`; closure is
  recorded (`closed_by`, `closed_at`, `closure_note`), records are never
  deleted. `severity` semantics are fixed: **A** blocks startup, **B**
  blocks substantial completion, **C** cosmetic. A punch item hangs off a
  `tag`, a `system`, a `service`, a `segment`, or just the `project` (all
  relations optional). The current create rule makes a service or segment
  exclude tag/system, but it does **not** reject setting both service and
  segment. Clients must avoid that ambiguous shape, and the rule needs
  reconciliation before segment writes are production-supported.
- **`tags.tag_number` is unique per project**, not globally. QR labels
  encode `{baseUrl}/t/{tag_number}` (hard constraint #6) — a printed-label
  contract; the `/t/{tagNumber}` route serves the tag page.
- **`tags.has_vfd`** (bool, landed additively with ADR 0008) marks
  VFD-driven equipment. Rotation checks are **ordinary checks** against the
  `*.rotation` / `*.rotationVfd` templates: the Hand and Auto direction
  values (`"forward"`/`"reverse"`) and any VFD parameters live in the
  check's `check_items`. `result` stores plain `pass`/`fail`/`incomplete`;
  the hardware-fault vs software-conflict (VFD reference parameter)
  distinction is derived by readers from the two direction values —
  a mismatch between modes means *do not swap leads*.
- **`checklist_templates.template_key`** is a stable opaque identifier
  (unique when set; blank on user-created templates). Do not parse it.
  `recurrence` blank = one-time checkout checklist; `daily | per_shift |
  per_event` are compliance cadences. `subject_kind` is `tag | location |
  service | segment`; location subjects have no execution surface until Phase
  5, and segment subjects do not yet have a committed execution surface.
- **`template_items.response_type`** is one of `pass_fail_na | value |
  text | photo_required` (exactly four, by design). `value` items carry a
  display `unit`; `confirm_per_spec: true` means the acceptance value is
  spec-governed — render with the value blank and a "per Section __"
  prompt (`spec_reference` may carry the citation).
- **`attachments` are polymorphic:** `(parent_collection, parent_id)`
  points at the owning record — e.g. punch-item photos are
  `filter=(parent_collection='punch_items' && parent_id='<id>')`.
  Warranty certificates and O&M manuals attach the same way
  (`parent_collection='warranties' | 'closeout_requirements'`). Vendor field
  reports use `parent_collection='service_visits'`; anonymous creation is
  allowed for that field-capture parent, as it is for check-item/punch evidence.
  Calibration reports use `parent_collection='calibrations'`, and standard
  certificates use `parent_collection='test_standards'`.
- **`service_visits` are immutable vendor-visit evidence** (ADR 0017): each
  record targets exactly one `tag` XOR `system`, and its server create rule also
  requires that subject's project equal the record's denormalized `project`.
  `purpose` is `installation_verification | startup_assistance |
  warranty_service | training | other`. The vendor report is an appended
  `attachments` child, not a mutable field. A missing report remains a valid
  but incomplete-evidence state that clients must flag. A tag's manufacturer
  certification is derived from visits with `installation_certified=true`
  (show the most recent certification date); it is never stored on `tags`.
  Creates include a client-generated unique `client_token`; offline clients
  query it before retrying after a lost response so one queued intent produces
  one immutable visit.
- **Warranty end dates are never stored** (ADR 0005). Clients derive them:
  `clock_start_date + duration_months` (day-clamped calendar months). The
  stored facts are the provenance: `basis` is one of
  `substantial_completion | beneficial_use | startup | shipment_cap |
  other`, `basis_note` carries the exact spec language, and a blank
  `clock_start_date` means the trigger event has not occurred yet — a
  valid state, not missing data.
- **`warranty_claims` are close-once:** the server accepts updates only
  while `closed_at` is empty (`updateRule: closed_at = ''`); the PATCH
  that sets `closed_at` is the last write the record ever accepts. An
  open claim = `filter=(closed_at='')`. Corrections to a closed claim are
  new claims. `opened_at` is client-set (like `checks.performed_at`);
  `created` is the server log stamp.
- **`closeout_requirements.status`** (`required | received | accepted`)
  is editable workflow state, but any client that changes it must also
  append a `closeout_log` record (`requirement`, `from_status`,
  `to_status`, `changed_by`, `note`) — the log collection is append-only
  in the schema and is the trail that makes the editable status
  trustworthy. `req_type` is one of `om_manual | spare_parts |
  special_tools | training | warranty_cert | test_report | other`.
  `storage_location` is free text by design (no integrations).
- **`loto_events` is append-only LOTO visibility, never authority**
  (ADR 0007). Server-enforced create shape: an `apply` must carry its
  `photo` (the hung lock on the isolation point — one multipart POST,
  atomic) and no `applies_to`; a `release` must reference an `apply` on
  the same `tag` via `applies_to`, and must carry `released_by_note`
  whenever its `lock_holder_name` differs from the apply's (supervisor
  removal). A tag is **locked out** if any apply has no release
  referencing it — derived, no status field; multiple simultaneous locks
  (group LOTO) are normal. `performed_at` is client-set (events logged
  from a dead zone sync late); `created` is the server stamp.
  **Display obligations for any client rendering LOTO status:** show the
  data-freshness timestamp and the line "Verify physically before any
  work"; degrade to an explicit stale state when data is older than
  ~10 minutes; and never render an affirmative "not locked out" — absence
  of records is "no locks recorded as of {time}", not a safety claim.
- **`turnover_packages` + `signatures` are append-only** (ADR 0010, Phase 3).
  A `turnover_packages` record is a **frozen snapshot**: a `manifest` (the
  scope's checks + their `check_items`, open punch, active LOTO, closeout — a
  per-collection field allowlist), a `standing_snapshot` (the derived readiness
  verdict at freeze time), and a `content_hash` under `hash_algo`
  `sha256-canon-v1` (pinned canonicalization: sorted ASCII keys, NFC, RFC 3339
  UTC, decimals as strings — a verifier recomputes it). Freezing a derived
  verdict is not a stored-status violation: the live readiness view still
  derives from scratch; the package freezes a copy, like `check_items.prompt`.
  A re-issue **supersedes** the prior package for its scope (self-relation);
  the **current package** for a scope is the one no other supersedes.
  `signatures` are recorded attestations (`subject_collection`/`subject_id` →
  a package or a check; `signer_name`/`signer_role`/`statement`,
  `signed_content_hash` copied from the package) — **NOT** qualified
  e-signatures; a signature requires `auth`, but its identity is only as strong
  as the deployment. Signatures do not carry forward: a new package starts
  unsigned. Optional drawn marks attach via `attachments`
  (`parent_collection='signatures'`).
- **Dates:** `systems.planned_startup` is date-only at UTC midnight —
  format in UTC or western timezones display the previous day.

## Other contract surface

- **Query features:** PocketBase's `filter`, `sort`, `expand` (including
  nested expands like `tag.system`), `fields`, and pagination (`page`,
  `perPage`, max 500 per page) on the collections above.
- **File URLs:** `/api/files/{collection}/{recordId}/{filename}` — e.g. a
  punch-item photo at `/api/files/attachments/{id}/{file}`.
- **Realtime:** PocketBase's SSE subscriptions at `/api/realtime` for the
  contract collections. Prefer SSE over tight polling — the server may be
  a commissioning trailer's Raspberry Pi whose first job is field scans.
- **The clean tag route:** `GET /t/{tagNumber}` returns the tag page shell
  (HTML). It is contract because printed QR labels encode it.
- **The clean service route:** `GET /s/{serviceId}` returns the service
  page shell (HTML) — contract for the same reason: meter-box QR labels
  encode it.
- **Atomic calibration capture:** `POST /api/calibrations/capture` accepts the
  purpose-built calibration form/outbox payload and commits header, point rows,
  and optional report together (ADR 0016).
- **Turnover build:** `POST /api/turnover/build` (auth) with `{project,
  system?, title?, generated_by?}` assembles a `turnover_packages` record
  **server-side** (ADR 0010): it queries the ledger, freezes a canonical
  manifest (per-collection field allowlist), computes a `sha256-canon-v1`
  `content_hash`, and creates the append-only package. Clients cannot POST a
  package directly (createRule `null`) — a forged manifest could omit the
  failing check. The response returns `{id, content_hash, hash_algo, standing,
  records}`.

## Announced future contract changes (not yet implemented)

Nothing here has shipped. It is recorded so an integrator planning against this
contract knows what is coming and can avoid depending on a shape that is
already scheduled to change. Source:
[ADR 0018](adr/0018-multi-vendor-startup-evidence-model.md) (*proposed*), the
M4–M6 track in [ROADMAP.md](ROADMAP.md). None of it lands before the v1
reconciliation and version bump (`open-questions.md` #7,
[DECISIONS D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)).

**Breaking — plan for it:**

- `punch_items.assigned_party` is revocabularized to `gc` · `subcontractor` ·
  `vendor` · `controls_integrator` · `electrical` · `owner` · `engineer` ·
  `unassigned`. **`contractor` is retired** (migrated to `gc`). Any client
  filtering or displaying `assigned_party = "contractor"` breaks.

**Additive but contract-visible:**

- Enum growth: `checks.result` += `deferred` (and `pending`, ADR 0012);
  `check_items.result` += `not_performed`, `deferred`; the shared phase enum +=
  `wet_commissioning`, `process_seeding`; `signatures.signer_role` +=
  `vendor_tech`, `subcontractor`, `gc_witness`, `controls_integrator`. A client
  that switches exhaustively on any of these enums must gain a default branch.
- New fields on existing collections: `checks.deferred_to_phase`,
  `checks.as_left_condition`, `checks.continues`,
  `checks.required_signature_roles`; `check_items.na_reason`,
  `check_items.value_numeric` + frozen limit fields; `template_items`
  expected-range fields; `checklist_templates.required_signature_roles` and
  `gate_for_phase`; `punch_items.blocks_phase` and `scope_gap`; `tags`
  nameplate fields; `service_visits` visit-detail fields.
- One new collection: append-only `instrument_settings`.

**New validation that can reject a call that succeeds today:**

- `check_items` with `result = "na"` will require `na_reason`.
- `POST /api/turnover/build` will **fail** on a scope containing any check item
  with a blank result, naming the offending check and line.

**Hash semantics:** the turnover manifest gains a vendor report index, a
per-tag instrument settings table, deferred standing cells, a
countersignature QC block, and a completeness assertion. These change the
canonical bytes, so they land inside `sha256-canon-v1` before the first real
package is signed, or behind a `sha256-canon-v2` — undecided
([open-questions #13](open-questions.md#13-do-adr-0018s-turnover-additions-land-inside-sha256-canon-v1)).

## Not contract

The internal SQLite layout and `pb_data/` contents, the PocketBase admin
UI and admin-only endpoints, PocketBase system collections, the seed
loader's mechanics, and any endpoint or behavior not listed here. These
can change without notice.
