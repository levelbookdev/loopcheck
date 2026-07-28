# LoopCheck — Roadmap

What's shipped, what's next, and where the line between free and paid sits.
Companion to [ARCHITECTURE.md](../ARCHITECTURE.md) (how it's built),
[CLAUDE.md](../CLAUDE.md) (the constraints), and
[DECISIONS.md](DECISIONS.md) (why the sequence is what it is). Dates are
intentionally absent — this is a sequence, not a schedule. The maintainer builds
this around a full-time construction job; sequence is the honest promise.

Milestones are named by goal and mapped to a semver tag ([DECISIONS.md D1](DECISIONS.md#d1--milestone-structure-and-version-mapping)).
The executable, self-contained tasks for the **current** milestone live in
[`docs/tasks/`](tasks/); later milestones are defined here and broken into tasks
when the prior milestone closes (the roadmap-maintenance workflow in
`CLAUDE.md`).

## Vision

LoopCheck is a startup & commissioning checkout tracker for water/wastewater and
heavy-civil construction. Every piece of plant equipment already wears a P&ID tag
(PMP-3101, FIT-2205, MOV-4410). LoopCheck puts a QR code on that tag so the
person standing in front of it — a laborer with a stock camera app, no account,
no training — can see exactly where that equipment stands in checkout, log the
next check, or flag a punch item. It answers three questions and refuses to be
anything else: what checks has this equipment passed and what remains; what punch
items are blocking this system; and can we prove it, with signed, timestamped,
immutable records, to the engineer of record, the owner, or a dispute.

A hyper-focused tool beats a platform here because the value is trust, and trust
comes from constraints a platform cannot keep: append-only records, derived
(never stored) status, no forms designer, a no-install field tier that runs on a
$40 Android and a Raspberry Pi. Every feature is measured against those walls
(`CLAUDE.md`). The moment the tool tries to be an ERP, a scheduler, or a
document-management suite, it stops being trustworthy at the one thing it does.

The open-core boundary is load-bearing, not a business afterthought. The **field
tier** — scan, see status, flag punch items, log checks, and export the ledger
(CSV, and eventually a free structured manifest) — is AGPLv3 and free forever.
The future **paid tier** is a separate sidecar application (`bindery-*`) that
consumes the same public API any third party could, and compiles *derived* office
deliverables (the hyperlinked turnover binder, notifications, portfolio
dashboards). Paid software can never gate, degrade, or be required for any field
workflow, and any schema the paid tier needs lands here, AGPL, for everyone,
first ([ADR 0003](adr/0003-core-premium-sidecar-boundary.md)).

---

## Shipped (the product today)

Feature-broad and working; never yet tagged, hardened, or validated. A fresh
database from committed migrations has **24 application collections** plus
PocketBase's `users`. Authoritative descriptions live in `ARCHITECTURE.md`;
this is the index.

- **Core checkout ledger (Phases 1–2).** Projects → systems → tags; CSV import;
  QR labels; append-only check execution (`check.html`) with derived results,
  frozen prompts/witness/test-equipment copies, and punch evidence links
  ([ADR 0004](adr/0004-test-equipment-and-punch-evidence-links.md)); derived
  checkout standing and check history on the tag page; printable single-check
  view; free per-tag ledger CSV export.
- **Warranty & Closeout** ([ADR 0005](adr/0005-warranty-closeout-clock-start-provenance.md)) —
  derived warranty end dates, closeout dashboard, warranty timeline, closeout
  package print view, CSV import.
- **Instrument Calibration** ([ADR 0016](adr/0016-purpose-built-instrument-calibration-records.md)) —
  `test_standards` registry with certificate provenance; append-only
  `calibrations` + `calibration_points`; as-found/as-left; offline outbox;
  derived due badges.
- **Service Cutover Tracker** ([ADR 0006](adr/0006-service-connections-third-subject.md)) —
  first non-equipment subject; `/s/{id}` page, cutover board, batch door-hanger
  notice mode, CSV import, meter-box QR labels; customer PII isolated in
  auth-gated `service_contacts` ([ADR 0011](adr/0011-auth-lockdown.md)).
  **Semantics frozen** ([DECISIONS.md D9](DECISIONS.md#d9--service-cutover-stays-in-loopcheck-semantics-frozen)).
- **LOTO Status Board** ([ADR 0007](adr/0007-loto-visibility-staleness-asymmetry.md)) —
  append-only apply/release, derived lockout, staleness asymmetry, no green
  state. A visibility layer, never part of the energy-control decision. Free
  permanently — safety visibility is never paywalled.
- **Signatures & Turnover** ([ADR 0010](adr/0010-signatures-and-turnover-package.md), **Proposed/frozen** — [DECISIONS.md D6](DECISIONS.md#d6--adr-0010-signatures--turnover-stays-proposed-and-frozen)) —
  server-built frozen turnover snapshot + content hash, `sign.html`,
  `turnover.html`, shared `lc-auth.js`/`login.html`. Implemented but not
  formally accepted; no further work this cycle.
- **Selective auth + PII split** ([ADR 0011](adr/0011-auth-lockdown.md), **Accepted**) —
  public scan/reads and the deliberate accountless flag/check/LOTO/calibration
  creates survive; office writes and PII reads require an account; 70-assertion
  smoke test asserts the matrix across guest/user/superuser.

**Shipped schema without UI (deliberately parked, not roadmap items):** segment
acceptance (owned by MainLine — [D10](DECISIONS.md#d10--segment-acceptance-is-owned-by-mainline-correction-of-record)),
open→resolve + tank leak test ([D8](DECISIONS.md#d8--openresolve-and-tank-leak-test-uis-are-parked)),
equipment preservation ([ADR 0015](adr/0015-stored-equipment-preservation-log.md)) and
vendor field service visits ([ADR 0017](adr/0017-vendor-field-service-reports.md))
([D7](DECISIONS.md#d7--preservation-adr-0015-and-vendor-visits-adr-0017-uis-are-parked)).

---

## M1 — Harden & Reconcile → **v0.9.0** (current milestone)

**Goal.** Make the existing breadth trustworthy enough to deploy on a real job:
the tests prove the invariants, the docs tell one truth, and a clean install is
validated — all gated by CI. No new features
([DECISIONS.md D2](DECISIONS.md#d2--trust-before-features-m1-comes-first)).

**In scope**
- Reconcile all docs to a single source of truth: LineCheck→MainLine sweep,
  collection-count truth (24), honest offline/topology labeling, stale
  `TODO(auth)` cleanup, `AGENTS.md` reduced to a pointer.
- Expand `scripts/smoke_test.sh` to cover the self-documented gaps (segments
  existence, tank, open→resolve) and the newer collections (calibrations,
  service_visits).
- Add a headless-browser smoke test of the critical field path (scan tag → log
  check → flag punch → LOTO), dev-only tooling.
- CI: GitHub Actions running the suites, plus a hardened local pre-push gate.
- Deploy validation on an ARM cloud VM (clean install + seed + backup/restore).
- Release plumbing: reconcile the CHANGELOG, tag **v0.9.0**, and finish the auth
  effort's checkpoint 6 (remind the maintainer to drop the temporary VPS
  basic_auth gate; delete `SESSION-NOTES.md`).

**Out of scope**
- Any new feature or new collection. Phase 4, the Punch List report, and Phase 5
  all wait for M2+.
- The formal API v1 version bump (that is M3 — [D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)).
  M1 only makes the *documentation* of the current collection set truthful.
- Accepting ADR 0010, building any parked schema's UI, or a general offline
  layer.

**Definition of done (testable)**
- [x] `grep -ri "linecheck" docs/ *.md` returns only historical/superseded
      references explicitly labeled as such (ADR 0014's own record); no doc names
      LineCheck as the *current or future owner* of any scope.
- [x] Every doc that states a collection count states **24** (application
      collections); none says 16 or 18 as the current total.
- [x] `scripts/smoke_test.sh` passes with new assertions for: `segments` in the
      existence loop, a tank leak-test seed/workflow assertion, and an
      open→resolve behavior assertion; run count is documented in the script
      header and matches actual passes.
- [ ] A browser smoke test exists under `scripts/` and passes headless against a
      freshly seeded instance, exercising the critical field path; it is
      git-ignored dev tooling and adds nothing to `pb_public/`.
- [ ] A GitHub Actions workflow runs both suites on push/PR and is green; the
      pre-push hook runs the same gate locally.
- [ ] `docs/DEPLOY.md` contains a completed ARM-VM validation record (clean
      install, migrations+seed applied, backup/restore verified) with the
      topology honestly labeled (LAN/single-VPS supported; Pi/replica
      unvalidated).
- [ ] Repo tagged `v0.9.0` with release notes; `SESSION-NOTES.md` deleted in the
      release commit; a `CHANGELOG.md` exists covering the release.

Tasks: [`010`](tasks/010-docs-reconcile-stale-references.md) ·
[`020`](tasks/020-docs-reconcile-status-and-contract-truth.md) ·
[`030`](tasks/030-expand-smoke-test.md) ·
[`040`](tasks/040-browser-ui-smoke-test.md) ·
[`050`](tasks/050-ci-pipeline.md) ·
[`060`](tasks/060-deploy-validation-arm-vm.md) ·
[`065`](tasks/065-landing-page-truth-and-pages.md) ·
[`070`](tasks/070-release-v0.9.0.md)

---

## M2 — Shutdown Runbooks + Punch List → **v0.10.0**

**Goal.** Ship the first new feature since hardening — the Phase 4 tie-in
shutdown runbook execution UI — plus the on-mission Punch List report.

**In scope**
- **Phase 4 shutdown runbooks.** The tie-in shutdown runbook in
  `seed/shutdown_runbook_tie_in.json` (offsets, hold points, roles) gets real
  `shutdowns` / `shutdown_steps` / roles collections and an execution UI. **UI
  bar (decided):** zero navigation taps, glove-sized touch targets — used at
  2 AM, in rain, under schedule pressure.
- **Punch List report (idea B1).** A project/system roll-up of A/B/C punch items
  as a print-friendly board and a free CSV, serving "what punch items are
  blocking this system?" ([D17](DECISIONS.md#d17--punch-list-report-idea-b1-adopted-into-m2-pending-gap-confirmation)).
  Free tier, never paywalled.

**Out of scope**
- Any energy-control decision support (interlocks, release permissions, "safe to
  work" indicators) — permanently rejected (`ARCHITECTURE.md` rejected list).
- Loading the shutdown runbook into the flat-checklist engine — it needs its own
  collections (offsets/hold points/roles can't live in a flat checklist).
- Paid deliverables (a compiled shutdown report is sidecar work).

**Definition of done (testable)**
- [ ] An accepted ADR defines the shutdown collections and the append-only
      execution model **before** the migration (the design task's output).
- [ ] Migrations create the shutdown collections; a fresh DB + smoke test pass.
- [ ] An operator can execute the seeded tie-in runbook end to end from the UI,
      producing append-only step records; executed steps are never edited.
- [ ] The Punch List report renders print-friendly and exports CSV for a system
      and a project, grouped by A/B/C severity with the fixed color language.
- [ ] Docs updated (ARCHITECTURE, ROADMAP checkbox, landing page if
      user-visible); tagged v0.10.0.

**Task status.** Only the design/ADR task ([`080`](tasks/080-phase4-shutdown-runbook-design-adr.md))
and the Punch List task ([`090`](tasks/090-punch-list-report.md)) are written
now. The remaining Phase 4 **build** tasks are written after `080` is accepted
(they depend on domain decisions deliberately not guessed here) — see the
roadmap-maintenance workflow in `CLAUDE.md`.

---

## M3 — Stranger-Ready → **v1.0.0**

**Goal.** Close the gap between "the maintainer can run it" and "a stranger can
adopt and self-host it" ([DECISIONS.md D19](DECISIONS.md#d19--v10-stranger-ready-bar)).

**In scope**
- **Onboarding docs.** A getting-started path a stranger follows unaided:
  install → seed → import their equipment → first check, with screenshots.
- **Stable release discipline.** Semver tags, `CHANGELOG.md` maintained, a
  documented upgrade/migration path, and the **API v1 contract reconciled and
  version-bumped** for the added collections and auth/PII semantics
  ([D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10);
  open-questions #7).
- **Raspberry Pi validation.** The hard-constraint promise proven on real Pi
  hardware and recorded in `DEPLOY.md` (the acceptance checklist already in this
  file's Pi track).
- **Accessibility + polish.** Field pages verified on a cheap Android; an a11y
  pass; an offline-behavior honesty audit across all pages (not just LOTO).

**Out of scope**
- New feature modules (Phase 5 and parked scope are post-1.0).
- The paid sidecar existing (v1.0 is the *free core* being stranger-ready).

**Definition of done (testable)**
- [ ] A new operator can go from `git clone` to a logged check following only the
      onboarding doc, verified by a fresh run.
- [ ] `docs/API.md` is a versioned contract with no "delta pending" collections;
      the version bump is recorded in an ADR.
- [ ] `DEPLOY.md` contains a real Pi validation record (model + OS) satisfying
      the Pi acceptance checklist.
- [ ] An accessibility/offline-honesty audit is recorded with issues fixed or
      ticketed; `CHANGELOG.md` and a `v1.0.0` tag exist.

---

## Post-1.0 — planned modules

Defined, not yet scheduled; broken into tasks when reached.

- **Phase 5 — recurrence & location subjects.** Compliance logs (chlorine
  residuals, SWPPP walks) from the already-seeded templates; recurrence cadence
  schema already shipped. Location becomes a check subject the way service did.
- **Free JSON turnover manifest (idea B5).** The open-core keystone: a complete
  free structured export of a turnover snapshot so the paid PDF is
  presentation-only. Coupled to unfreezing ADR 0010
  ([D6](DECISIONS.md#d6--adr-0010-signatures--turnover-stays-proposed-and-frozen),
  [D18](DECISIONS.md#d18--parked-and-rejected-ideas-do-not-re-propose-without-new-evidence)).

---

## Later / Ideas (parking lot)

Not scheduled. Recorded so they aren't re-proposed as new; promote only on real
demand or a new decision. Rationale for each is in
[DECISIONS.md D7, D8, D18](DECISIONS.md).

- **"Walk the system" batch-check mode (B2)** — batch the same check across a
  system's tags. Revisit after M2 proves the glove-sized UI pattern.
- **Field-tier offline app-shell / service worker (B3)** — rejected this cycle;
  blocked on the offline-guarantee decision (open-questions #8). Honest
  online-required labeling beats a half-built offline layer.
- **Ledger-integrity / provenance view (B4)** — overlaps frozen hash work (ADR
  0010); would pre-commit hash semantics.
- **Equipment preservation UI (ADR 0015)** — parked; ownership vs TrenchNote
  unresolved (open-questions #3).
- **Vendor field service visit UI (ADR 0017)** — parked; schema frozen.
- **open→resolve / tank leak-test UI (ADR 0012)** — parked; build on real demand.
- **Cross-product handoff manifests / lifecycle events** — blocked on a portable
  identity scheme (open-questions #4); `docs/ecosystem-contracts.md` stays
  PROPOSED and non-binding.

## Explicitly not planned (permanent)

Forms designer / conditional checklists · stored status fields · npm, build
steps, CDNs in the app · vendor API integrations · being an ERP · any
energy-control decision support in the LOTO module. See `ARCHITECTURE.md` §7
(rejected ideas).

---

## Raspberry Pi validation (parallel track — deferred, hardware shortage)

Self-hosting on a Pi in the commissioning trailer is hard constraint #3 and
stays a core promise. The maintainer's Pi order is caught in a supply shortage,
so **hardware validation** is deferred — deliberately, because the Pi was never a
build dependency: PocketBase ships official `linux/armv7` and `linux/arm64`
binaries, `scripts/setup.sh` detects both, and everything that makes a Pi viable
(single binary, embedded SQLite, no build step, no CDN) is enforced by
construction.

**Interim (M1, cheap, doable now):** the ARM cloud-VM validation in task `060`
exercises the actual ARM binary path for a few dollars.

**Pi acceptance checklist (M3, one evening when hardware lands):**
- [ ] Fresh Pi OS: `git clone` + `scripts/setup.sh` fetches the right binary
      (armv7 *and* arm64 if practical).
- [ ] First `serve`: all migrations + the seed library apply cleanly.
- [ ] `DEPLOY.md` Option A (systemd) followed verbatim; survives reboot and a
      pulled power cord.
- [ ] Seeded demo reachable from a phone over LAN Wi-Fi in ~1 s; the QR label
      sheet renders and prints.
- [ ] Several simultaneous phone scans + a check submission — no SQLite lock
      trouble at trailer-crew concurrency.
- [ ] Stop-copy-start backup per `DEPLOY.md`, restore verified on another box.
- [ ] `DEPLOY.md` updated with the tested Pi model + OS.

---

## Open questions

The full architecture-decision backlog is [`open-questions.md`](open-questions.md).
Status of each, per the 2026-07-21 planning session:

| # | Question | Disposition |
|---|---|---|
| 1 | Service-cutover ownership | **Decided** — stays in LoopCheck, frozen ([D9](DECISIONS.md#d9--service-cutover-stays-in-loopcheck-semantics-frozen)) |
| 2 | Continue Phase 6 segments? | **Decided** — no; MainLine owns ([D10](DECISIONS.md#d10--segment-acceptance-is-owned-by-mainline-correction-of-record)) |
| 3 | Preservation ownership | **Open** — resolve boundary vs TrenchNote before any preservation UI ([D7](DECISIONS.md#d7--preservation-adr-0015-and-vendor-visits-adr-0017-uis-are-parked)) |
| 4 | Portable identity scheme | **Deferred** — gate before first handoff ([D11](DECISIONS.md#d11--portable-identity-scheme-deferred)) |
| 5 | Accept ADR 0010? | **Deferred** — stays Proposed/frozen ([D6](DECISIONS.md#d6--adr-0010-signatures--turnover-stays-proposed-and-frozen)) |
| 6 | Auth access matrix | **Resolved** — ADR 0011 Accepted |
| 7 | API v1 reconciliation | **Scheduled** — M3 ([D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)) |
| 8 | Offline guarantee | **Doc now, code deferred** ([D13](DECISIONS.md#d13--offline-document-guarantees-now-build-no-second-queue)) |
| 9 | Min free turnover artifact | **Deferred** with #5; principle recorded (B5) |
| 10 | Deployment topology | **Doc now** (label honestly), Pi validation M3 ([D14](DECISIONS.md#d14--deployment-topology-labeling)) |

**Unresolved for the maintainer to answer eventually** (not blocking M1): #3
(preservation ownership) and #4 (identity scheme) both need a maintainer/domain
decision before the corresponding work can start; the roadmap parks that work
until then.

### Planning-session open questions (2026-07-21)

Decisions I made with a reasonable default but that the maintainer may want to
revisit — none block M1:

1. **First tag = `v0.9.0`.** Chosen to match the version the auth effort already
   proposed (SESSION-NOTES) and because the product is feature-broad. If you'd
   rather the first public tag be `v1.0.0-rc` or `v0.1.0`, say so before task
   `070`.
2. **`AGENTS.md` kept as a thin pointer** (D5) rather than deleted. If you no
   longer run Codex sessions at all, deleting it may be cleaner than maintaining
   even a pointer.
3. **Browser-test tooling defaults to Playwright (a Node dev dependency).** It is
   dev-only and isolated (D16), but if you'd prefer to avoid any Node/npm in the
   repo even for tests, task `040` says to stop and ask — flag it now and I'll
   respec that task around a lighter tool (e.g. a curl-plus-DOM-scrape approach)
   before it runs.
4. **No `docs/ARCHITECTURE.md` created.** The root `ARCHITECTURE.md` is
   authoritative and already includes a diagram (D4). If you specifically wanted
   a separate high-level architecture page for newcomers, I can add one that
   *links to* the root rather than duplicating it.
