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
- **Signatures & Turnover** ([ADR 0010](adr/0010-signatures-and-turnover-package.md), **Accepted 2026-08-04** — [DECISIONS.md D26](DECISIONS.md#d26--adr-0010-accepted-the-golden-vector-was-not-a-test-until-it-was-made-one)) —
  server-built frozen turnover snapshot + content hash, `sign.html`,
  `turnover.html`, shared `lc-auth.js`/`login.html`. The golden vector is now
  **enforced at the build route and asserted by the smoke test** (it was a
  `console.log` until acceptance). The API v1 contract bump is **not** included
  and remains M3 work ([D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)).
- **Selective auth + PII split** ([ADR 0011](adr/0011-auth-lockdown.md), **Accepted**) —
  public scan/reads and the deliberate accountless flag/check/LOTO/calibration
  creates survive; office writes and PII reads require an account; the
  94-assertion smoke test asserts the matrix across guest/user/superuser.

**Shipped schema without UI (deliberately parked, not roadmap items):** segment
acceptance (owned by MainLine — [D10](DECISIONS.md#d10--segment-acceptance-is-owned-by-mainline-correction-of-record)),
open→resolve + tank leak test ([D8](DECISIONS.md#d8--openresolve-and-tank-leak-test-uis-are-parked)),
equipment preservation ([ADR 0015](adr/0015-stored-equipment-preservation-log.md)) and
vendor field service visits ([ADR 0017](adr/0017-vendor-field-service-reports.md))
([D7](DECISIONS.md#d7--preservation-adr-0015-and-vendor-visits-adr-0017-uis-are-parked)).

---

## M1 — Harden & Reconcile → **v0.9.0** ✅ closed 2026-07-30

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
- ~~Deploy validation on an ARM cloud VM (clean install + seed + backup/restore).~~
  **Moved to M3 (2026-07-30)** — it is the interim proxy for the Pi promise M3
  validates on real hardware, so it belongs there. The in-repo half is verified
  and recorded in `DEPLOY.md`; see task `060`.
- Release plumbing: reconcile the CHANGELOG, tag **v0.9.0**, and finish the auth
  effort's checkpoint 6 (remind the maintainer to drop the temporary VPS
  basic_auth gate; delete `SESSION-NOTES.md`).

**Out of scope**
- Any new feature or new collection. Phase 4, the Punch List report, and Phase 5
  all wait for M2+.
- The formal API v1 version bump (that is M3 — [D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)).
  M1 only makes the *documentation* of the current collection set truthful.
- ~~Accepting ADR 0010~~ (**done 2026-08-04, D26** — the code half was
  golden-vector test hardening, which *is* M1's goal; the decision half cost no
  build work), building any parked schema's UI, or a general offline layer.

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
- [x] A browser smoke test exists under `scripts/` and passes headless against a
      freshly seeded instance, exercising the critical field path; it is
      git-ignored dev tooling and adds nothing to `pb_public/`.
- [x] A GitHub Actions workflow runs both suites on push/PR and is green; the
      pre-push hook runs the same gate locally.
- [x] `docs/DEPLOY.md` labels topology honestly (LAN/single-VPS supported;
      Pi/replica unvalidated) and records what ARM verification has and has not
      been done. *The completed ARM-VM run moved to M3 with task `060`
      (2026-07-30)* — it is the interim proxy for the Pi promise M3 proves on
      real hardware, so the full record is required there, not here.
- [x] Repo tagged `v0.9.0` with release notes; `SESSION-NOTES.md` deleted in the
      release commit; a `CHANGELOG.md` exists covering the release.

Tasks: [`010`](tasks/010-docs-reconcile-stale-references.md) ·
[`020`](tasks/020-docs-reconcile-status-and-contract-truth.md) ·
[`030`](tasks/030-expand-smoke-test.md) ·
[`040`](tasks/040-browser-ui-smoke-test.md) ·
[`045`](tasks/045-normalize-line-endings.md) ·
[`050`](tasks/050-ci-pipeline.md) ·
[`055`](tasks/055-bump-actions-node20.md) ·
[`057`](tasks/057-verify-download-checksum.md) ·
[`060`](tasks/060-deploy-validation-arm-vm.md) ·
[`065`](tasks/065-landing-page-truth-and-pages.md) ·
[`066`](tasks/066-deployment-update-path.md) ·
[`067`](tasks/067-redeploy-vps-and-retire-the-gate.md) ·
[`070`](tasks/070-release-v0.9.0.md)

---

## M2 — Shutdown Runbooks + Punch List → **v0.10.0** (current milestone)

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
- [x] An **accepted** ADR defines the shutdown collections and the append-only
      execution model **before** the migration (the design task's output).
      *([ADR 0019](adr/0019-shutdown-runbook-execution.md), accepted
      2026-08-04.)*
- [ ] Migrations create the shutdown collections; a fresh DB + smoke test pass.
- [ ] An operator can execute the seeded tie-in runbook end to end from the UI,
      producing append-only step records; executed steps are never edited.
- [x] The Punch List report renders print-friendly and exports CSV for a system
      and a project, grouped by A/B/C severity with the fixed color language.
      *(`punchlist.html`, task [`090`](tasks/090-punch-list-report.md), 2026-08-02.)*
- [ ] Docs updated (ARCHITECTURE, ROADMAP checkbox, landing page if
      user-visible); tagged v0.10.0.

**Task status (2026-08-04).** The design task
([`080`](tasks/080-phase4-shutdown-runbook-design-adr.md)) and the Punch List
task ([`090`](tasks/090-punch-list-report.md)) are **DONE**.
[ADR 0019](adr/0019-shutdown-runbook-execution.md) is **accepted**, and the
Phase 4 build tasks are queued in order:
[`100`](tasks/100-shutdown-collections-migration.md) migration →
[`110`](tasks/110-shutdown-runbook-seed-loader.md) seed loader →
[`120`](tasks/120-shutdown-planning-ui.md) planning UI →
[`130`](tasks/130-shutdown-execution-ui.md) execution UI →
[`140`](tasks/140-shutdown-board-and-report.md) board + report. `100` is the
next actionable task.

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
  file's Pi track). Includes task [`060`](tasks/060-deploy-validation-arm-vm.md),
  **moved here from M1 (2026-07-30)** — the ARM cloud-VM run is the interim proxy
  for this promise, so it belongs beside the real thing rather than gating
  v0.9.0. Its in-repo half (installer architecture mapping, ARM asset existence
  and checksums) is already verified and recorded in `DEPLOY.md`; the live run is
  what remains.
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
- [ ] `docs/DEPLOY.md` contains a **completed ARM-VM validation record** (clean
      install, migrations+seed applied, systemd survives reboot, backup/restore
      verified) — task [`060`](tasks/060-deploy-validation-arm-vm.md), moved here
      from M1. Its in-repo half is already verified; the live run remains.
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

# The multi-vendor startup track (M4 → M6)

**Where this came from.** Field observations from a multi-vendor plant startup
— a review of a full compiled vendor startup report package (equipment vendor
forms, field service reports, I/O check reports, clean water test checklists)
against what LoopCheck can currently record. Ten gaps came out of that review.
The structural answers, the rejected alternatives, and the conflicts with
existing decisions are captured in
[**ADR 0018**](adr/0018-multi-vendor-startup-evidence-model.md) (*proposed —
design capture only, no migration, no UI*). **ADR 0018 must be accepted before
any task in M4–M6 is written**, per the design-task pattern `CLAUDE.md`
describes for Phase 4.

**Source verification (2026-08-04).** ADR 0018 was written from a *summary* of
the observations; the compiled report package was then read directly and the
reading recorded in [`0018-review-notes.md`](adr/0018-review-notes.md). All ten
observations were confirmed, several close to verbatim. The reading **added a
fourth tag-validation check** (M5.3) and **raised three open questions** the
summary did not (M5.1); it also proposed reversing the multi-value-reading
recommendation, which the maintainer **decided against** — M5.2 now records the
settled rule. Those changes are folded into the entries below.

**Why this track sits after v1.0, not before it.**
[D2](DECISIONS.md#d2--trust-before-features-m1-comes-first) (trust before
features) and [D19](DECISIONS.md#d19--v10-stranger-ready-bar) already fix
M1 → M2 → M3, and three of these items make **breaking changes to
v1-published collections** — which the API v1 reconciliation
([D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10))
must land first to make cleanly. Sequencing is recorded in
[D20](DECISIONS.md#d20--the-multi-vendor-startup-track-is-post-10-m4m6).
The **priority order inside the track** is the observed-pain order: the
staged lifecycle, ball-in-court punch items, and vendor evidence first.

**One sequencing constraint overrides the rest.** Every turnover addition below
changes the bytes that `sha256-canon-v1` hashes (ADR 0018, "what this adds to
the frozen turnover package"). They must land **before the first real package
is signed**, or behind a `sha256-canon-v2`. That is the strongest argument for
deciding ADR 0010 and ADR 0018 together — see open question #5.

---

## M4 — Staged checkout & ball-in-court → **v1.1.0**

**Goal.** Make the ledger able to say *which phase*, *who owes it*, and *whose
paper proves it* — the three gaps that produced the most rework in the observed
package.

### M4.1 — Per-tag, per-phase checkout lifecycle (observation 2)

Startup is staged, the same tag is touched in several phases with different
scope, and "deferred to phase X" is a real, recurring, load-bearing state that
today has nowhere to live.

*Already covered — extend, do not rebuild:* `checks.phase` already makes every
check per-tag-per-phase; required phases already derive from the template
library minus `tags.phases_na` (ADR 0009); `readiness.html` already renders the
tag × phase rollup with completion dates.

- **Data model.** `checks.result` += `deferred`. New `checks.deferred_to_phase`
  (select over the phase enum, nullable). Phase enum += `wet_commissioning`,
  `process_seeding` (additive enum-opening migration, then a seed loader — the
  established two-step). **No per-project `phases` collection**: a project
  configures its phases by configuring its template library (ADR 0018 §1).
- **UI.** `check.html` gains a "defer this phase" action that writes a signed,
  attributable deferral check naming the target phase and the reason.
  `readiness.html` gains a distinct `deferred → {phase}` cell state (neither
  red nor green) and per-cell drill-down to that phase's checks. `tag.html`'s
  standing plate shows deferred phases separately from passed and outstanding.
- **Validation.** `deferred_to_phase` is required when `result = "deferred"`
  and must differ from the check's own phase (server-enforced createRule —
  append-only means a malformed deferral is permanent). A deferral to a phase
  the tag lists in `phases_na` is rejected: scope cannot be deferred into a
  phase that does not apply.
- **Standing fold.** Gains one state, after `running` and before `incomplete`:
  a `deferred` record whose target phase has no later record folds to
  *deferred*. Deferral is **not** `phases_na` — that distinction is the whole
  point (owed-and-moved vs. never-owed).
- **Turnover.** The manifest's per-tag-per-phase standing grid records
  `deferred` cells **with their target phase**, so a frozen package cannot
  present moved scope as absent scope.

### M4.2 — Punch items: ball-in-court, phase gating, scope gaps, as-left (observation 4)

Coordination happened in email because the punch list could not say who owed
what, which phase an item blocked, or that an item was in nobody's scope.

*Already covered — extend:* `punch_items.assigned_party`, `source_check` /
`closing_check` (ADR 0004), A/B/C severity, and the `punchlist.html` report
(D17) all exist.

- **Data model.** `assigned_party` revocabulary: `gc` · `subcontractor` ·
  `vendor` · `controls_integrator` · `electrical` · `owner` · `engineer` ·
  `unassigned`, retiring `contractor` (migration maps `contractor` → `gc`).
  New `punch_items.blocks_phase` (select over the phase enum, nullable) and
  `punch_items.scope_gap` (bool). New `checks.as_left_condition` (text).
- **UI.** `punchlist.html` gains a ball-in-court filter and a **pinned
  scope-gap section** that renders above the severity groups and stays there
  until the item is claimed — the failure mode is that nobody reads a list
  they do not think is theirs, so a scope gap must never sort quietly into a
  party's bucket. `readiness.html` marks a cell whose phase is blocked by an
  open item. Every check-completion screen offers as-left condition as one
  optional line ("valve left closed", "breaker left racked out").
- **Validation.** `scope_gap = true` requires `assigned_party = "unassigned"`;
  assigning a party clears the flag (an item in someone's scope is by
  definition not a gap). `blocks_phase` is advisory — it never blocks a write.
- **Contract.** The `assigned_party` change is **breaking** on a v1 collection:
  it needs the ADR-0003 version bump, which is why it follows M3.
- **Turnover.** Scope-gap items and as-left conditions render as their **own
  sections** in the frozen package rather than buried inside the punch list.

### M4.3 — Vendor evidence attachment model (observation 1)

Vendor service techs will never use this app — they arrive with their own paper
or PDF forms. LoopCheck's job is to be the GC's master ledger that indexes the
vendor's own record and captures the handful of structured facts a dispute
turns on.

*Already covered — extend, and unpark:* `service_visits` (ADR 0017) is already
this collection — append-only, tag XOR system, vendor company, rep name,
purpose, summary, report via polymorphic `attachments`, idempotent
`client_token`. Its **UI was parked** by
[D7](DECISIONS.md#d7--preservation-adr-0015-and-vendor-visits-adr-0017-uis-are-parked)
pending a real job asking for it. These observations are that request
([D21](DECISIONS.md#d21--d7-and-d8-amended--the-real-job-trigger-fired)).

- **Data model.** `service_visits` gains `time_on_site` / `time_off_site`
  (text HH:MM), `date_end` (nullable — `date` becomes the start of a multi-day
  visit), `result` (`complete` / `incomplete` / `deferred` / `informational`),
  `open_items` (text — the verbatim end-of-visit list), `phase` (nullable),
  `check` (relation → checks, nullable), and `continues` (self-relation, for
  M6.4). No new collection.
- **UI.** A phone capture page for a visit (vendor, rep, dates, hours, purpose,
  result, open items, **report photo/PDF**), a per-tag vendor-evidence section
  on `tag.html`, and a project vendor-visit ledger. The report is captured in
  the same flow, and a visit whose report never uploaded is **loudly flagged
  and retried** — never silently presented as if the PDF exists (ADR 0017 §2).
- **Validation.** `result` is required and **always entered explicitly** —
  never derived or inferred from narrative text, by the UI or any future import
  path (a real service order in the source both checks "equipment not released
  for use" and states in prose that the unit is ready; nothing should resolve
  that automatically). `time_off_site` without `time_on_site` rejected; the
  existing tag-XOR-system + same-project createRule unchanged; the report stays
  non-constitutive so a failed second upload can never erase the visit.
- **The narrative is evidence.** `summary` holds the vendor's own words
  **verbatim, never paraphrased on entry**, and surfaces on the tag page, not
  only in the project ledger. The most dispute-relevant text in the source
  package is five paragraphs of one vendor's technical dissent about another
  trade's wiring — neither a check result nor a punch item, and worthless the
  moment someone condenses it.
- **Turnover.** **A vendor report index keyed by tag** — for every tag in
  scope, every visit with company, rep, dates, hours, result, open items,
  verbatim narrative, and the attachment digest of the report file. This is the
  highest-value single addition in the whole track: the table that says *here is
  every vendor who touched this tag, and here is their signed paper.* The index
  carries each visit's date **relative to the phase it evidences** and flags one
  materially older than that phase — the source package compiles an inspection
  report dated over two years before the rest of the set, presented as though
  contemporaneous. A warning, not a rejection.

**M4 definition of done (testable)**
- [ ] ADR 0018 is **Accepted** and its §§1, 2, 5, 6 are implemented as written
      or the ADR is amended first.
- [ ] A tag can carry a signed deferral naming its target phase; the standing
      plate and `readiness.html` render it as neither passed nor failed.
- [ ] A punch item can be assigned to any of the eight parties, flagged as a
      scope gap, and linked to the phase it blocks; `punchlist.html` pins
      scope gaps above the severity groups.
- [ ] A vendor visit with its report attaches to a tag from a phone and
      appears in the tag's vendor-evidence section and the project ledger; a
      report-less visit is visibly flagged.
- [ ] Migrations apply to a fresh DB; `scripts/smoke_test.sh` covers the new
      rules (deferral shape, scope-gap/party rule, visit validation).
- [ ] Docs updated (ARCHITECTURE, API.md contract rows, landing page);
      tagged v1.1.0.

---

## M5 — No ambiguous evidence → **v1.2.0**

**Goal.** Make it impossible for a frozen turnover package to contain a mark
whose meaning has to be guessed — the blank checkbox, the bare number, the tag
that might be two different machines.

### M5.1 — No ambiguous blanks (observation 3)

A blank checkbox could mean pass-and-forgot, not-applicable, not-performed, or
deferred. On paper there is no way to tell, and no way to ask years later.

*Current behavior, deliberately:* `check.html` writes every line, answered or
not, and an unanswered line lands with a blank `result` (ARCHITECTURE §6) so a
crew pulled off mid-checklist still leaves a record. That choice stays — the
gate moves to where ambiguity becomes permanent (ADR 0018 §4).

- **Data model.** `check_items.result` += `not_performed`, `deferred` (joining
  `pass` / `fail` / `na`). New `check_items.na_reason` (text).
- **UI.** The response control offers five explicit states instead of three
  plus a blank. A submit with blanks remains allowed but shows exactly which
  lines are unresolved, and the check lands `incomplete` as today. `sign.html`
  and the turnover build surface unresolved lines as the specific blocker,
  linking to the correction check that would clear them.
- **A note is never an answer.** Result and note are separate fields; prose in
  the response position is not a response. A line with a note and no result is a
  **blank** and the gate treats it as one. The source answers several lines with
  a bare "see notes" and no mark — a cross-reference standing in place of an
  answer, one of which points at notes that never mention the line. The capture
  UI structurally cannot produce this shape, which is the point.
- **Validation.** `na_reason` is **required when `result = "na"`**,
  server-enforced on `check_items`. A check may **not be signed**, and a scope
  may **not be frozen**, while any included line carries a blank result — the
  build route rejects the freeze and names the offending check and line.
  Capture itself is never blocked (hard constraint #1).
- **Turnover.** A **completeness assertion**: the freeze fails while any
  included check item is blank, so a frozen package can never contain an
  ambiguous blank. The strongest single evidence improvement in the track.
- **Orphan failures are the same class of defect, and the flag fires at
  sign/freeze — not at turnover.** A **failed line carrying no linked punch
  item** is a line whose consequence has nowhere to go, exactly like a blank.
  The source has one: the line confirming automatic recovery from simulated
  power-loss events, marked N, **note cell empty**, appearing in no action-item
  list anywhere in the package — and the page was **signed as a whole**
  immediately afterwards. A turnover-time check would have caught it far too
  late; the signature had already happened. So it belongs beside §4's
  blank-result gate at sign time. Whether it hard-blocks (as blanks do) or warns
  loudly is the open part — §4's gate is the precedent, and the field evidence
  says a warning would have been clicked through.
- **Three questions this item must answer before its task is written**
  (source-reading findings, [ADR 0018 review notes](adr/0018-review-notes.md)
  R3–R5, open questions 6–8):
  **(a)** *Pass with exception.* The source answers lines "see notes", twice
  with both a checkmark **and** "see notes". Proposed answer: no sixth state —
  render a `pass` carrying a note **and** a linked punch item differently, as a
  derivation.
  **(b)** *A reason vocabulary for `not_performed`.* The source records four
  sections as logic-tested but not live-tested because "conditions were not
  available" — not deferred, not N/A, not failed. Proposed:
  `conditions_unavailable` · `access_blocked` · `equipment_unavailable` ·
  `out_of_scope` · `other`.
  **(c)** *Structural vs. situational N/A.* Two lines are marked N/A on **every**
  unit of a type — a property of the equipment subtype, where the honest fix is
  a template split, not a typed reason six times. Proposed: keep the rule
  server-enforced and simple, add a template-page hint when a line is N/A on
  every tag of its type, and say plainly in the task that this rule will be
  felt.

### M5.2 — Typed value fields with expected ranges (observation 5)

Megger readings, cable resistance, amp draw vs. nameplate, per-leg voltage,
flows and pressures were recorded as numbers with the acceptance limit stated
somewhere else — or nowhere.

*Constraint:* hard constraint #5 fixes **exactly four response types**. This
adds none — a measured reading is already a `value` line; what it lacks is the
limit stored beside it. This closes the gap `docs/invariants.md` names as
desired invariant #3 (explicit units and calculation method) for value lines.

- **Data model.** `template_items` += `expected_min`, `expected_max` (number,
  nullable), `expected_text` (the human statement, e.g. "≥ 1 MΩ per kV + 1 MΩ"),
  `comparison` (`between` / `min` / `max` / `equals` / `informational`).
  `unit` and `confirm_per_spec` already exist and are unchanged — blank limits
  with `confirm_per_spec: true` stays the honest "the project spec supplies
  this number" state. `check_items` += `value_numeric` (number, nullable) and
  **frozen copies** of the four limit fields. Nameplate data goes on `tags`
  beside the existing `manufacturer`/`model`/`serial_number`: `hp`, `voltage`,
  `full_load_amps`, **`service_factor`**, `phase_count`, `rpm`, `frame`,
  `nameplate_note` — all CSV-importable through the header-synonym table.
  Service factor was missing until the source reading: every motor nameplate
  block in the package carries one, and it is what makes an over-nameplate amp
  reading arguable rather than automatically a failure.
- **Multi-value readings: one template line per value** — settled (maintainer
  decision 2026-08-04, ADR 0018 §7 and open question #3). Three-phase amps are
  three lines. The tap count is the same either way, it needs no schema beyond
  what this item already adds, and each leg carries its own limit and verdict;
  vendor forms compress these onto one row because paper is narrow, not because
  a phone should. **Known consequence:** per-leg *imbalance* is not derived —
  three lines each pass their own limit and nothing notices one leg 8% low. An
  optional `group_key` on `template_items` is the cheap future answer if a
  template ever needs a real imbalance criterion; **not built ahead**, and until
  then imbalance is a human read that produces a punch item like any other
  finding. ([Review notes R1](adr/0018-review-notes.md#r1--per-leg-readings-the-adrs-recommendation-is-reversed--decided--original-recommendation-upheld)
  argued the other way and was decided against; it is left standing with its
  flaw named.)
  Also cost the dual-voltage nameplate case: the source records amps as
  `24.8/12.4`, which a naive parse reads as one value.
- **UI.** A `value` line shows its limit inline as the tech types, with live
  in-range / out-of-range feedback before submit. Amp-draw lines compare
  against `tags.full_load_amps` and show the percentage. The reading itself is
  still typed freely.
- **Validation.** Pass/fail on a value line is **derived** from `value_numeric`
  against the frozen limits — never stored. An unparseable reading or
  `comparison: informational` derives nothing and the tech's explicit result
  stands; capture is never blocked by a reading the parser cannot read. The
  limits **freeze onto the check item** at submit, so a template edited next
  year cannot retroactively change whether a reading passed.
- **Turnover.** Every value line in the manifest carries reading, unit, frozen
  limit, and derived verdict — a number in the binder is never again a number
  with no criterion.

### M5.3 — Tag validation and the asset/position distinction (observation 7)

One tag number appeared for two different valves in a vendor report —
undetectable on paper. Equipment also got pulled, rebuilt, and reinstalled
mid-startup with nothing prompting re-verification.

- **Data model.** One small append-only collection, **`equipment_events`**
  (ADR 0018 §16, resolving open question #12): `project` · `tag` · `occurred_at`
  · `kind` (`replaced` / `rebuilt` / `reinstalled` / `relocated` /
  `nameplate_corrected`) · `serial_before` / `serial_after` (**both nullable**)
  · `performed_by` · `vendor_company` · `note` · `client_token`.
  `updateRule: null`, `deleteRule: null`, public create. The four validation
  checks below need no schema at all.
- **The re-verify marker is derived.** Any phase whose standing rests entirely
  on checks **older than the tag's latest event** renders as "passed before the
  {date} {kind} event." A marker, never a downgrade — the pass stays in the
  ledger, and nothing is stored. The frozen turnover package carries the same
  marker. **No `equipment_assets` collection and no second identity:** the
  source's actuators carry no serial number at all, so a serial-keyed asset
  model is holed on day one, and the real requirement ("a phase passed by a
  machine later pulled apart must not read as current") is a derivation over
  dates. Asset-history tracking — "where has serial X been installed" — is a
  **conscious loss**, recorded in [D27](DECISIONS.md#d27--the-asset-behind-a-position-is-an-appended-event-not-a-second-identity).
- **UI — four checks, not three.** (a) **Unknown-tag warning** wherever a tag
  number is *typed* rather than picked — vendor visit capture, vendor tag-list
  import, open-items text — resolved against the project's tag register,
  offering "create this tag" or "fix the number". A **warning, never a block**:
  a real tag missing from the register is itself a finding.
  (b) **Self-consistency within one report** — a tag claimed **twice inside the
  same report against two different descriptions**. Added after the source
  reading ([review notes R2](adr/0018-review-notes.md#r2--tag-validation-must-check-a-report-against-itself--resolved-in-adr-0018-11)):
  the source lists one flow-control-valve tag as two different valves and one
  analyzer tag as two different instruments. **Both tags exist and both resolve
  cleanly**, so checks (a), (c) and (d) all pass and the defect survives. This
  is the observed failure in its actual form.
  (c) **Duplicate-serial report** across `tags.serial_number` within a project —
  the source has one pump serial on two reports with different motor and
  gear-reducer serials.
  (d) **Nameplate-mismatch warning** when a vendor visit's recorded
  make/model/serial disagrees with the tag's own nameplate.
- **Validation.** Deliberately **no unique index on `serial_number`**: blanks
  are the norm and a duplicate is a finding to investigate, not a write to
  reject.
- ~~**Deferred to its own ADR.** The true asset-vs-position split…~~
  **Resolved 2026-08-04** — see the `equipment_events` bullets above. The heavy
  `equipment_assets` model was rejected, not postponed:
  [open-questions #12](open-questions.md#12-does-loopcheck-model-the-asset-separately-from-the-position),
  [D27](DECISIONS.md#d27--the-asset-behind-a-position-is-an-appended-event-not-a-second-identity).

**M5 definition of done (testable)**
- [ ] No `check_item` can be created with `result = "na"` and no reason; the
      smoke test asserts the rule.
- [ ] A turnover build **fails** on a scope containing a blank line, naming the
      check and line; signing is blocked the same way.
- [ ] A `value` line with limits derives and displays pass/fail, and its limits
      are frozen onto the check item (verified by editing the template
      afterwards and re-reading the historical check).
- [ ] Typing an unknown tag number warns without blocking; a project with two
      tags sharing a serial reports it.
- [ ] Migrations apply to a fresh DB; smoke test extended; docs updated;
      tagged v1.2.0.

---

## M6 — Configuration, signature QC & continuation → **v1.3.0**

**Goal.** Capture what the vendor PDFs took with them when they left, and make
the package refuse to be compiled with the signature block empty.

### M6.1 — Instrument and final-control-element configuration records (observation 6)

The 4–20 mA span, the transmitter range, the delay, the logging interval, the
setpoints — configured at startup, captured inside a vendor's report, and
unrecoverable by the time the instrument is replaced.

**Scope widened after the full render of the valve reports**
([review notes R21](adr/0018-review-notes.md#r21--configuration-data-lives-on-final-control-elements-not-only-instruments--folded-into-adr-0018-8)):
this covers **final control elements too**, not just transmitters. Every valve
report in the source records fail position on loss of input signal, function
(on/off vs modulating), and control/feedback signal types. **Fail position is
the clearest case for the whole collection** — configured once, recorded only in
a vendor PDF, the first thing needed at replacement, and wrong answers have
process consequences rather than paperwork ones.

- **Data model.** New **append-only `instrument_settings`**: `project`, `tag`
  (required), `configured_at`, `configured_by`, `vendor_company` (nullable),
  `input_type`, `range_low` / `range_high` / `range_unit` (the engineering
  range: 0–500 gpm), `signal_low` / `signal_high` / `signal_unit` (the
  electrical span: 4–20 mA), `damping_seconds`, `delay_seconds`,
  `logging_interval`, `setpoints` (text), `firmware_version`, `notes`,
  `superseded_by` (self-relation, nullable), `client_token`; and for final
  control elements `fail_position`, `control_function`, `control_signal`,
  `feedback_signal`.
  `updateRule: null`, `deleteRule: null`. **Not** folded into `calibrations`:
  "what is it set to" and "does it read true" are different facts on different
  cadences (ADR 0016 rejected the analogous flattening).
- **UI.** A capture form on the instrument's tag page (public create, like
  calibrations, so the field tier can log it accountlessly), and a
  current-settings panel on `tag.html` with its full history beneath.
- **Validation.** A reconfiguration is a **new record**; the current settings
  are **derived** as the latest record nothing supersedes — no stored "current"
  flag. `client_token` makes an offline retry idempotent.
- **Turnover.** A **per-tag instrument settings table** in the frozen package
  with provenance (who set it, when, which vendor) — the table that makes a
  replaced transmitter re-configurable from the binder.

### M6.2 — Signature roles and countersignature QC (observation 8)

The contractor countersignature block was blank on every vendor form, and a
"customer" signature line was signed by the wrong party. Nothing listed the
missing countersignatures before the package was compiled.

> **Blocked on [open-questions #5](open-questions.md#5-is-adr-0010-ready-to-accept-and-land).**
> ADR 0010 named required-role semantics as one of its explicitly open gates
> and [D6](DECISIONS.md#d6--adr-0010-signatures--turnover-stays-proposed-and-frozen)
> froze it. This item is the concrete proposal for that gate; it cannot land
> before ADR 0010 is unfrozen and accepted.

- **Data model.** `checklist_templates.required_signature_roles` (text,
  comma-separated role keys), **frozen onto the check** at execution as
  `checks.required_signature_roles` — the same freezing pattern
  `witness_required` already uses. `signatures.signer_role` += `vendor_tech`,
  `subcontractor`, `gc_witness`, `controls_integrator`.
- **UI.** `turnover.html` gains a **missing-countersignature QC list** shown
  *before* the freeze; each signing surface states the role's meaning in plain
  words so a wrong-capacity signature is legible rather than buried.
  `checks.witnessed_by` stays as capture-time attribution — a witness who
  actually attests writes a `signatures` record with role `gc_witness`, which
  carries name, timestamp, and content binding that a text field cannot.
- **Validation.** Missing countersignatures are **derived**: required roles
  minus roles signed against the current `content_hash`. No stored `signed`
  flag (already rejected by ADR 0010). The app records who signed in what
  capacity; it never adjudicates who was entitled to.
- **Required roles come from the GC's template, never from the vendor's paper**
  ([review notes R22](adr/0018-review-notes.md#r22--missing-countersignature-has-two-failure-modes-and-one-has-no-block-to-leave-blank--folded-into-adr-0018-9)).
  The source has two failure modes: a contractor block **left blank** on one
  vendor's form, and on another **no such block at all** — it ends at "inspected
  by". A QC deriving who owes a signature from the attached document would report
  nothing missing for the second and worse case. The list is computed against the
  frozen `required_signature_roles`, independent of any attached document.
- **Print discipline** ([R20](adr/0018-review-notes.md#r20--a-signature-can-sit-on-a-page-that-identifies-nothing--open)).
  In the source, a signed checklist's signature block sits on **its own page**,
  carrying a name, a wet signature, a date — and nothing identifying what was
  signed. Detached from the preceding sheet it attests to nothing. Every page of
  a printed turnover artifact must therefore carry enough identity (package id,
  scope, content-hash prefix) that a separated page stays traceable. This is the
  concrete field justification for ADR 0010's `signed_content_hash`, and it sets
  a bar the free print view must not regress against.
- **Turnover.** A **missing-countersignature QC block** computed before the
  freeze is allowed.

### M6.3 — Phase-entry prerequisite checklists (observation 9)

A clean-water pre-run checklist — tanks cleaned, floats set, permeate recycle
loop configured — gated a whole phase but existed only as a conversation.

- **Data model.** `checklist_templates.gate_for_phase` (select, nullable).
  **No new collection and no new record shape**: a gate is an ordinary check
  with a **system** subject against a gate template. No conditional logic
  inside a template, so hard constraint #5 is untouched.
- **UI.** A system's unsatisfied gate shows prominently on `readiness.html`
  and at the phase's capture entry point.
- **Validation.** A gate for phase P is **satisfied** when the system's latest
  gate check for P folds to pass — derived. **It warns; it never blocks.** This
  is ADR 0007's record-never-authorize principle applied outside safety: a crew
  that runs a phase with an unsatisfied gate has made a decision, and the
  ledger's job is to record visibly that they did. Hard-blocking would also
  strand the field tier whenever the gate is owed by someone off site.
- **Turnover.** Gate checks appear in the manifest as the ordinary system-
  subject checks they are, with their gated phase named.

### M6.4 — Multi-visit continuation chains (observation 10)

"Need to finish startup on mixer and pumps: amp reading, auto/manual,
performance test, FLS testing" is a real end-of-visit state, and the follow-up
visit had no structural link back.

*Already covered — extend, and unpark:* ADR 0012 established the linked-pair
pattern and `checks.resolves` **already ships**; its execution UI was parked by
[D8](DECISIONS.md#d8--openresolve-and-tank-leak-test-uis-are-parked) pending
real demand. Same trigger as M4.3
([D21](DECISIONS.md#d21--d7-and-d8-amended--the-real-job-trigger-fired)); build
the two UIs together.

- **Data model.** `checks.continues` (relation → checks, nullable) and
  `service_visits.continues` (self-relation, added in M4.3). Deliberately
  **distinct from `resolves`**: `resolves` closes a test *expected* to be open
  (a 48-hour leak test, a bac-t sample); `continues` picks up work that was
  supposed to finish and did not. Collapsing them would make "running
  correctly" and "abandoned mid-run" indistinguishable in the standing fold.
- **UI.** An incomplete check or visit offers "continue this work", which opens
  a new record **pre-populated** from the prior one: answered lines carried
  forward as read-only context, unresolved lines presented blank and awaiting
  an explicit state (M5.1). A visit's `open_items` text seeds the follow-up's
  checklist. Both records stay frozen — pre-population is a UI behavior over
  two immutable records, never a copy into storage that could drift.
- **Validation.** `continues` must point at a check on the same subject; a
  chain may not point at itself. The standing fold is unchanged — a
  continuation is an ordinary check whose result folds in normally. The chain
  is provenance, not arithmetic.
- **Turnover.** Continuation chains render as a single work thread with each
  visit's date and outcome, so an incomplete first visit never reads as an
  abandoned one.

**M6 definition of done (testable)**
- [ ] ADR 0010 is Accepted (or M6.2 is deferred) — see open question #5.
- [ ] An instrument's configured span/range/setpoints capture from a phone,
      appear as current settings on the tag page, and a reconfiguration
      appends without editing the prior record.
- [ ] A package with a required role unsigned lists that role as missing
      before the freeze.
- [ ] A gate template's unsatisfied gate warns on `readiness.html` and does
      not prevent a check.
- [ ] An incomplete check opens a pre-populated continuation linked by
      `continues`; both records remain immutable.
- [ ] Migrations apply to a fresh DB; smoke test extended; docs updated;
      tagged v1.3.0.

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
- ~~**Vendor field service visit UI (ADR 0017)** — parked; schema frozen.~~
  **Unparked 2026-08-04** — promoted to **M4.3**; D7's "a real job requests it"
  trigger fired ([D21](DECISIONS.md#d21--d7-and-d8-amended--the-real-job-trigger-fired)).
- ~~**open→resolve / tank leak-test UI (ADR 0012)** — parked; build on real
  demand.~~ **Partly unparked 2026-08-04** — the continuation-chain half is
  **M6.4** (D21); the *tank leak-test* execution UI stays parked until a real
  tank/duration-test job needs it (D8 otherwise stands).
- **Cross-product handoff manifests / lifecycle events** — blocked on a portable
  identity scheme (open-questions #4); `docs/ecosystem-contracts.md` stays
  PROPOSED and non-binding.

## Explicitly not planned (permanent)

Forms designer / conditional checklists · stored status fields · npm, build
steps, CDNs in the app · vendor API integrations · being an ERP · any
energy-control decision support in the LOTO module · a per-project phase table
· vendor-facing accounts or portals · hard-blocking a phase on an unsatisfied
gate (ADR 0018 §§1, 5, 12). See `ARCHITECTURE.md` §7 (rejected ideas).

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
| 5 | Accept ADR 0010? | **Resolved** (2026-08-04) — **Accepted**; the golden vector was a `console.log` and is now enforced + tested ([D26](DECISIONS.md#d26--adr-0010-accepted-the-golden-vector-was-not-a-test-until-it-was-made-one)) |
| 6 | Auth access matrix | **Resolved** — ADR 0011 Accepted |
| 7 | API v1 reconciliation | **Scheduled** — M3 ([D12](DECISIONS.md#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10)) |
| 8 | Offline guarantee | **Doc now, code deferred** ([D13](DECISIONS.md#d13--offline-document-guarantees-now-build-no-second-queue)) |
| 9 | Min free turnover artifact | **Open** — no longer *blocked* by #5 (now resolved), but not decided by it either; principle recorded (B5) |
| 10 | Deployment topology | **Doc now** (label honestly), Pi validation M3 ([D14](DECISIONS.md#d14--deployment-topology-labeling)) |
| 11 | Startup phase vocabulary | **Open, likely closeable** — ADR 0018 §1's two additive phases match the source sequence exactly; the dry-check and I/O-check reports map cleanly onto the existing four |
| 12 | Asset vs. position identity | **Resolved** (2026-08-04) — an appended `equipment_events` fact + derived re-verify marker; no second identity. Asset-history tracking is a conscious loss ([D27](DECISIONS.md#d27--the-asset-behind-a-position-is-an-appended-event-not-a-second-identity)) |
| 13 | Turnover hash versioning | **Resolved** (2026-08-04) — one fold inside `sha256-canon-v1`, no v2; partial folds forbidden ([D25](DECISIONS.md#d25--d6-amended--the-turnover-manifest-folds-into-sha256-canon-v1-now)). Precondition still live: no signed package may exist when it ships |

**Unresolved for the maintainer to answer eventually** (not blocking M1): #3
(preservation ownership) and #4 (identity scheme) both need a maintainer/domain
decision before the corresponding work can start; the roadmap parks that work
until then. #11–#13 came out of the 2026-08-04 field-observation review and
gate the M4–M6 track, not M1–M3 — but **#5 and #13 are cheapest to answer
now**, before any real turnover package is signed.

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
