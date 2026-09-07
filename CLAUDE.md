# CLAUDE.md — LoopCheck

Project context for Claude Code sessions. Read this first, every session.

## What LoopCheck is

An open-source **startup & commissioning checkout tracker** for heavy civil /
water / wastewater construction. Built by a project engineer at a
water/wastewater general contractor. Sibling product to
[TrenchNote](https://github.com/levelbookdev/trenchnote) — same philosophy,
same architecture (PocketBase + static HTML + Alpine.js, no build step), new
problem domain.

Every piece of equipment in a treatment plant already has a P&ID tag number
(PMP-3101, FIT-2205, MOV-4410). LoopCheck puts a QR code on that tag; scanning
it shows exactly where that equipment stands in the checkout process and lets
the person standing in front of it log the next check or flag a punch item.

LoopCheck answers three questions and refuses to be anything else:

1. What checks has this equipment passed, and what remains before startup?
2. What punch items are blocking this system?
3. Can we prove it — to the engineer of record, the owner, or a dispute — with
   signed, timestamped, immutable records?

## Hard constraints — these are load-bearing walls

Weigh every design decision against these. If a change violates one, stop and
raise it rather than proceeding.

1. **No-install field tier.** A laborer with a stock camera app on a cheap
   Android must be able to scan a QR code, see equipment status, and flag a
   punch item. No app store, no account, no training.
2. **Append-only records.** Checks and (later) executed shutdown steps are
   NEVER edited or deleted after completion/signoff. Corrections are new
   records. This immutability is what makes turnover deliverables trustworthy.
   Enforced in the schema: `checks` and `check_items` have `updateRule: null`
   and `deleteRule: null`.
   Note (design input carried to MainLine's future segment module, not built
   here): bac-t samples introduce the one record type
   whose result is pending an external party (the lab). Design the
   checks/results model so a record can be signed at collection time and
   later receive an externally-attached result without mutating the
   original — a lab result is an appended event, not an edit. A failed
   sample loops back to re-flush/re-chlorinate as new records; the failure
   stays in the ledger.
3. **No build step.** Static HTML + Alpine.js + PocketBase JS SDK. No npm
   frameworks, no bundlers. Page-weight budget ~50 KB of JS. Must run well on a
   Raspberry Pi server and a $40 Android client. Vendor all libs into
   `pb_public/vendor/` — no runtime CDN.
4. **Derived status, never stored status.** A tag's checkout status is computed
   from its check ledger. A system's readiness is computed from its tags and
   open A-punch items. No status fields that can drift out of sync.
5. **No forms designer.** Checklist templates are simple ordered line items
   with exactly four response types: pass/fail/N/A, value (+ unit), text,
   photo_required. No conditional logic, no branching, no drag-and-drop
   builder. The moment a template needs an if-statement, it's two templates.
6. **Tag numbers are the project's language.** The P&ID tag number is the
   human-facing ID everywhere. QR codes encode plain URLs: `/t/{tag_number}`.
7. **License: AGPLv3.** Field execution is free forever; office deliverables
   (PDF generation, notifications, dashboards) are the future paid tier. Never
   cripple the field tier. CSV import stays in the free tier — it is the
   onboarding moment.

## Locked tech stack

Do not change these without explicit approval from the maintainer.

- **Backend: PocketBase** — single Go binary with embedded SQLite. Built-in
  auth, REST API, admin UI. Downloaded by `scripts/setup.sh`, not committed.
  Developed against **PocketBase 0.39.x**.
- **Frontend: vanilla HTML/CSS + Alpine.js**, served from `pb_public/`. Shared
  styles in `pb_public/app.css`. Alpine and qrcodejs vendored in
  `pb_public/vendor/`.
- **Clean tag URL** `/t/{tag_number}` is served by a `pb_hooks` route
  (`pb_hooks/main.pb.js`) that returns `tag.html`; the page reads the tag
  number back out of the path.

## Data model

Full schema and rationale live in [ARCHITECTURE.md](ARCHITECTURE.md). Schema is
defined as versioned PocketBase JS migrations in `pb_migrations/`, NOT
hand-built in the admin UI — a fresh operator reproduces the whole database
from the repo, and the seed migration loads the domain checklist library
automatically.

**Phase 1 (built):** projects, systems, tags, checklist_templates,
template_items, checks + check_items (schema only, append-only), punch_items,
attachments. UI: CSV import, tag page, system page, project home, QR labels.

**Phase 2 (built):** check execution (`check.html`: derived results, frozen
template/equipment copies, punch evidence links) plus the read-back — the
tag page shows **derived checkout standing** (per required phase, any pass
wins — same rule as service cutover standing, one model across every subject
kind) and the **check history** ledger; `check_view.html` is the printable
single-check
record (frozen prompts, results, photos); and the tag's whole ledger
**exports free as CSV**. The core promise is closed: log a check, see what's
passed and what remains, prove it.
**Warranty & Closeout module (built, ADR 0005):** `warranties`,
`closeout_requirements`, `closeout_log` (append-only), `warranty_claims`
(close-once: updatable while open, frozen server-side once `closed_at` is
set). Warranty end dates are **derived** from `basis` + `clock_start_date` +
`duration_months`, never stored — the basis and trigger date are the
provenance warranty disputes turn on; a blank `clock_start_date` is the
valid "trigger event hasn't happened yet" state. UI: tag-page section,
`closeout.html`, `warranty.html`, `closeout-package.html` (free print view;
the compiled PDF is paid-tier), and a warranties CSV import mode. Expiry
alerts are future hosted-tier — core stores facts, not alerts.

**Service Cutover Tracker (built, ADR 0006):** `services` is the first
non-equipment check subject — one nullable `service` relation on `checks`
and `punch_items`, the exactly-one-subject rule extended three ways,
`subject_kind: "service"` templates, and six service phases (notice →
locate_pothole → new_service → meter → tie_over → restoration) appended to
the shared phase enum. Required phases and cutover standing are **derived**,
like everything else. UI: `/s/{id}` service page, `cutover.html` board
(print-friendly = the free deliverable; the compiled district-facing
Cutover Status Report and customer-notification automation are paid-tier),
`import_services.html`, `notice_batch.html` (walk-the-block door-hanger
photo logging), optional meter-box QR labels. This generalization was the
deliberate pilot for Phase 5 locations and the (since-landed) segment subject
kind — a fourth subject kind proved boring to add. (Segment acceptance itself
moved out of LoopCheck; it now belongs to MainLine as a future module — see
Phase 6 below.)

**PII rule:** `services.customer_name` and `services.customer_phone` are
visible only to authenticated users, never on any page reachable without
sign-in, and never encoded in QR codes or URLs. The address is the public
identifier; the person is not. Concretely: every fetch on a public page
uses a `fields=` list that excludes both columns, and the `/s/` URL keys on
the record id, not the address. The auth lockdown ADR must add mechanical
field-level enforcement (collection rules can't hide fields) — see
ADR 0006.

**LOTO Status Board (built, ADR 0007):** `loto_events`, append-only, same
immutability enforcement as `checks`. A tag is LOCKED OUT if any `apply`
event has no `release` referencing it (`applies_to` self-relation) —
derived, never stored; group LOTO (multiple simultaneous locks) is normal
and the tag shows ALL active locks until every one is released. The photo
of the hung lock is a **required file field on the apply event itself**
(one atomic multipart POST, enforced by the createRule — not a polymorphic
attachment). Releasing a lock whose holder differs from the releaser's
name requires `released_by_note`, also server-enforced. UI: tag-page
banner (above everything else) + apply/release + history, `loto.html`
project board (active locks by system, oldest first, visible lock age).
Free tier permanently — **safety visibility is never paywalled**;
hosted-tier gets only derivations on top (lock-age digests, cross-project
boards).

### LOTO safety framing — non-negotiable

- This is a visibility layer, NOT a LOTO program. Physical locks, tags,
  and the written energy-control procedure remain the only authority. The
  app records; it never authorizes.
- The app must never be usable as evidence that equipment is safe to
  touch. Every LOTO status display carries the data-freshness timestamp
  and the line "Verify physically before any work." A stale "no locks
  shown" is the dangerous failure mode — design against it explicitly
  (see Offline behavior).
- The app never enforces who may release a lock; real programs have
  strict supervisor-removal procedures that live outside software. The
  app only records who logged the release and why, immutably.
- If a feature request would make the app part of the energy-control
  decision (interlocks, permissions to release, "safe to work"
  indicators), the answer is no. Record this in ARCHITECTURE.md's
  rejected list.

**Offline behavior (ADR 0007) — differs from the rest of the app,
deliberately asymmetric:** queue-and-sync is fine for LOGGING events (an
electrician in a dead zone can still record an apply; it syncs later). But
DISPLAYED status must be honest about staleness: cached data older than
10 minutes shows an unmissable amber "STATUS MAY BE STALE — last synced
{time}. Verify physically." state, never a confident clear presentation.
A tag with no known locks displays "No locks recorded as of {time}" —
never an affirmative "not locked out", never a safety claim. There is no
green state anywhere in the module.

**Signatures & Turnover (built, ADR 0010 — pending formal acceptance):**
two append-only collections — `turnover_packages` (a **frozen snapshot** of a
scope's checkout: manifest + derived standing + `sha256-canon-v1` content hash,
built server-side by `POST /api/turnover/build` so a client can't forge the
manifest; a re-issue supersedes the prior for its scope) and `signatures`
(recorded attestations bound to a package or check by `signed_content_hash` —
**not** qualified e-signatures; require auth per ADR 0011 §7). Freezing a
derived verdict is deliberate and constraint-#4-safe: the live readiness view
still derives; the package stores a copy as evidence. UI: `sign.html`,
`turnover.html` (free print board with supersede/drift marking + ready-to-
witness), and the shared `lc-auth.js` + `login.html`. The compiled PDF binder
stays paid-tier. Signer identity is only as strong as the deployment — every
signing surface says so (LOTO-style honesty).

**Phase 3:** signatures + PDF turnover package.
**Phase 4:** shutdown runbooks (shutdowns, shutdown_steps, roles).
**Phase 5:** recurrence + location subjects (compliance logs).

- **Phase 6 — Segment acceptance records: MOVED TO MainLine (2026-07-18).**
  Pipeline/segment (linear) acceptance is **not LoopCheck's bounded context** —
  maintainer decision, ADR 0014 (superseded). It was briefly scoped to
  LineCheck (2026-07-14); LineCheck is now archived and the scope folds into
  **MainLine as an unscheduled future module**, because MainLine already models
  alignments, stations, and append-only test ledgers with derived acceptance.
  See MainLine's `ROADMAP.md`, "Future module: segment testing & acceptance."
  The schema slice that already shipped (migrations `1789000023`–`1789000025`:
  the open→resolve fields, the `segments` collection + four-way subject XOR,
  segment phases, and the segment seed templates) **stays, frozen at
  maintenance-only** — landed records can't be relabeled, so it is maintained,
  not ripped out. **Do not build the segment execution UI in LoopCheck**
  (page/board/resolve UI/CSV import/acceptance package). There is no migration
  to plan: cross-product record migrations are frozen until there are real
  users. See `docs/overlap-and-migrations.md`, `docs/architecture-status.md`,
  `docs/open-questions.md`. The open→resolve pattern (ADR 0012) itself is
  general-purpose and stays in LoopCheck (e.g. the tank leak test uses it);
  only the segment *application* moved.

**Do not build ahead of the current phase.** The Phase 5 compliance templates
are already loaded as data and the Phase 4 shutdown runbook waits in `seed/`,
so the domain knowledge is captured — but their execution UIs are not built.

Phase 4 UI bar, decided now: the runbook execution view is **zero navigation
taps, glove-sized touch targets** — it will be used at 2 AM, in rain, under
schedule pressure.

## Seed library (`seed/`)

`seed/` holds the **authoritative domain template library**, maintained by the
maintainer (the domain expert): checkout templates, compliance logs, and the
generic tie-in shutdown runbook as JSON, documented in `seed/README.md`. The
seed migration is a **loader, not a copy** — it reads the JSON at migration
time, so the library exists in exactly one place. To change the library: edit
`seed/`, reset the database (pre-release workflow). Things to know:

- Four response types, deliberately only four: `pass_fail_na`, `value`
  (+ `unit`), `text`, `photo_required`.
- **`confirm_per_spec: true`** flags items whose acceptance value is governed
  by the project spec or a referenced standard (megger minimums, chlorine
  residuals, torque values). The template names the check; the project confirms
  the number. Never hardcode a value a spec section overrides — Phase 2 renders
  these with the value blank and a "per Section __" prompt, and
  `seed/README.md`'s open-confirmation list gets resolved before a project
  goes live.
- **A tag's required phases are derived**: the phases that have a template for
  its tag_type. No stored map to drift.
- JSON phases are camelCase; the DB is snake_case; the loader converts.
  `template_key` is stored verbatim (opaque identifier).
- The shutdown runbook JSON is **not** loaded into the DB — flat checklists
  can't hold its offsets/hold points/roles. It waits in `seed/` for Phase 4's
  real shutdown collections.

Severity language (show in UI, fixed colors): **A** = blocks startup (red).
**B** = blocks substantial completion (amber). **C** = cosmetic / does not
block (grey).

## Conventions

- **Git authorship: commits are authored as the maintainer, never as Claude.**
  No `Co-Authored-By` or other AI-attribution trailers (also enforced by
  `.claude/settings.json`). This applies to every session — local, web, or
  cloud.
- **Frontend talks to PocketBase at `window.location.origin`.** Never hardcode a
  host — the same file works on localhost, a plant LAN IP, or a real domain.
- **QR codes encode `{baseUrl}/t/{tag_number}`** at correction level H.
- **Comment the PocketBase API calls** — filter syntax, `expand`, the
  create-then-derive sequences — so the maintainer learns the backend by
  reading the code.
- Design tokens in `app.css`: one action accent (safety orange), system fonts
  for zero webfont bytes, monospace for tag numbers, severity color language.
- **The collections are a published API contract** (`docs/API.md`, ADR 0003).
  Sixteen are published as **v1**; the committed schema now has **31**, the
  extra fifteen marked *delta* pending a contract version bump (an M3 decision).
  Breaking changes to any of their shapes, semantics, or rules need an ADR and a
  contract version bump — not just a migration. Premium is a sidecar on that
  contract; capabilities it needs land in core first.

## Security posture

The auth lockdown is **landed and accepted** ([ADR 0011](docs/adr/0011-auth-lockdown.md),
migrations `1789000019` / `1789000020` / `1789000033`). It is deliberately
**not** a uniform "require auth everywhere" sweep — that would break hard
constraint #1. The current posture:

- **Public, no account** — everything a scanned QR needs: tag/service/segment
  reads, the check ledger, punch visibility, template and equipment data, and
  LOTO safety visibility (never gated, ADR 0007).
- **Public writes, deliberately** — the narrow accountless field paths: logging
  a check (`checks`/`check_items`), flagging a punch item, LOTO apply/release,
  instrument-calibration and service-visit capture, and an attachment whose
  parent is one of those. Free ≠ anonymous elsewhere, but these must never hit
  a wall.
- **Requires an account** — all office/setup/lifecycle writes (projects,
  systems, tags, templates, services, segments, warranties, closeout), punch
  *closure*, turnover build/sign, and all office/PII reads
  (`warranties`, `closeout_*`, `warranty_claims`, `service_contacts`).
- **Superuser only** — every delete, everywhere.
- **Regardless of auth** — the append-only ledgers (`checks`, `check_items`,
  `attachments`, `closeout_log`, `loto_events`, `calibrations`,
  `calibration_points`, `service_visits`, `turnover_packages`, `signatures`)
  reject updates and deletes. No self-signup; accounts are operator-created.

Customer PII (`customer_name`, `customer_phone`) lives **only** in the
auth-gated `service_contacts` — `services` is structurally PII-free, which is
what makes the PII rule enforceable rather than conventional.

The per-collection matrix is in [`docs/API.md`](docs/API.md), and
`scripts/smoke_test.sh` asserts it across guest, user, and superuser tiers.
`TODO(auth)` comments still appearing in `pb_migrations/` are **historical
records of what a migration shipped**, not instructions — the live rule is
whatever the latest migration set establishes.

`docs/` is served publicly by GitHub Pages — nothing sensitive or
premium-related may live in it.

## Definition of done — the docs-as-code rule

Claude acts as Lead Developer AND Technical Writer. A feature, fix, or
architecture change is NOT finished until the docs are updated:

1. **ADRs** — significant structural choices (schema shape, enforcement
   rules, library mechanics) get an ADR in `docs/adr/`, written BEFORE the
   migration that implements them. Document the real rationale.
2. **ARCHITECTURE.md** — update the schema, decisions, and the "rejected ideas"
   list when a structural choice is made; cross-reference the ADR.
3. **README.md** — keep it under two pages; update if setup or features change.
4. **CLAUDE.md** — update these constraints/conventions if they change.
5. **Landing page** — `docs/index.html` is the public face, served by
   GitHub Pages. Update it when user-visible features change or ship,
   and refresh the screenshots in `docs/img/` when the UI they show
   changes. It must stay self-contained: inline CSS, no JavaScript, no
   webfonts, no external requests — the only external links point at
   GitHub.

Docs must stay truthful to the code as shipped — no documenting aspirations as
features. If the code and docs disagree, fixing that mismatch is part of the
task.

## Working style

Work task by task. After each task, stop and show the maintainer for review
before moving on — especially anything touching the data model or the hard
constraints above.

## Roadmap, decisions, and the task queue

The plan lives in three files. Read them before starting work:

- **[docs/ROADMAP.md](docs/ROADMAP.md)** — the vision and the milestone sequence
  (M1 Harden & Reconcile → M2 Shutdown Runbooks + Punch List → M3 Stranger-Ready,
  then post-1.0 modules — including the **M4–M6 multi-vendor startup track**
  designed in [ADR 0018](docs/adr/0018-multi-vendor-startup-evidence-model.md) —
  and a Later/Ideas parking lot). Milestones are named by
  goal and mapped to a semver tag; the first tag is v0.9.0.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — the roadmap/scope/sequencing/cut
  decision log (`D`-numbered). It records *what we chose to build, in what order,
  and what we deliberately are not building*, and cross-links the ADRs. Do not
  relitigate a decision recorded here without new evidence.
- **[docs/tasks/](docs/tasks/)** — one self-contained implementation prompt per
  task, numbered to encode order, each with a `Status:` line
  (`TODO | IN PROGRESS | DONE | BLOCKED (reason)`).

Precedence when docs disagree: **the code is truth** (docs-as-code rule). Among
docs, `CLAUDE.md` holds the constraints, `docs/adr/` holds structural decisions,
`docs/DECISIONS.md` holds scope/sequencing decisions, `docs/ROADMAP.md` holds the
sequence. There is **one** architecture document: the root `ARCHITECTURE.md`
(never create a second one).

### Execution workflow (a normal coding session)

1. **Find the task.** Scan `docs/tasks/` status lines and pick the
   **lowest-numbered task whose `Status:` is not `DONE`**. Respect `BLOCKED`
   reasons — if the lowest is blocked, act on the block or move to the next
   genuinely actionable task; do not silently skip a blocker.
2. **Do exactly that task**, to its acceptance criteria, and **nothing more**.
   Do not exceed its scope or "improve" things it tells you to leave alone.
3. **If the task is ambiguous or conflicts with the code**, stop, describe the
   conflict, and propose a task/roadmap edit — do not improvise around it.
4. **Finish per the docs-as-code rule**: build and tests pass, docs updated,
   then update the task's `Status:` line and tick any `docs/ROADMAP.md`
   milestone checkboxes the task closes out.
5. **Commit** authored as the maintainer (no AI-attribution trailer), with the
   message the task suggests.

### Roadmap-maintenance workflow (when a milestone's tasks are all DONE)

When every task in the current milestone is `DONE`, the next session is a
**planning session, not a coding session**:

1. Re-read `docs/ROADMAP.md` and `docs/DECISIONS.md`.
2. Break the next milestone into new numbered task files in `docs/tasks/` using
   the exact template in `docs/tasks/README.md` (Status line, Context, Scope,
   Specification, Acceptance criteria, Guardrails, Definition of done).
3. Run a short ideation pass over the next milestone (new-feature, cut, and
   integration ideas), **checked against `docs/DECISIONS.md`** so already-rejected
   or parked ideas are not re-proposed as new.
4. **Present the new tasks and ideas to the maintainer for approval before
   writing the build tasks**, and only then resume coding sessions.

Some milestones front-load a **design/ADR task** (e.g. Phase 4's shutdown
runbooks — task `080`) precisely because their build tasks depend on domain
decisions that must be interviewed from the maintainer, not guessed. Write those
build tasks only after the design task's ADR is accepted.

If you discover mid-task that the roadmap itself is wrong or incomplete, **stop,
describe the conflict, and propose a roadmap edit** rather than improvising.
