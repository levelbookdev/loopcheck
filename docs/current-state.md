# LoopCheck current state

Snapshot date: 2026-07-12  
Snapshot commit: `3da73d0` on `main`  
Auth sections revised: 2026-07-20 (ADR 0011 reconciliation) — the
"Authentication and public access", "Tests and quality gates", and "Deployment
status" sections below are current as of that revision; the rest remains at the
original snapshot.

This document is descriptive, not a roadmap. `CURRENT` means directly
confirmed in the committed repository at the snapshot above. Work present only
in the starting worktree is listed under Active development and is not treated
as shipped.

## Product and maturity

**CURRENT.** LoopCheck is a self-hosted startup and commissioning checkout
tracker for water/wastewater and heavy-civil work. Its working center is the
equipment tag: scan `/t/{tag_number}`, read derived checkout and LOTO standing,
append checks or punch items, and retrieve the evidence ledger. It also has
working warranty/closeout, service-cutover, rotation, training-milestone, and
project-readiness surfaces.

**CURRENT.** The repository is pre-release and moving quickly. Several schema
capabilities are ahead of their execution UI, and some primary documents lag
the last migrations. The current checkout and service workflows are substantial
but this snapshot should not be represented as a stable production release.

## Stack and topology

| Concern | Confirmed implementation |
| --- | --- |
| Backend | PocketBase 0.39.x, one Go binary with embedded SQLite; migrations in `pb_migrations/`. |
| Frontend | Static HTML/CSS with Alpine.js; no application build step; vendored browser libraries in `pb_public/vendor/`. |
| Server extension | PocketBase JavaScript hooks in `pb_hooks/`; committed routes serve `/t/{tagNumber}` and `/s/{serviceId}`. |
| Hosting | PocketBase serves the REST API and `pb_public/` from one origin. Documented choices are a LAN host or a VPS behind Caddy/systemd. |
| Persistence | One operator-owned SQLite database plus PocketBase file storage under `pb_data/`; neither is committed. |
| Seed data | Versioned loaders read the authoritative JSON library under `seed/` during migration. |

Evidence: `pb_hooks/main.pb.js`, `scripts/setup.sh`, `docs/DEPLOY.md`, and
`pb_public/vendor/README.md`.

## Entry points and current workflows

| Entry point | Current workflow | Evidence |
| --- | --- | --- |
| `/` | Project list and project creation shell. | `pb_public/index.html` |
| `/t/{tag_number}` | Public tag lookup, LOTO visibility, punch flagging, check history, warranty/closeout summary, and per-tag CSV export. | `pb_hooks/main.pb.js`, `pb_public/tag.html` |
| `/s/{serviceId}` | Public service identity, cutover phase standing, punch items, and check history. | `pb_hooks/main.pb.js`, `pb_public/service.html` |
| Static project/system pages | Project navigation and system readiness/punch views. | `pb_public/project.html`, `pb_public/system.html` |
| Check pages | Execute a tag/system/service checklist and print one frozen check record. | `pb_public/check.html`, `pb_public/check_view.html` |
| Import and labels | Equipment, warranty, and service CSV import; tag and optional service QR labels. | `pb_public/import.html`, `pb_public/import_services.html`, `pb_public/labels.html` |
| Boards | Readiness matrix, rotation board, cutover board, LOTO board, closeout dashboard, and warranty timeline. | `pb_public/readiness.html`, `rotation.html`, `cutover.html`, `loto.html`, `closeout.html`, `warranty.html` |
| Print views | Single check, readiness, rotation, cutover, closeout package, and QR labels rely on browser printing. | Corresponding files in `pb_public/` |

There is no committed segment page, segment import, segment board, or clean
segment route. There is also no committed execution flow for resolving an
open check. The `segments` collection, segment templates, `checks.result =
pending`, `checks.resolves`, tank type, and tank leak-test template are
therefore **CURRENT schema/library capabilities without a complete user
workflow**. See migrations `1789000023`, `1789000024`, `1789000025`,
`1789000027`, and `1789000028`.

## Current collections

**CURRENT (revised 2026-09-07).** A fresh database from committed migrations
contains **32 application collections**, excluding PocketBase system/auth
collections (`users` is the auth collection and is additional):

- Project/equipment: `projects`, `systems`, `tags`, `segments`
- Templates: `checklist_templates`, `template_items`
- Evidence and execution: `checks`, `check_items`, `punch_items`,
  `test_equipment`, `attachments`, `loto_events`
- Service cutover and protected PII: `services`, `service_contacts`
- Warranty and closeout: `warranties`, `closeout_requirements`,
  `closeout_log`, `warranty_claims`
- Instrument calibration: `test_standards`, `calibrations`,
  `calibration_points`
- Vendor service visits: `service_visits`
- Signatures and turnover: `turnover_packages`, `signatures`
- Shutdown runbooks (ADR 0019, schema + seeded library, no UI yet):
  `shutdown_templates`, `shutdown_template_steps`, `shutdown_contingencies`,
  `shutdown_template_roles`, `shutdown_roles`, `shutdowns`, `shutdown_steps`,
  `shutdown_step_events`. The tie-in runbook is loaded (migration `1789000036`);
  the execution UI is tasks `120`–`140`.

The authoritative schema is the ordered migration set in `pb_migrations/`; the
count above is verifiable with `grep -c "new Collection(" pb_migrations/*.js`.
Of these, **16 are published as API contract v1 and 16 are marked delta**
pending a version bump — that bump is a deliberate M3 decision, not an
oversight. See [`API.md`](API.md).

## Authoritative facts, derived states, and mutability

**CURRENT.** `checks`, `check_items`, `attachments`, `closeout_log`, and
`loto_events` reject client update and delete. They are evidence ledgers.
Corrections are additional records. A check can also resolve an earlier open
check through `checks.resolves`; it does not mutate the open record.

**CURRENT.** Tag checkout standing, service cutover standing, rotation
interpretation, active LOTO, warranty end dates, and readiness views are
derived in browser code from stored facts. `closeout_requirements.status`,
open `warranty_claims`, and open `punch_items` are intentionally mutable
lifecycle records. Closed warranty claims are frozen by their API rule.

The complete entity-by-entity description is in
[`domain-model.md`](domain-model.md); stable rules are separated in
[`invariants.md`](invariants.md).

## Authentication and public access

**CURRENT (revised 2026-07-20).** Migrations `1789000019`, `1789000020`, and
`1789000033` landed the non-uniform authentication lockdown, the structural PII
split, and the closing `segments` rule. ADR 0011 is **Accepted**; the frontend
is reconciled with the rules.

- Public reads remain for field-facing collections needed by tag/service
  scans, checks, punch visibility, and LOTO visibility.
- Accountless creation remains for checks/check items, punch flags, LOTO
  events, and instrument-calibration/service-visit capture; attachment creation
  is conditional on its parent or authentication.
- Project/setup/template/service/segment writes and punch closure require an
  authenticated user.
- Warranty, closeout, and `service_contacts` reads/writes require auth.
- `service_contacts` is the only home of customer name and phone; `services`
  no longer contains those fields, and a guest cannot reach them through the
  back-relation expand.
- Public user self-signup is disabled.

The two limitations recorded at the original snapshot are **both resolved**:

1. The office pages now authenticate through the shared `lc-auth.js` helper —
   hard-gated (redirect on load) for pure office pages, soft-gated (public
   render, gated action) for the field-facing pages that must survive an
   accountless scan. Project creation, CSV imports, punch closure, and
   warranty/closeout operations all attach the token and handle expiry.
2. `segments` create/update now require auth (migration `1789000033`); reads
   stay public like `tags`. No collection carries a public write rule outside
   the deliberate accountless field paths.

## Offline behavior

**CURRENT.** LoopCheck is not generally offline-first, and this is a deliberate
choice, not a gap awaiting a fix ([DECISIONS.md D13](DECISIONS.md#d13--offline-document-guarantees-now-build-no-second-queue)):
a half-built offline layer is more dangerous than honest labeling, and a general
durable queue needs an idempotency decision first. There is no committed service
worker, application-shell cache, or IndexedDB data layer.

Per-workflow guarantees — this is the honest list:

| Workflow | Offline guarantee |
| --- | --- |
| LOTO apply/release (`tag.html`) | **Durable.** Caches the last successful read in `localStorage`, queues events (with photos where storage permits), retries later, and shows a stale-data warning after ten minutes. Never presents a confident status it cannot verify (ADR 0007). |
| Instrument calibration capture (`calibration.html`) | **Durable.** A `localStorage` outbox retried on reconnect; the capture route is idempotent via `client_token`. |
| Batch notice logging (`notice_batch.html`) | **Tab-local only.** Keeps progress and supports per-row retry, but does not survive closing the tab. |
| Everything else | **Online required.** Check logging, punch flagging, imports, boards, and all office pages need connectivity. |

The two durable outboxes are per-page `localStorage`, not a shared queue — the
sibling products' IndexedDB/FIFO guarantees do not apply here, so each page is
audited on its own.

## Import and export behavior

**CURRENT.** Equipment/warranty and service imports parse CSV in the browser
and write through PocketBase REST. There is no committed segment import.

**CURRENT.** Free retrieval includes a per-tag check-ledger CSV and a
project rotation CSV. Other current deliverables are print-friendly HTML that
can be printed or saved as PDF by the browser. There is no committed server PDF
renderer and no committed versioned cross-product handoff manifest.

## Tests and quality gates

**CURRENT.** `scripts/smoke_test.sh` is the only committed automated test
suite. It boots a throwaway PocketBase database, applies migrations, runs the
demo seed through REST, tests selected collection/rule invariants, verifies
PII/auth boundaries, and checks the `/t/` and `/s/` routes. It asserts the
ADR 0011 access matrix across all three tiers — guest denial,
authenticated-user reads/writes, the user-vs-superuser delete boundary,
segment-create in both directions, and the field-level PII back-relation
expand. As of the 2026-09-07 revision it also covers all 32 collections in the
existence loop, the shutdown planning/execution auth asymmetry and its
append-only event shape rules (ADR 0019), the tank leak-test seed, the ADR 0012 open→resolve pair
(asserting the open record is **not** mutated by its resolution), and the
newer collections' contract rules — capture-route-only creates for
`calibrations`/`calibration_points`, the auth boundary on `test_standards`, and
the accountless-but-shape-ruled `service_visits` create.
**94 assertions total**, a count the script header also records.
`.githooks/pre-push` runs it when the binary is present.

Known coverage gaps at this snapshot:

- there are no unit, browser, accessibility, documentation, or link tests.

There is no committed CI configuration or environment template. Runtime setup
is script- and documentation-driven.

## Deployment status and limitations

**CURRENT.** Topology support labels ([DECISIONS.md D14](DECISIONS.md#d14--deployment-topology-labeling)):

| Topology | Label |
| --- | --- |
| Single LAN host | **Supported** — documented in `docs/DEPLOY.md`. |
| Single internet-facing VPS (Caddy + systemd) | **Supported** — documented, and no longer blocked by the auth reconciliation. |
| Raspberry Pi | **Unvalidated.** Hard constraint #3 targets it, but it has not been exercised on real hardware; Pi validation is an M3 item. |
| VPS primary + Pi replica (Litestream) | **Unvalidated design direction**, not a support claim. |

`docs/DEPLOY.md` documents the two supported options plus backups. The committed
setup script selects and downloads PocketBase, and the repository includes a
Windows binary locally.

The baseline deployment guide's warning that all rules were Phase-1 permissive
was stale and has been corrected; the selective lockdown is committed. As of the
2026-07-20 revision the follow-on blockers are also cleared: the office UI
authenticates through `lc-auth.js`, `segments` writes require auth, and the
smoke test asserts the matrix across three tiers. The README's
"do-not-expose-to-the-internet" warning tied to this reconciliation has been
removed accordingly. Standard pre-release caution still applies (this is not a
tagged stable release), and any live instance that was firewalled or
basic-auth-gated pending this work can now be re-verified from outside per
`docs/DEPLOY.md`.

## Active development at session start

The starting index/worktree contained maintainer-owned work for
`turnover_packages`, `signatures`, turnover hooks/canonicalization, login/auth,
and turnover/signature pages, plus a project-page link. It also contained
untracked `AGENTS.md` and proposed preservation ADR work. These files may
invalidate the authentication, collection-count, signature, hashing, and PDF
sections above once reviewed and committed. They were deliberately excluded
from `CURRENT` claims and from documentation commits in this session.
