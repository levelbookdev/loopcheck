# Changelog

All notable changes to LoopCheck are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[semantic versioning](https://semver.org/), with the milestone-to-version map in
[docs/ROADMAP.md](docs/ROADMAP.md).

## [Unreleased]

Next milestone is **M2 — Shutdown Runbooks + Punch List** (→ v0.10.0). See
[docs/ROADMAP.md](docs/ROADMAP.md) and the task queue in [docs/tasks/](docs/tasks/).

### Fixed

- **The turnover golden vector is now enforced and tested.** It was a
  `console.log` at hook load: on canonicalization drift it printed one line to a
  server console and kept sealing packages with `content_hash` values no
  independent verifier could reproduce — an unverifiable hash on a signed
  turnover package looks like evidence and is not. `POST /api/turnover/build`
  now **refuses** on mismatch, and `scripts/smoke_test.sh` asserts the pinned
  algo, digest shape, hash determinism across a rebuild, and supersession.
  Deliberately not a throw at hook load: a drifted *turnover* canonicalizer must
  not take down an instance serving QR scans, LOTO status, and field checks
  ([DECISIONS D26](docs/DECISIONS.md#d26--adr-0010-accepted-the-golden-vector-was-not-a-test-until-it-was-made-one)).

### Changed

- **Smoke test expanded 89 → 94 assertions** (the turnover build seal).
- **ADR 0010 (Signatures & the turnover package) is Accepted.** No behavior
  change beyond the fix above; the API v1 contract bump for `turnover_packages`
  and `signatures` remains M3 work.

## [0.9.0] — 2026-07-30

**First tagged release.** LoopCheck has been feature-broad for a while; this tag
is about making that breadth *trustworthy* — the tests prove the invariants, the
docs tell one truth, and the access model is enforced and asserted rather than
assumed. No new features were added in this milestone, deliberately
([DECISIONS.md D2](docs/DECISIONS.md#d2--trust-before-features-m1-comes-first)).

Still pre-1.0: `v1.0.0` is the *stranger-ready* milestone (M3), which owns the
API contract version bump, real Raspberry Pi validation, and an accessibility
pass.

### Shipped in this release

The product as first tagged — 24 application collections, 34 migrations:

- **Core checkout ledger** — projects → systems → tags, CSV import, QR labels,
  append-only check execution with frozen prompts/witness/test-equipment copies,
  derived checkout standing, check history, printable single-check record, and a
  free per-tag ledger CSV export.
- **Warranty & closeout** ([ADR 0005](docs/adr/0005-warranty-closeout-clock-start-provenance.md)) —
  derived warranty end dates from basis + clock start, closeout dashboard,
  warranty timeline, printable closeout package.
- **Instrument calibration** ([ADR 0016](docs/adr/0016-purpose-built-instrument-calibration-records.md)) —
  editable standards registry with certificate provenance; append-only
  calibrations with as-found/as-left points; offline outbox; derived due badges.
- **Service cutover tracker** ([ADR 0006](docs/adr/0006-service-connections-third-subject.md)) —
  `/s/{id}` page, cutover board, door-hanger notice batch mode, CSV import,
  meter-box labels. Customer PII isolated in the auth-gated `service_contacts`.
- **LOTO status board** ([ADR 0007](docs/adr/0007-loto-visibility-staleness-asymmetry.md)) —
  append-only apply/release, derived lockout, deliberate staleness asymmetry, no
  green state anywhere. A visibility layer that never becomes part of the
  energy-control decision. Free permanently.
- **Signatures & turnover** ([ADR 0010](docs/adr/0010-signatures-and-turnover-package.md)) —
  server-built frozen turnover snapshot with a content hash, signing surface, and
  print board. **Note:** the code ships, but ADR 0010 remains *Proposed and
  frozen* ([D6](docs/DECISIONS.md#d6--adr-0010-signatures--turnover-stays-proposed-and-frozen)) —
  treat `turnover_packages` and `signatures` as delta, not settled contract.

### Added

- **CI gate.** GitHub Actions runs both suites on every push and PR, pinned to
  the PocketBase version `docs/API.md` names as tested. The local `pre-push` hook
  runs the same scripts.
- **Headless-browser smoke test** of the critical field path — the QR route
  renders a populated page, the LOTO honesty line and freshness stamp are
  present, an accountless punch flag reads back, and a logged check appears in
  the ledger. Dev-only tooling, git-ignored, never vendored into `pb_public/`
  ([D16](docs/DECISIONS.md#d16--browser-test-tooling-is-dev-only-and-isolated)).
- **Installer integrity** — `scripts/setup.sh` now verifies the PocketBase
  download against the published `checksums.txt`, refuses and deletes a
  mismatched artifact, and makes any skip loud.
- **`.gitattributes`** pinning LF, so the repository's line endings no longer
  depend on each developer's `core.autocrlf`.
- **CHANGELOG.md** (this file).

### Changed

- **Auth lockdown accepted and enforced** ([ADR 0011](docs/adr/0011-auth-lockdown.md)).
  A deliberately small public allowlist — everything a scanned QR needs, plus the
  narrow accountless field writes (logging a check, flagging a punch item, LOTO
  apply/release, calibration and service-visit capture). Every other write and
  all office/PII reads require an account; deletes are superuser-only; the
  append-only ledgers reject updates and deletes regardless of auth. Customer PII
  lives only in `service_contacts`, so `services` is structurally PII-free.
- **Office pages reconciled** onto the shared `lc-auth.js` helper — hard-gated
  where a signed-out render would mislead, soft-gated on field-facing pages that
  must survive an accountless scan.
- **Smoke test expanded 70 → 89 assertions**, now covering all 24 collections,
  the tank leak-test seed, the open→resolve append-only pair, the newer
  collections' contract rules, and the access matrix across guest, user, and
  superuser tiers.
- **Docs reconciled to one truth** — segment ownership repointed to MainLine,
  collection count corrected to 24 everywhere, stale `TODO(auth)` comments
  rewritten as historical notes, `AGENTS.md` reduced to a pointer, and honest
  per-workflow offline and deployment-topology labels.
- **Repository is public**, and the landing page is live at
  [ringout.app](https://ringout.app).

### Fixed

- **The tag page no longer reports absence it cannot see.** Warranty and closeout
  sections previously fetched without a token, received `200` with an empty list,
  and rendered "No warranty recorded for this equipment" to an accountless
  user — the same dishonest-absence failure [ADR 0007](docs/adr/0007-loto-visibility-staleness-asymmetry.md)
  forbids for LOTO. They now say the records require sign-in.
- **The service CSV import no longer discards customer PII.** It wrote
  `customer_name`/`customer_phone` to `services` columns that the PII split had
  removed, silently dropping every contact while reporting success. It now
  creates `service_contacts` records and reports the two counts separately.
- **`segments` writes are no longer public.** The collection was created after
  the lockdown migration and kept the permissive Phase-1 rules — the last
  world-writable collection in the schema.

### Security

- The access matrix is asserted mechanically across three tiers on every CI run,
  including that customer PII never appears in an anonymous response and cannot
  be reached through the `service_contacts` back-relation expand.
- **The temporary Caddy `basic_auth` gate on the live deployment has been
  removed** (2026-07-30), after the deployment itself was brought up to `main`.
  It had been protecting an instance running 11 of 34 migrations with the
  original permissive rules. The lesson is recorded in
  [`docs/DEPLOY.md`](docs/DEPLOY.md): *"the repo is reconciled" and "the
  deployment is reconciled" are different claims, and only the second one makes a
  gate removable.*

### Known limitations

- **Not validated on ARM or Raspberry Pi.** The installer's architecture
  selection and the ARM artifacts are verified, but no ARM binary has been
  executed. Hard constraint #3's "runs well on a Raspberry Pi" is unmeasured.
  Tracked as task `060` and the Pi track in M3.
- **`docs/API.md` is not a settled v1.** Sixteen collections are published as v1;
  eight are marked *delta* pending a version bump, sequenced to M3
  ([D12](docs/DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)).
- **Schema ships ahead of UI in places**, deliberately: segment acceptance (owned
  by MainLine), open→resolve execution, equipment preservation, and vendor
  service visits all have schema and no execution surface.
- **Not offline-first.** Only LOTO logging and calibration capture have durable
  browser outboxes; everything else requires connectivity
  ([D13](docs/DECISIONS.md#d13--offline-document-guarantees-now-build-no-second-queue)).

[Unreleased]: https://github.com/levelbookdev/loopcheck/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/levelbookdev/loopcheck/releases/tag/v0.9.0
