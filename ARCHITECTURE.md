# ARCHITECTURE.md — LoopCheck

How LoopCheck is built and why. Read alongside [CLAUDE.md](CLAUDE.md) (the
constraints) and the commented migrations in `pb_migrations/`.

## 1. Shape of the system

```
Browser (stock phone camera → URL)                    PocketBase (single Go binary)
┌─────────────────────────────┐   HTTP same-origin   ┌──────────────────────────────┐
│ pb_public/*.html + Alpine.js │ ───────────────────► │ REST API  /api/collections/* │
│  reads window.location       │ ◄─────────────────── │ SQLite (embedded)            │
│  origin — no host config     │                      │ pb_migrations/ (schema+seed) │
└─────────────────────────────┘                      │ pb_hooks/ (/t/{tag} route)   │
                                                       └──────────────────────────────┘
```

No build step, no bundler, no CDN. Every page is a static file that talks to
the same origin it was served from. PocketBase serves `pb_public/`, applies
`pb_migrations/` on startup, and runs `pb_hooks/`.

## 2. Data model

Thirty-two committed application collections. Relations are drawn
`child → parent`; PocketBase system/auth collections are not counted.

```
projects
  ├── systems            (project; parent_system → systems, self-nesting)
  │     └── tags         (project, system)
  ├── tags               (project, system?)         tag_number unique per project
  ├── services           (project)                  one customer service connection
  │     └── service_contacts (service)              auth-gated customer PII
  ├── segments           (project)                  station-to-station pipe subject
  ├── service_visits     (project, tag? XOR system?) APPEND-ONLY vendor visit ledger
  ├── punch_items        (project, tag?, system?, service?, segment?) lifecycle
  └── (checks hang off tags, systems, services, and segments)

checklist_templates
  └── template_items     (template)                 ordered line items

checks                   (tag XOR system XOR service XOR segment, template?) ledger
  └── check_items        (check, template_item?)     APPEND-ONLY

test_equipment           (global registry)           checks reference it (≤3)
attachments              (parent_collection, parent_id)   polymorphic files

test_standards           (global editable registry)      certificate provenance
calibrations             (tag, standard)                 APPEND-ONLY header
  └── calibration_points (calibration)                   APPEND-ONLY point rows

warranties               (project, tag)              editable registry of contract facts
closeout_requirements    (project, tag)              workflow state (required→received→accepted)
  └── closeout_log       (requirement)               APPEND-ONLY status trail
warranty_claims          (project, tag)              close-once ledger

loto_events              (project, tag; applies_to → loto_events)   APPEND-ONLY apply/release ledger

turnover_packages        (project, system?; supersedes → turnover_packages)   APPEND-ONLY frozen snapshot
signatures               (subject_collection, subject_id → package XOR check)  APPEND-ONLY attestation

shutdown_templates       (library header)                 the runbook, project-agnostic
  ├── shutdown_template_steps (template)                  ordered steps, role/tag as TEXT
  ├── shutdown_contingencies  (template)                  trigger/action pairs, not steps
  └── shutdown_template_roles (template)                  the runbook's own role table
shutdown_roles           (project)                        per-project role + contact registry

shutdowns                (project, system?, template?)    one planned outage; editable plan
  └── shutdown_steps     (shutdown, responsible_role?, tag?)  instantiated list; editable
        └── shutdown_step_events (shutdown, step?, contingency?)  APPEND-ONLY execution ledger
```

### Collections

| Collection            | Purpose                                                        | Mutability |
|-----------------------|----------------------------------------------------------------|------------|
| `projects`            | One capital job. Owner / EOR / contractor names.               | editable   |
| `systems`             | Process system, nestable, `startup_sequence` orders the march. | editable   |
| `tags`                | One piece of equipment, keyed by P&ID `tag_number`.            | editable   |
| `services`            | One customer service connection, keyed by street `address`.    | editable   |
| `service_contacts`    | Auth-gated customer name/phone, one-to-one with a service.      | editable   |
| `segments`            | One station-to-station pipe test subject, keyed by `segment_id` per project. **Frozen / maintenance-only** — linear acceptance moved to MainLine (ADR 0014 superseded, 2026-07-18); schema stays, no LoopCheck UI. | editable |
| `checklist_templates` | A named checklist for one tag_type + phase (or a process log). | editable   |
| `template_items`      | One ordered line: text + response_type + unit + confirm_per_spec + spec_reference. | editable   |
| `checks`              | One checklist event against a tag XOR system XOR service XOR segment. | **append-only** |
| `check_items`         | The answered lines of a check.                                | **append-only** |
| `punch_items`         | A defect/open item. Severity A/B/C. open→closed.              | close only |
| `test_equipment`      | Global instrument registry: description, make/model/serial, `cal_due`. | editable |
| `attachments`         | A file (photo, cal cert) pointed at any record.               | **append-only** |
| `test_standards`      | Global calibration-standard registry: identity, owner, certificate dates. | editable |
| `calibrations`        | One purpose-built instrument calibration with frozen standard provenance. | **append-only** |
| `calibration_points`  | Ordered expected/as-found/as-left rows for one calibration. | **append-only** |
| `warranties`          | Who backs a tag, on what basis, and when the clock started.   | editable   |
| `closeout_requirements` | One deliverable owed per tag (O&M manual, spares, training…). | editable (logged) |
| `closeout_log`        | The trail behind every requirement status change.             | **append-only** |
| `warranty_claims`     | Warranty failures: opened → vendor notified → closed.         | **close-once** |
| `loto_events`         | Lockout/tagout applies and releases — a visibility ledger, never an authority. | **append-only** |
| `service_visits`      | Manufacturer-representative visits against a tag XOR system, with report evidence. | **append-only** |
| `turnover_packages`   | A frozen, sealed snapshot of a scope's checkout — the signed turnover deliverable (built server-side). | **append-only** |
| `signatures`          | A recorded attestation (name/role/statement) bound to a package or check by content hash. | **append-only** |
| `shutdown_templates`  | A named shutdown runbook in the library (seeded from `seed/`).  | editable   |
| `shutdown_template_steps` | Ordered library steps: group, offsets, hold point, role/tag as project-agnostic **text**. | editable |
| `shutdown_contingencies` | Library trigger/action pairs. Not steps — no seq position, offset, or hold point. | editable |
| `shutdown_template_roles` | The runbook's own role table (`role_key`, `title`, `notify_on`), project-agnostic. Copied into `shutdown_roles` when a shutdown is planned. | editable |
| `shutdown_roles`      | Per-project role registry: `role_key`, title, contact, `notify_on` (**stored, never acted on**). | editable |
| `shutdowns`           | One planned outage. `planned_window_start` is T-0. A planning record, deliberately **not** append-only. | editable |
| `shutdown_steps`      | The instantiated step list; role and tag are real **relations** here. Editable while planning. | editable |
| `shutdown_step_events` | What actually happened: started/completed/held/released/aborted/resumed/not_performed/contingency_invoked, with frozen step text. | **append-only** |

### Field notes worth knowing

- **`tags.tag_number` is unique per project, not globally** (composite unique
  index `project + tag_number`). Two plants can each have a PMP-101. The
  `/t/{tag_number}` page resolves by number and, on the rare cross-project
  collision, shows a project chooser instead of guessing.
- **`systems.parent_system`** is a self-relation, added in a second `app.save()`
  inside the migration (a relation field cannot point at a collection that does
  not exist yet).
- **A check's subject is exactly one of tag / system / service / segment**
  ([ADR 0001](docs/adr/0001-seed-reconciliation-and-check-subjects.md),
  [ADR 0006](docs/adr/0006-service-connections-third-subject.md)):
  equipment checkout runs against a tag; a system-level event (functional
  demonstration) runs against a system; a cutover phase runs against a
  service; a linear acceptance test runs against a segment. All four relation
  fields are optional at the field level; the
  collection's `createRule` enforces exactly-one server-side — append-only
  means a malformed record would be permanent, so the rule is the gate, not
  the UI. Migration `1789000024` repeats ADR 0006's nullable-relation recipe
  for the fourth subject.
- **Services are the first non-equipment subject** (ADR 0006): a water main
  replacement's cutover sequence (notice → locate/pothole → new service →
  meter → tie-over → restoration) runs the SAME checklist engine —
  `subject_kind: "service"` templates, service phases appended to the shared
  phase enum, required phases derived from the template library exactly like
  a tag's. The `address` is the human-facing identifier everywhere a
  tag_number would appear, but the URL/QR key is the opaque record id
  (`/s/{id}`) — addresses are neither unique nor URL-clean, and the PII rule
  forbids person-identifying data in URLs. Migration `1789000020` moved
  `customer_name` and `customer_phone` into the auth-gated, one-to-one
  `service_contacts` collection and removed those fields from publicly readable
  `services`. The boundary is structural rather than dependent on `fields=`
  discipline.
- **`checks` and `check_items` freeze a copy of the template text**
  (`check_items.prompt`) at the moment of the check, so a historical check reads
  correctly even after its template is later edited. Templates are living;
  checks are frozen.
- **`punch_items` are not the ledger** — they have a real open→closed lifecycle,
  so `updateRule` is permissive enough to close one. But the closure is recorded
  (`closed_by`/`closed_at`/`closure_note`) and the record is never deleted.
- **`attachments` is polymorphic** — `(parent_collection, parent_id)` rather than
  a file field on every collection. Punch-item photos today; calibration certs
  and nameplate photos on checks later, with no schema change.
- **Vendor field-service visits are immutable evidence**
  ([ADR 0017](docs/adr/0017-vendor-field-service-reports.md)):
  `service_visits` records a representative's visit against exactly one `tag`
  XOR `system`; its create rule also verifies the denormalized `project` agrees
  with that subject. The signed PDF/photo uses the existing polymorphic
  `attachments` parent (`parent_collection='service_visits'`). A missing report
  is allowed so a failed second upload cannot erase the visit, but readers must
  flag that evidence gap loudly. A tag's **Manufacturer-certified
  installation: {date}** line derives from its flagged visits (most recent
  certification date); no certification field is stored on the tag. Warranty
  `basis_note` may cite the visit by convention, with no hard module coupling.
  A unique `client_token` makes offline create retries idempotent.
- **Capture-side fields land before crews log**
  ([ADR 0002](docs/adr/0002-capture-side-fields-before-crews-log.md)): tags
  carry the instrument-index facts (`area`, `spec_section`, `loop_numbers`,
  `plc`, `mcc_breaker`, `drawing_refs`, populated by the CSV import's
  header synonyms); systems carry an optional `planned_startup` date; and
  `witness_required` is template data frozen onto each check at execution —
  same freezing pattern as the prompt text.
- **`tags.has_vfd`** ([ADR 0008](docs/adr/0008-vfd-rotation-check.md)) is a
  capture-side boolean in the same spirit: whether the motor is VFD-driven
  is an equipment-schedule fact, imported from the CSV (`has_vfd`/`vfd`
  synonyms; `vendor` maps to the existing `manufacturer`). It selects which
  rotation template the capture UI offers (`*.rotation` vs `*.rotationVfd`
  — two templates, not a conditional one). The rotation check itself is an
  ordinary append-only check; its pass / swap-leads / check-VFD-parameter
  reading is derived from the two recorded direction values, never stored.
- **`tags.phases_na`** ([ADR 0009](docs/adr/0009-per-tag-phase-applicability.md))
  is a capture-side text list of the checkout phases that do NOT apply to
  this *specific* tag (an across-the-line motor has no configuration phase; a
  hardwired float switch has no analog loop check). It refines the derived
  required-phases set — `required = has a template for the tag_type AND not in
  phases_na` — so the standing plate and readiness matrix don't false-red a
  phase that was never owed. Still an applicability *input*, not a stored
  status; a blank value (the common case) means every templated phase applies.
  Forgiving free text: the derivation normalizes both sides, so `loop_check`,
  `Loop Check`, and `loopcheck` all match.
- **Training is a signable milestone, not a checkout phase**
  ([ADR 0013](docs/adr/0013-training-as-a-signable-milestone.md)): a
  `*.training` template (`subject_kind: "tag"`, `witness_required: true`) runs
  through the ordinary check engine — a signed, witnessed, dated training
  *event* per equipment. Its `phase` value `training` is a MILESTONE
  deliberately kept OUT of the six-phase "checkout complete" fold (the readiness
  matrix places "Training Completed" beside the checkout columns, not inside
  them); the tag page and readiness matrix derive it and show it separately.
  `phases_na` governs applicability (a tag owing no training marks it N/A).
  The closeout `training` requirement stays for the *deliverable* (materials
  handed over) — a distinct fact from the event. The enum gains `training`
  additively (Migration J, `1789000021`); the training templates load in the
  following loader (`1789000022`) after the enum opens — the same
  separate-file-and-later-loader ordering the service phases used.
- **Warranties record the clock, not the deadline**
  ([ADR 0005](docs/adr/0005-warranty-closeout-clock-start-provenance.md)):
  the single biggest warranty fight is *when the clock started*, so a
  warranty stores the `basis` (substantial completion / beneficial use /
  startup / shipment cap / other), the exact spec language (`basis_note`),
  the trigger date (`clock_start_date` — optional, because during
  commissioning the event usually hasn't happened yet), and
  `duration_months`. The end date is **derived in the UI, never stored**.
  `closeout_requirements.status` is editable workflow state, but every
  change is appended to the immutable `closeout_log`; `warranty_claims`
  are updatable while open and frozen server-side the moment `closed_at`
  is set (`updateRule: "closed_at = ''"`) — corrections after closure are
  new claims.
- **`loto_events` is a two-event ledger, not a locks table**
  ([ADR 0007](docs/adr/0007-loto-visibility-staleness-asymmetry.md)): an
  `apply` and its `release` are separate append-only records; the release
  points back via `applies_to` (a self-relation, added second-save like
  `systems.parent_system`). The photo of the hung lock is a **required
  file field on the apply event itself** — one atomic multipart POST —
  because the two-step create-then-attach could permanently strand an
  append-only record without its constitutive evidence, and no rule on
  `attachments` can require a child record. The createRule enforces the
  shape (apply must carry a photo; a release must reference an apply on
  the same tag; a releaser whose name differs from the holder's must
  carry `released_by_note` — the supervisor-removal justification rides
  into the immutable record). The app never decides who MAY release;
  it records who did.
- **A turnover package freezes a *derived verdict*, and that is not a
  stored-status violation** ([ADR 0010](docs/adr/0010-signatures-and-turnover-package.md)):
  a signature attests to the ledger *as it stood on the day it was signed*,
  but readiness is derived and the ledger keeps growing — so the thing signed
  must be frozen. `turnover_packages` freezes a `manifest` (the scope's checks
  + their `check_items`, open punch, active LOTO, closeout — a per-collection
  field allowlist), a `standing_snapshot` (the derived verdict at freeze time),
  and a `content_hash` under the pinned `sha256-canon-v1` canonicalization (a
  verifier recomputes it). This is the same move `check_items.prompt` already
  makes: the *live* readiness view still derives from scratch; the package
  stores a **copy** as historical evidence, so nothing anyone reads as
  "current" can drift (hard constraint #4 holds). The package is assembled
  **server-side** in `pb_hooks` (`POST /api/turnover/build`) because a client
  cannot be trusted to compute the manifest of what it claims the ledger
  contains — createRule `null` blocks direct client creates. A re-issue
  **supersedes** the prior package for its scope (self-relation); the *current*
  package is the one no other supersedes, and signatures do not carry forward.
  `signatures` are recorded attestations bound by `signed_content_hash` — not
  qualified e-signatures.
- **Test equipment is traceable; punch items link to their evidence**
  ([ADR 0004](docs/adr/0004-test-equipment-and-punch-evidence-links.md)):
  checks reference up to three `test_equipment` records and freeze a
  human-readable note of what was used; punch items optionally point at the
  failed check that spawned them (`source_check`) and the passing retest
  that cleared them (`closing_check`). The registry is global — serial
  numbers are the identity, and meters move between jobs.
- **Instrument calibration is a purpose-built ledger**
  ([ADR 0016](docs/adr/0016-purpose-built-instrument-calibration-records.md)),
  not a fifth checklist response type. `calibrations` freezes the standard's
  identity, certificate due date, and the server-derived
  `standard_expired_at_use` flag; `calibration_points` preserves each expected,
  as-found, and as-left triplet. Both collections are append-only. The editable
  `test_standards` registry can roll forward after recertification without
  rewriting history. `next_due` and the instrument badge derive from the latest
  calibration's `performed_at + interval_months`, never from stored status.

### Planned collections and active schema work

The twenty-four collections above are the complete **committed** application
schema. Both collections this section previously listed as *planned* have
shipped, and the ADRs behind them are now Accepted:

- **`signatures` + `turnover_packages`**
  ([ADR 0010](docs/adr/0010-signatures-and-turnover-package.md), **accepted
  2026-08-04**) — migration `1789000026`, the server builder/canonicalizer
  (`pb_hooks/turnover.pb.js` + `turnover_canon.js`), and `sign.html` /
  `turnover.html` are all committed and counted in the twenty-four above.
  `turnover_packages` is an append-only **frozen snapshot** of a scope's
  checkout at a moment (a manifest of the included records under a
  per-collection field allowlist, a `sha256-canon-v1` content hash, and the
  derived readiness verdict frozen into the record); `signatures` is an
  append-only, polymorphic **attestation** bound to that frozen content by its
  hash. The **golden vector is enforced at the build route** — a drifted
  canonicalizer makes `POST /api/turnover/build` refuse rather than seal a hash
  no independent verifier could reproduce — and `scripts/smoke_test.sh` asserts
  the pinned algo, digest shape, hash determinism across a rebuild, and
  supersession. Core stores the facts; the compiled PDF turnover binder stays
  the paid sidecar (ADR 0003). The API v1 **contract bump** for these two is
  still outstanding (M3, [D12](docs/DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)):
  an accepted ADR is a settled design, not a published contract version.

`service_contacts` is no longer planned: migration `1789000020` committed the
structural PII split, and ADR 0011 is Accepted.

#### Designed but not built — the multi-vendor startup track (ADR 0018)

**Nothing in this subsection is shipped behavior.** It is design capture from
[ADR 0018](docs/adr/0018-multi-vendor-startup-evidence-model.md) (*proposed*),
recorded here so a future reader knows the shapes were reasoned about rather
than left open. The sequenced work is the M4–M6 track in
[`docs/ROADMAP.md`](docs/ROADMAP.md); **do not implement any of it before ADR
0018 is Accepted.** Field observations from a multi-vendor plant startup drove
every line of it.

| Change | Shape | Where |
|---|---|---|
| Deferral as a fact | `checks.result` += `deferred`; `checks.deferred_to_phase` | M4.1 |
| Process-plant phases | phase enum += `wet_commissioning`, `process_seeding` (additive; **no** per-project phase table) | M4.1 |
| Ball-in-court | `punch_items.assigned_party` revocabulary (**breaking**), `blocks_phase`, `scope_gap` | M4.2 |
| As-left condition | `checks.as_left_condition` | M4.2 |
| Vendor evidence | `service_visits` += `time_on_site`/`time_off_site`, `date_end`, `result`, `open_items`, `phase`, `check`, `continues` (no new collection) | M4.3 |
| Explicit resolution | `check_items.result` += `not_performed`, `deferred`; `check_items.na_reason` required when `na` | M5.1 |
| Typed values | `template_items` += `expected_min`/`expected_max`/`expected_text`/`comparison`, frozen onto `check_items` alongside `value_numeric` — **not** a fifth response type | M5.2 |
| Nameplate | `tags` += `hp`, `voltage`, `full_load_amps`, `phase_count`, `rpm`, `frame`, `nameplate_note` | M5.2 |
| Instrument configuration | new append-only `instrument_settings` (current settings **derived** as the latest unsuperseded record) | M6.1 |
| Signature roles | `checklist_templates.required_signature_roles`, frozen onto `checks`; `signatures.signer_role` += four roles; missing countersignatures **derived** | M6.2 |
| Phase gates | `checklist_templates.gate_for_phase`; a gate is an ordinary system-subject check that **warns, never blocks** | M6.3 |
| Continuation | `checks.continues` — deliberately distinct from `resolves` (abandoned ≠ running as designed) | M6.4 |

Two things about this table are load-bearing. First, **the turnover manifest
additions it implies are hash-affecting**: the vendor report index, the
instrument settings table, the deferred-cell grid, the countersignature QC
block, and the completeness assertion all enter the canonical bytes, so they
must land before the first real package is signed or behind a
`sha256-canon-v2` (ADR 0018, and open-questions #13). Second, the
`punch_items.assigned_party` change is **breaking on a v1-published
collection** and needs the ADR-0003 version bump — which is why the whole track
follows M3's API reconciliation
([DECISIONS D20](docs/DECISIONS.md#d20--the-multi-vendor-startup-track-is-post-10-m4m6)).

### Authentication implementation status

Migrations `1789000019` and `1789000020` implement a selective lockdown:
field-facing reads stay public; check/check-item, punch-flag, and LOTO creation
stay accountless; office setup and lifecycle writes require auth; warranty,
closeout, and service-contact data are auth-gated; self-signup is disabled.

Two gaps are current at the 2026-07-12 snapshot. Most committed office pages do
not yet send the user token the backend now requires, and `segments` was created
after the lockdown with public create/update rules and a remaining `TODO(auth)`.
Do not treat the access matrix as production-verified until those are
reconciled and exercised end to end. Details:
[`docs/current-state.md`](docs/current-state.md).

## 3. Derived status, never stored status

There is **no `status` column on a tag or a system.** Status is always computed:

- A **tag's** checkout standing = a fold over its `checks` per phase, same
  rule as a service's (any pass wins — a passing re-test clears an earlier
  fail, and the fail stays in the ledger; else any fail; else any record =
  incomplete; else not started), evaluated against its required phases (the
  phases that have a template for its tag_type, minus any the tag marks N/A in
  `phases_na` — derived, see §9 and ADR 0009). Built on
  the tag page (`tag.html`, Phase 2b): the standing plate, the check-history
  ledger, the printable `check_view.html`, and a free CSV export of the
  tag's whole record. A regression after a pass is a new punch item, not a
  downgrade of whether the phase was ever accepted.
- A **system's** readiness = its open `punch_items` grouped by severity, plus
  its tags' checks, plus the system's own checks (tag-XOR-system subjects,
  ADR 0001). The project home and system pages compute the severity counts
  live on each load (`fields=id,severity,system` keeps the payload tiny).
- A **service's** cutover standing = a fold over its `checks` per phase (any
  pass wins — a passing re-test clears an earlier fail, and the fail stays in
  the ledger; else any fail; else any record = started), evaluated against
  its required phases (the phases that have a `subject_kind='service'`
  template — derived, ADR 0006). The cutover board computes every row live
  from three paged reads.
- A **segment's** acceptance is intended to derive from its required segment
  templates and append-only check ledger, including linked pending/resolution
  pairs. The schema and template inputs exist, but no committed segment page or
  acceptance fold renders this state yet; it is not a shipped workflow.
- A **warranty's** end date and status (active / expires in N days / expired /
  awaiting trigger event) = `clock_start_date + duration_months`, computed at
  render time with day-clamped UTC month arithmetic (ADR 0005). A **claim's**
  open/closed state = whether `closed_at` is set.
- A project's **closeout completion** = accepted `closeout_requirements`
  over total, folded per system on the closeout dashboard.
- A tag's **lockout state** = any `loto_events` apply with no release
  referencing it (ADR 0007). Group LOTO falls out naturally: all active
  locks show, and the tag stays locked out until every one is released.
  Unlike every other derivation, this one is **display-pessimistic**:
  the UI carries the sync timestamp, degrades to an amber stale state
  past 10 minutes, and never renders an affirmative "not locked out" —
  a stale punch list wastes a walk; a stale lock display can hurt
  someone.

This is a deliberate invariant: a stored status can drift out of sync with the
ledger; a derived one cannot. It costs a query; it buys trustworthiness.

**Designed, not built:** ADR 0012 adds a *running* state to the standing fold
(an unresolved `pending` open event) and ADR 0018 adds *deferred* (a signed
deferral whose target phase has no later record). Neither is implemented. With
both, the fold reads: any pass wins → else any fail → else any unresolved
pending = running → else any deferral not yet picked up = deferred → else any
record = incomplete → else not started. That is the **ceiling**: a field UI
cannot render a sixth state legibly, so no state is added without retiring one.
Note that *deferred* and `phases_na` are different facts — `phases_na` means
the phase never applied to this tag, *deferred* means it applies, it is owed,
and it moved. Collapsing them would let owed scope disappear.

## 4. The clean tag URL

QR labels encode `/t/PMP-3101` — a plain, human-readable URL, because the P&ID
tag number is the project's language and a stock phone camera opens plain URLs
with no app. PocketBase serves static files by exact path, so `/t/{tag_number}`
would 404 on its own.

`pb_hooks/main.pb.js` registers `GET /t/{tagNumber}` and serves `tag.html` via
`e.fileFS($os.dirFS(...), "tag.html")`. The address bar keeps the clean URL (no
redirect); `tag.html` reads the tag number back out of `window.location.pathname`
and queries the API. Opening `tag.html?n=PMP-3101` directly also works, as a
fallback.

Services get the same treatment at `/s/{serviceId}` (→ `service.html`), but
keyed by the opaque record id, not the address — addresses are unique only
per project, full of abbreviation drift, and the PII rule keeps
person-identifying data out of URLs and QR codes (ADR 0006). Meter-box QR
labels encode `/s/{id}`; the page displays the address big. There is no
committed clean segment route.

## 5. CSV import — the onboarding moment

`import.html` ingests a real instrument index / equipment schedule and is
deliberately forgiving:

- **A correct CSV parser** (quoted fields, commas/newlines inside quotes,
  escaped `""`, CRLF) — not a naive `split(',')`.
- **Header synonyms** — `Tag No.`, `tag_number`, `TAGNUMBER`, `equipment tag`
  all map to `tag_number` (compared after lowercasing and stripping
  non-alphanumerics). Column order is irrelevant; extra columns are ignored.
- **Loose tag-type matching** — `Pump`, `MOV`, `motor operated valve`, `flow`,
  `mag meter` resolve to the enum; anything unrecognized becomes `other`.
- **Systems created on the fly** — a missing `system_number` is created once and
  its id reused across rows; blank system numbers are allowed.
- **Preview before write**, then a report: tags created, systems created,
  duplicate tag numbers skipped (the unique index rejects them as HTTP 400),
  blank rows skipped, and any errors.

A messy sample lives in `examples/sample_instrument_index.csv`.

`import_services.html` applies the same philosophy to a water main job's
service list (district account export or takeoff): address is the only
required column; station, account/parcel, customer name/phone, meter number,
size, and material map through their own synonym table; duplicates —
`(project, address, station)` unique index — are counted as skipped, so
re-imports are safe.

## 6. Frontend conventions

- One shared stylesheet, `pb_public/app.css` (design tokens + components), so
  every page stays consistent without duplicating CSS and without a build step.
- **Check execution (`check.html`)** writes the ledger with a deliberate
  shape: the overall result is **derived, never picked** (any fail → fail;
  any required line unanswered → incomplete; else pass — an incomplete run
  is a legitimate record of a crew getting pulled off). Every line is
  written, answered or not, so the record shows what was skipped. Writes go
  check → items → photos, in that order — a mid-sequence failure leaves a
  visible partial record, never a lost check. The template's prompt text,
  `witness_required`, and a human-readable test-equipment note are frozen
  onto the record at submit (ADRs 0001/0002/0004). A failed line offers
  punch-item creation carrying `source_check`; the tag page's close flow
  offers the tag's passing checks as `closing_check`.
- **Reading the ledger back (`tag.html` Phase 2b, `check_view.html`)**: the
  tag page derives its checkout standing per required phase (any pass wins,
  §3) and lists the check history newest-first; each row opens the printable
  single-check record, which renders the frozen prompts/results/photos
  exactly as signed. A free per-tag CSV export folds the whole ledger
  (checks + their frozen line items) client-side — the field tier can always
  get its record back out, never paywalled.
- **Warranty & closeout (ADR 0005)** adds a section to the tag page (derived
  warranty badge, tap-to-call vendor, deliverables, claims) and three project
  views: `closeout.html` (tags × requirement types matrix; advancing a status
  writes the `closeout_log` entry), `warranty.html` (derived expirations,
  soonest first, ≤90 days flagged), and `closeout-package.html` (the
  print-friendly Warranty Log & Closeout Package — the compiled PDF version
  is paid-tier territory, ADR 0003). `import.html` gains a warranties mode
  with the same header-synonym forgiveness, loose basis matching included.
- **Readiness matrix (`readiness.html`)** is the turnover output spec
  (forms-library review §3): a per-project, read-only, print-friendly grid
  with one row per tag folding **both worlds** the owner reads together —
  the checkout phases (from the check ledger, any-pass-wins, phases the tag
  marks N/A via `phases_na` shown as such, phases the type has no template
  for as `—`) and the closeout deliverables (from the closeout module) — with
  a **completion date** in each cell (what a schedule and the binder consume).
  A pure presentation join: no schema, every cell derived at render from
  records other pages already write. This is the free deliverable; the
  compiled, hyperlinked PDF binder is the paid sidecar (ADR 0003).
- **Punch list (`punchlist.html`)** answers the second of the three questions
  as a listing rather than a counter. `system.html` and `project.html` show
  open A/B/C **counts**; this is the report behind them — every item grouped
  A → B → C in the fixed color language, with description, subject, assigned
  party, who flagged it, and (optionally) the closed items too. Scope comes
  from the query string: `?project=` for the whole job, `?system=` for one
  system. Like the readiness matrix it is a pure presentation view — no
  schema, no stored status, derived live from `punch_items` at render, with
  the as-of time printed on the sheet. A punch item can hang off a tag, a
  system, a service, a segment, or the project alone, and all five render, so
  a project-scope report never silently drops records; the service subject is
  expanded for `address` only, never a customer field (the PII rule). Print
  CSS makes the walkdown sheet the free deliverable and a client-side CSV
  exports the same roll-up — a compiled, branded punch report would be
  sidecar work (ADR 0003).
- **Service cutover (ADR 0006)** reuses the engine end to end: `service.html`
  mirrors the tag page (derived phase strip, check ledger, punch flow);
  `check.html` takes `?service=` and offers the `subject_kind='service'`
  templates; `cutover.html` is the per-project board — every service by
  station, phase chips derived live, filters for stuck-phase / open-punch /
  "noticed but not tied over > N days," print CSS for the free deliverable
  (the compiled district-facing Cutover Status Report is paid-tier, ADR
  0003); `notice_batch.html` logs a block's 48-hour notices in one pass,
  each with its own door-hanger photo, written as full normal checks with
  per-row retry so a dead spot loses nothing. Public service pages fetch
  with `fields=` lists that exclude customer PII (CLAUDE.md rule).
- **LOTO (ADR 0007)** renders its banner **above everything else** on the
  tag page — above the header, above the equipment identity. Apply demands
  the photo before submit; release demands picking which lock, and a
  releaser name that differs from the holder's demands the note (mirroring
  the server rule). Writes queue in a small `localStorage` outbox when
  offline and sync on reconnection — queued events render in the banner
  marked "not yet synced", never silently missing. `loto.html` is the
  project board: active locks by system, oldest first, lock age visible
  (age ≥ 7 days flags amber — the forgotten-lock early warning).
- **Rotation & VFD (ADR 0008)** is a specialized capture UI on the ordinary
  ledger. `rotation_check.html` is a glove-sized page whose **live** guidance
  is the point: as the tech taps Hand and Auto direction, it derives and
  shows the reading — pass, hardware fault (both reverse → swap leads, LOTO
  first), or software conflict (mismatch → **do NOT swap leads**, fix the VFD
  parameter) — before any wiring is disturbed. The template variant is picked
  by the tag's `has_vfd` flag (offered from `tag.html` for pumps and motors);
  the record is a standard append-only check, direction stored as the two
  frozen `value` lines. `rotation.html` is the per-project board: every
  rotating tag by system, chipped by its latest check's derived reading, with
  the VFD parameters, print-friendly and CSV-exportable (free tier).
- **Instrument calibration (ADR 0016)** has three free surfaces:
  `calibration.html` is the phone capture form with five-point flow and
  three-point level/pressure defaults plus a durable `localStorage` outbox;
  `standards.html` maintains the certificate registry and highlights the fixed
  14-day window; `calibrations.html` sorts a project's instruments by derived
  next due, overdue first. The tag page carries the derived 30-day badge and
  renders the complete as-found/as-left history.
- Each page is an Alpine component; only `labels.html` loads the QR library, so
  every page stays well under the ~50 KB JS budget.
- The field tech's name is remembered in `localStorage` (`lc_name`) so it is
  typed once per phone.
- Severity has a fixed color language everywhere: A red, B amber, C grey.

## 7. Decisions explicitly rejected

- **A stored `status` field on tags/systems.** Rejected — it drifts from the
  ledger. Status is derived. (Hard constraint #4.)
- **A forms designer / conditional checklists.** Rejected — templates are flat
  ordered line items. Branching logic is out of scope forever. (Constraint #5.)
- **A file field on each collection for photos.** Rejected in favor of one
  polymorphic `attachments` collection, so future phases attach evidence to
  checks and tags with no migration.
- **Editing/deleting checks to "fix" them.** Rejected — checks are append-only;
  a correction is a new check. This is the whole value proposition of the
  turnover deliverable. (Constraint #2.)
- **A redirect for `/t/{tag}` → `/tag.html?n=`.** Rejected — a redirect loses the
  clean URL from the address bar and adds a round-trip on a slow connection. The
  hook serves the file in place instead.
- **Global tag-number uniqueness.** Rejected — real programs run multiple plants
  that reuse tag numbers. Uniqueness is per project.
- **Building shutdown/compliance collections now.** Rejected as building ahead
  *while Phases 1–3 were the work*. The domain content lived in `seed/` so it
  was not lost. **Superseded for the shutdown half on 2026-09-07**: Phase 4 / M2
  arrived, ADR 0019 was accepted, and migration S created the seven shutdown
  collections (task `100`). The compliance half still stands — the Phase 5
  templates remain data with no execution UI.
- **Anything that makes the shutdown module part of the go/no-go decision.**
  Rejected permanently (ADR 0019, the LOTO doctrine of ADR 0007 applied to the
  second module that could plausibly claim authority): no interlocks, no
  permission-to-proceed, no "safe to cut" indicator, no green all-clear, and no
  rule that blocks logging past an unsatisfied hold point. A hold point warns
  and enters the derived standing; it never stands in the doorway at 2 AM when
  the authorizer is unreachable. The app records; the written energy-control
  procedure and the people on site authorize. The app must never be usable as
  evidence that it is safe to cut a live main.
- **A `status` or `current_step` column on `shutdowns`.** Rejected — hard
  constraint #4. A step's state is its latest event, a shutdown's standing is a
  fold over its events, and schedule variance is computed at render.
- **Seeding the shutdown runbook as flat checklist templates.** Rejected — a
  flattened copy loses the offsets, hold points, and roles, and would diverge
  from the real runbook in `seed/`. One representation, loaded when Phase 4
  can hold it.
- **A stored required-phases-per-tag_type map.** Rejected — the map is exactly
  "which phases have a template for this tag_type," so it is derived from the
  template library. A separate copy would be one more thing to drift. (The
  same derivation now serves services: their required phases are the phases
  with a `subject_kind='service'` template. Per-tag exceptions ride
  `tags.phases_na`, a small subtraction *on* the derivation — ADR 0009 — not a
  stored map that replaces it.)
- **A line-level `N/A` for a phase that doesn't apply to a tag.** Rejected
  (ADR 0009) — wrong grain: when a whole phase doesn't apply there is no check
  to run and no line to mark; `tags.phases_na` excludes the phase from the
  derived required set instead. A `select` field bound to the phase enum, and
  a positive "applicable phases" list, were both rejected in that ADR too (the
  first couples `tags` to the enum and imports poorly; the second inverts the
  safe default so every tag would need data entry to avoid under-requiring).
- **A polymorphic `subjects` table** for check subjects. Rejected (ADR 0006) —
  PocketBase relations cannot span collections, so `subject_id` would be an
  untyped text id: no referential integrity, no `expand`, every query joining
  through a second hop. One nullable relation per subject kind plus the
  exactly-one createRule keeps real foreign keys and stays boring to extend.
- **Forking the checklist engine per subject kind.** Rejected — one ledger,
  one immutability enforcement, one frozen-copy pattern, one future PDF
  engine. A service check and an equipment check are the same record shape.
- **Storing the derived warranty end date.** Rejected (ADR 0005) — it drifts
  from its inputs, and it erases exactly the provenance (basis + trigger
  date) a warranty dispute is about. Same invariant as tag status.
- **A mutable status-log text field on closeout requirements.** Rejected in
  favor of the append-only `closeout_log` collection — a text field any
  client can rewrite is not a trail.
- **A TrenchNote integration for spare-parts locations.** Rejected —
  `storage_location` is free text; a TrenchNote reference goes there as
  text. The wall between the products stays up.
- **The app as part of energy-control decisions.** Rejected permanently
  (ADR 0007): no interlocks, no permissions to release, no "safe to work"
  indicators, no green all-clear state. LOTO in LoopCheck is a visibility
  layer; the physical locks and the written energy-control procedure are
  the only authority, and the app must never be usable as evidence that
  equipment is safe to touch. Feature requests in this direction get a no.
- **A confident "not locked out" display.** Rejected (ADR 0007) — absence
  of lock records is a statement about the ledger, not about the plant.
  The strongest claim the UI makes is "No locks recorded as of {time},"
  with the verify-physically line, degrading to amber when stale.
- **LOTO photos via the polymorphic `attachments` two-step.** Rejected
  (ADR 0007) — non-atomic on an append-only record whose photo is
  required, and unenforceable server-side. The apply carries its own
  required file field.
- **npm / a framework / a bundler / a CDN.** Rejected by the no-build,
  runs-on-a-Pi, works-with-no-internet constraints. (Constraint #3.)
- **A `conflict` value in `checks.result`, or a dedicated `rotation_checks`
  collection** (ADR 0008). Rejected — a rotation check is an ordinary check;
  both the hardware fault (reverse in both modes) and the software conflict
  (reverse in one mode) store `fail`, since both block startup, and the
  hardware-vs-software reading is derived from the two direction values
  frozen in `check_items`. A fourth enum value duplicates derived truth and
  bumps the API contract; a separate collection forks the ledger.
- **Instrument calibration as ordinary checklist items** (ADR 0016). Rejected —
  splitting expected/as-found/as-left into separate flat lines loses their
  pairing and expands the deliberately small response model.
- **Blocking capture when a standard is expired.** Rejected — the record of
  what happened is better than silence. The server freezes the red flag.
- **Stored `next_due` or calibration status.** Rejected — both derive from the
  latest append-only calibration, its interval, and today's date.
- **Vendor scheduling, service contracts, or billing.** Rejected (ADR 0017) —
  LoopCheck records that a representative visited and preserves the report.
  Planning trips, administering vendor agreements, and reconciling invoices
  are separate systems and would blur the module's evidence-only boundary.

The following are rejected by [ADR 0018](docs/adr/0018-multi-vendor-startup-evidence-model.md)
(*proposed*) — recorded here so the alternatives are not re-proposed as new,
with the caveat that the ADR itself is not yet Accepted:

- **A per-project `phases` collection.** Rejected — a stored map that drifts
  from the template library, which is the same thing already rejected above
  for required-phases. A project configures its phases by configuring its
  template library; the shared enum grows additively.
- **Vendor-facing accounts, portals, or integrations.** Rejected — vendor
  service techs will always use their own paper or PDF forms. That is a
  premise, not an adoption problem. LoopCheck is the GC's master ledger that
  *indexes* the vendor's record and captures the few structured facts a
  dispute turns on.
- **Blocking check submission until every line is answered.** Rejected — it
  breaks the field tier for a crew that gets pulled off and converts a
  recoverable partial record into no record. Ambiguity is legal at capture and
  illegal at signature/freeze instead (DECISIONS D22).
- **A fifth response type for measured values.** Rejected — constraint #5.
  Acceptance limits are template *metadata* on the existing `value` type, and
  they freeze onto the check item so a later template edit cannot retroactively
  change whether a reading passed.
- **Replacing `check_items.value` with a numeric field, or storing a value
  line's derived pass/fail.** Rejected — "480/478/481 V" and "3.2 mils TIR" are
  real readings a number cannot hold, so the text stays the record and the
  numeric is a companion; and the verdict derives from the reading against the
  frozen limit, like every other status.
- **Instrument configuration inside `calibrations`, or as checklist lines.**
  Rejected — "what is it set to" and "does it read true" are different facts on
  different cadences. A separate append-only `instrument_settings` ledger, with
  current settings derived as the latest unsuperseded record and no stored
  "current" flag.
- **A unique index on `tags.serial_number`.** Rejected — blank serials are the
  norm and a duplicate serial is a finding to surface, not a write to reject.
- **One relation serving both `resolves` and `continues`.** Rejected — it would
  make "running as designed" and "abandoned mid-run" the same shape in the
  standing fold, the same error `pending`-vs-`incomplete` already avoided.
- **Hard-blocking a phase on an unsatisfied entry gate.** Rejected — ADR 0007's
  record-never-authorize principle applied outside safety. An unsatisfied gate
  warns prominently; a crew that runs the phase anyway has made a decision, and
  the ledger records visibly that they did.
- **A second per-tag-per-phase rollup page.** Rejected — `readiness.html` is
  that page; a parallel matrix is drift by construction.

## 8. Reproducing the database

`scripts/setup.sh` downloads the right PocketBase binary. On first
`./pocketbase serve`, every migration in `pb_migrations/` applies in filename
order, creating all twenty-four committed application collections and loading 49
checklist templates (352 line items) from the six `*templates.json` files in
`seed/` (see section 9). `migrate down` rolls each back,
including the seed (it deletes exactly the templates it loaded, by
`template_key`; `template_items` cascade with them). `pb_data/` is git-ignored:
it is the operator's data, not source.

`scripts/smoke_test.sh` proves this reproduces end to end and stays coherent
as modules accumulate: it boots a throwaway instance from the committed
migrations, runs the full `seed_demo.sh`, and asserts every collection
exists, each module's demo seed populated (a non-empty count — a probe that
silently skips a whole module is the failure it exists to catch), and the
append-only / close-once rules still hold. Each module is verified in
isolation in its own session; this is the gate for the *combined* stack,
meant to run before a new migration or module lands.

The calibration demo includes an adjusted pass, an overdue instrument, and a
record whose standard was expired at use; the smoke test also proves that both
calibration headers and point rows reject updates.

## 9. The `seed/` library — single source of the domain content

Decision record: [ADR 0001](docs/adr/0001-seed-reconciliation-and-check-subjects.md).

`seed/` holds the maintainer-authored domain template library as JSON
(checkout templates, compliance logs, service cutover templates, tie-in
shutdown runbook — schema in `seed/README.md`). Seed migrations are **loaders,
not copies**: the initial and later service, rotation, training, segment, and
tank loaders read the six `*templates.json` files at migration time and hold no
checklist content of their own, so the library exists in exactly one place.
Later loaders follow the enum-opening migration they depend on and skip existing
`template_key`s where an earlier fresh-database loader already saw the same
source file.
Editing the library = edit `seed/`, reset the database (pre-release
workflow).

The checkout library also carries **mechanical acceptance** forms — the
Uncoupled Motor Run Test (`pump_centrifugal`/`motor`, at `energization`) and the
Mechanical Alignment Report (`pump_centrifugal`, at `installation`), plus a
gate seat-leakage line on the MOV energization template. These are additional
templates at phases their tag_types **already own**, so the derived
required-phases map is unchanged — the same way the rotation pair shares
`energization`. They are the first templates to populate `template_items.
spec_reference` (the governing standard or equipment-spec criterion for spec-governed
lines); to let the seed loader set it, `spec_reference` is created with
`template_items` (`1789000004`) rather than by Migration A (ADR 0002).

The **Tank Leak Test** (`seed/tank_templates.json`, loaded by `1789000028`
after migration `1789000027_N` adds the `tank` tag_type and `leak_test` phase)
is the first *production-seed* **open→resolve** form (ADR 0012): a tank/basin is
an ordinary tag whose 48-hr leak test is signed at fill with `result: "pending"`
and resolves at 48 hr as a separate check pointing back via `checks.resolves`.
The open→resolve *schema* already shipped (Migration K, `1789000023`); the
open→resolve *execution UI* and the derived **"running"** standing state are not
built yet — a gap shared with the already-seeded bac-t collection template, to be
built once for both.

Mechanics worth knowing:

- The loader resolves `seed/` via `__hooks + "/../seed/"` — `__hooks` (the
  absolute path of `pb_hooks/`) is defined inside migrations too, so the read
  works no matter which directory the binary was launched from.
- The JSON's camelCase phases (`pointToPoint`) are mechanically converted to
  the schema's snake_case (`point_to_point`) on load. `template_key`
  (`"pump_centrifugal.loopCheck"`) is stored **verbatim** — it is an opaque
  identifier, never parsed.
- `template_key` has a **partial unique index** (`WHERE template_key != ''`):
  seeded templates can't collide, while user-created templates may all leave
  it blank.
- A tag's **required phases are derived, not stored**: the phases that have a
  template for its tag_type, **minus any listed in `tags.phases_na`**
  (ADR 0009 — a per-tag applicability input for phases that legitimately don't
  apply to one specific tag). Verified equal to the map in `seed/README.md`
  for tags with no exceptions — same principle as section 3, one less thing to
  drift. A service's required phases derive identically from the
  `subject_kind='service'` templates (ADR 0006).
- `recurrence` blank = a one-time checkout checklist; `daily` / `per_shift` /
  `per_event` are the compliance cadences (Phase 5).
- **Loaded since 2026-09-07** (migration `1789000036`, task `110`):
  `seed/shutdown_runbook_tie_in.json`. The runbook's structure — time offsets in
  two scales, hold points, contingencies, and a role table with notification
  triggers — cannot survive a flat checklist, which is why it was never
  flattened into `checklist_templates` and why this file sat captured-but-
  unloaded from Phase 1 until Phase 4. Migrations S and T built collections that
  hold all of it, so the condition this note set ("one representation, loaded
  when Phase 4 can hold it") is met. It loads as 1 template, 22 steps
  (8 pre-window / 12 window / 2 post-window), 4 contingencies, and 6 template
  roles, and the loader synthesizes neither offset form.

*(Resolved 2026-07-09 — this section previously documented a schema divergence
between the migration seed and `seed/`; the migrations were reconciled to the
seed schema: four response types, `unit`, `confirm_per_spec`, finer tag_type
names, `template_key`, `subject_kind`.)*

## 10. The core/premium boundary

LoopCheck is open-core. Premium (office deliverables: turnover compiler,
risk alerts, dashboards) is a **sidecar in a separate private repo** that
talks to the core's public REST API like any third party — no private
doors, no in-process hooks, read-only in v1. The original sixteen collections
were published as API contract v1 ([docs/API.md](docs/API.md)); the committed
schema now has twenty-four, so **eight are marked *delta*** pending a version
bump. The PII/auth semantics are settled (ADR 0011, Accepted); the collection-set
version bump is deliberately sequenced to M3. Breaking changes still need an ADR
and a contract version bump. Full decision and the
alternatives rejected (PocketBase hook layer, shared database):
[ADR 0003](docs/adr/0003-core-premium-sidecar-boundary.md). External
contributions require a future CLA/DCO ([CONTRIBUTING.md](CONTRIBUTING.md)).
