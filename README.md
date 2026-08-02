# LoopCheck

**Startup and commissioning checkout for water/wastewater and heavy-civil
construction.** Open source, self-hostable, and usable from a stock phone
camera with no app to install.

Overview and screenshots: **[ringout.app](https://ringout.app)**

Every plant asset already has a P&ID tag number such as `PMP-3101`, `FIT-2205`,
or `MOV-4410`. LoopCheck puts a QR code on that tag. Scanning `/t/{tag_number}`
shows the asset's checkout ledger and blockers and lets a person in the field
append the next check or flag a punch item.

LoopCheck is for commissioning engineers, project engineers, superintendents,
trades, vendors, inspectors, and owner representatives who need to answer:

1. What checks has this equipment passed, and what remains before startup?
2. What punch items are blocking this system?
3. Can we prove it with signed, timestamped, append-only evidence?

## Maturity and current scope

LoopCheck is a **pre-release development project**. The equipment checkout,
readiness, check ledger, punch, LOTO visibility, service-cutover,
instrument-calibration, warranty/closeout, training-milestone, rotation, CSV, label, and browser-print
surfaces are implemented. Automated coverage is a combined PocketBase smoke
test rather than a complete unit/browser suite.

The committed schema is ahead of parts of the UI: segment subjects and
pressure/gravity templates, pending checks with linked resolution, and a tank
leak-test template exist, but their complete execution/import/board/package
flows do not. Signatures and frozen turnover packages (ADR 0010) are
implemented — `sign.html`, `turnover.html`, and the server-side
`POST /api/turnover/build` are committed and review-hardened — but the ADR
stays Proposed pending the formal API-contract decision, so treat the two
collections as delta, not v1.

The selective backend authentication lockdown is complete and reconciled
(ADR 0011). Public reads and the narrow accountless field-write paths stay open
by design; every other write, and all office/PII reads, require an account. The
office pages authenticate through the shared `lc-auth.js` helper, and
`scripts/smoke_test.sh` asserts the access matrix across guest, user, and
superuser tiers — including that customer PII never appears in any accountless
response. It remains a **pre-release development project** (see the maturity
note above), but the auth reconciliation that previously blocked internet
exposure is done. See [`docs/current-state.md`](docs/current-state.md) for the
exact snapshot.

## Design constraints

- **No-install field tier.** Public tag/service reads and the narrow
  accountless field-write paths are deliberate. A laborer can scan a plain URL
  and flag a defect without installing an app or creating an account.
- **Append-only execution evidence.** Checks, answered lines, attachments,
  closeout transitions, and LOTO events are never edited or deleted by normal
  clients. Corrections and external results append new linked records.
- **Derived current standing.** Tag, service, system, rotation, LOTO, segment,
  and warranty states are computed from facts rather than stored as drifting
  status fields.
- **No build step.** PocketBase serves static HTML/CSS + Alpine.js. Browser
  libraries are vendored under `pb_public/vendor/`; there is no runtime CDN.
- **Field facts stay free.** AGPL core owns capture and basic evidence retrieval.
  Optional paid sidecars may aggregate or compile but never become necessary
  for basic field execution.

## Local development

Run `scripts/setup.sh` from a POSIX shell (Git Bash on Windows) to download the
PocketBase binary for the current platform. A Windows binary may also be placed
at the repository root manually.

```sh
./scripts/setup.sh
./pocketbase serve                       # local machine only
./pocketbase serve --http=0.0.0.0:8090   # reachable on the local LAN
```

Open `http://127.0.0.1:8090/_/` and create the PocketBase superuser. The
versioned migrations create the application collections and load the built-in
template library from `seed/`.

For the currently verified end-to-end development path, create a normal user
in the PocketBase admin UI and run the fictional demo seed through the public
REST API:

```sh
LC_URL=http://127.0.0.1:8090 \
LC_EMAIL=demo@example.com \
LC_PASSWORD='your-password' \
sh scripts/seed_demo.sh
```

The script populates a project with equipment, checks, punches, warranties,
closeout records, service cutover, and LOTO data. `scripts/smoke_test.sh` boots
a throwaway database and exercises the same combined stack. The project
creation and CSV import pages require a sign-in — create a user in the admin UI
and sign in through `/login.html` (the field tag/service pages need no account).

## Current entry points and exports

- `/t/{tag_number}`: public tag identity, derived checkout/training standing,
  instrument calibration badge/history, LOTO freshness, punch flow, check
  history, and tag-ledger CSV.
- `/s/{serviceId}`: service-cutover identity, phases, punches, and ledger.
- Project views: system readiness, readiness matrix, punch list, cutover,
  rotation, LOTO, calibration due, warranty, closeout, imports, and QR labels.
- Free exports: per-tag ledger CSV, rotation-board CSV, punch-list CSV, and
  print-friendly HTML for checks, boards, labels, and closeout packages. There
  is no committed server PDF renderer.

LOTO logging and instrument-calibration capture have durable browser outboxes.
LOTO alone has safety-specific stale-data presentation; the rest of the
application is online-required except for limited in-tab retry behavior in
batch notice logging.

## Architecture and deployment

One PocketBase process serves the static frontend, standard collection REST
API, embedded SQLite database, file storage, migrations, and the clean tag and
service routes. It uses `window.location.origin`, so the same files run on
localhost, a plant LAN host, or behind a real domain.

Deployment guidance covers a single LAN host and a VPS behind Caddy/systemd,
including backups and restore drills. Raspberry Pi performance and the
documented VPS/Pi replication design are not yet validated support claims. See
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Product boundary

LoopCheck owns **plant equipment and process-system commissioning**. It is not
a forms designer, ERP, scheduler, accounting system, document-management suite,
or LOTO authority.

The intended independently deployed product family is:

- **TrenchNote:** receipt, storage, preservation, custody, movement, issue, and
  installation references for physical material/assets.
- **MainLine:** station-based pipeline construction records, and — as a future,
  unscheduled module — test segments, pressure/gravity testing, flushing,
  disinfection, sampling, and linear acceptance. (This scope was briefly
  LineCheck's; LineCheck is archived.)
- **LoopCheck:** plant tags/systems, checkout, startup, functional testing,
  training, warranty/closeout, turnover, and service cutover/restoration.
- **`bindery-*`:** optional paid coordination, managed operations,
  integrations, aggregation, notifications, and advanced compilation.

Service cutover stays in LoopCheck permanently. The segment schema slice that
shipped here stays too, frozen at maintenance-only — the segment execution UI
is not built in LoopCheck, and that scope now belongs to MainLine's future
module. Record migrations between products are frozen until there are real
users; the overlap reasoning is preserved in
[`docs/overlap-and-migrations.md`](docs/overlap-and-migrations.md).

## Repository layout

```text
pb_migrations/  Versioned PocketBase schema and seed loaders
pb_hooks/       Core clean-URL and other server-side routes
pb_public/      Static HTML/CSS/Alpine frontend and vendored browser libraries
seed/           Authoritative domain template JSON and captured runbook data
scripts/        Setup, fictional demo seed, and combined smoke test
examples/       Sample import data
docs/           Architecture, operations, contract, boundary, and user docs
```

## Documentation

- [`docs/documentation-index.md`](docs/documentation-index.md): authority map
  for all documentation.
- [`docs/current-state.md`](docs/current-state.md): evidence-backed committed
  snapshot and known limitations.
- [`ARCHITECTURE.md`](ARCHITECTURE.md): LoopCheck implementation and decisions.
- [`docs/API.md`](docs/API.md): published API contract plus current
  implementation delta requiring reconciliation.
- [`docs/product-boundary.md`](docs/product-boundary.md) and
  [`docs/lifecycle-map.md`](docs/lifecycle-map.md): product ownership and
  proposed handoffs.
- [`docs/domain-model.md`](docs/domain-model.md) and
  [`docs/invariants.md`](docs/invariants.md): entities, authority, mutability,
  derived state, and stable rules.
- [`docs/architecture-status.md`](docs/architecture-status.md) and
  [`docs/open-questions.md`](docs/open-questions.md): decision status and backlog.
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md),
  [`docs/DEPLOY.md`](docs/DEPLOY.md), and [`seed/README.md`](seed/README.md):
  field, operations, and template-library guidance.

## License

[AGPLv3](LICENSE). Field execution remains free. Anyone offering a modified
LoopCheck over a network must make the corresponding source available under
the license. Optional office-side aggregation and advanced deliverable
compilation may be separate paid products; they may not cripple the core field
tier.
