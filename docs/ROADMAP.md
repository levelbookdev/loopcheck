# LoopCheck — Roadmap

What's built, what's next, and where the line between free and paid sits.
Companion to [ARCHITECTURE.md](../ARCHITECTURE.md) (how it's built) and
[CLAUDE.md](../CLAUDE.md) (the constraints). Dates are intentionally absent —
this is a sequence, not a schedule. The maintainer builds this around a
full-time construction job; sequence is the honest promise.

## The one-sentence strategy

The field tier — scan, see status, flag punch items, log checks — is AGPL and
free forever; office deliverables *derived from* that ledger (compiled
turnover packages, notifications, dashboards) are the future paid tier, built
as a separate sidecar application on the public API, never inside this repo.

## Phase 0 — housekeeping (before Phase 2 work starts)

- [x] **Reconcile `pb_migrations/` seed to `seed/`** — done 2026-07-09: enum
      renames, the fourth response type, `unit` / `confirm_per_spec` fields
      landed; the seed migration is now a loader reading `seed/` directly, and
      the required-phases map is derived from the template library
      (ARCHITECTURE.md §9 records the mechanics).
- [x] **Adopt the core/premium boundary formally** — done 2026-07-09:
      [ADR 0003](adr/0003-core-premium-sidecar-boundary.md) (sidecar on the
      public REST API, ported from TrenchNote's ADR 0011) and the
      [API contract](API.md). Premium talks to PocketBase's REST API like
      any third party, no private doors, capabilities premium needs land in
      core first.
- [x] **CONTRIBUTING.md with the CLA/DCO requirement** — done 2026-07-09,
      recorded before the first outside patch, same reasoning as
      TrenchNote's.
- [x] Small schema additions that later phases silently depend on — done
      2026-07-09 for the capture-side set (Migration A, ADR 0002):
      `tags.area` + five more instrument-index fields,
      `systems.planned_startup`, witness-required flags. Punch-to-check
      linkage and the `test_equipment` registry are **Migration B**, which
      waits for Phase 0 review and lands with Phase 2 (see
      [DATA_MODEL_PLAN.md](DATA_MODEL_PLAN.md)).

## Phase 2 — check execution (the ledger goes live) — built

The core promise, closed: a tech standing at the equipment logs a checklist
run from the tag page, and the tag page reads the ledger back.

- [x] Check-execution UI (`check.html`): template → answered line items →
      append-only `checks` + `check_items`, derived result, frozen prompts /
      witness / test-equipment note, punch evidence links (ADR 0004).
- [x] Tag status derived from the ledger against the required-phases map
      (any pass wins — same rule as service cutover standing).
- [x] Check history on the tag page; printable single-check view
      (`check_view.html`) rendering the frozen record.
- [x] Free per-tag CSV export — client-side, the whole ledger back out. A
      crew that can log a check can always get its record back out.

## Warranty & closeout module — built

Landed alongside Phase 2 ([ADR 0005](adr/0005-warranty-closeout-clock-start-provenance.md))
because the closeout spreadsheet dies the day the PM rolls off — and the
same QR that carried a tag through checkout should answer, for the rest of
the plant's life: *is this under warranty, who do I call, where are the
spares?* First LoopCheck surface aimed at the owner/operator as much as
the contractor.

- [x] Four collections: `warranties` (basis + trigger date + duration —
      the end date is derived, never stored), `closeout_requirements`
      (workflow state), `closeout_log` (append-only trail behind it),
      `warranty_claims` (close-once ledger).
- [x] Tag-page section: derived warranty badge, tap-to-call vendor,
      deliverables checklist, open/close claims at the equipment.
- [x] Closeout dashboard (tags × requirement types, completion % by
      system), warranty timeline (soonest expiration first, ≤90 days
      flagged), print-friendly Warranty Log & Closeout Package.
- [x] CSV import mode for migrating an existing closeout spreadsheet.
- **No expiry alerts in core, by design**: an alert is a derivation of
  facts everyone already has (`clock_start_date`, `duration_months`,
  today). Email/notification alerts are a future **hosted-tier** feature;
  the free answer is the timeline page. Same boundary as the compiled
  PDF package — the print-friendly HTML view is free, the compiled,
  hyperlinked PDF deliverable ships with the paid deliverables phase.

## Instrument Calibration Records — built

Purpose-built rather than forced through the flat checklist engine
([ADR 0016](adr/0016-purpose-built-instrument-calibration-records.md)): a loop
check proves the signal path; calibration proves the instrument reads true and
must preserve the paired as-found/as-left values plus the test standard's own
certificate provenance.

- [x] Editable `test_standards` registry with certificate attachments and a
      fixed 14-day expiring-soon highlight.
- [x] Append-only `calibrations` + `calibration_points`, saved atomically with
      frozen standard identity/cert due date and idempotent offline retry.
- [x] An expired standard warns loudly but never blocks capture; the server
      freezes `standard_expired_at_use=true`, rendered red in tag history and
      the project board.
- [x] Phone capture with five-point flow and three-point level/pressure
      defaults, durable offline outbox, paired as-found/as-left entry, and an
      optional certificate/report attachment.
- [x] Instrument-only tag badge (current / due within 30 days / overdue / never)
      and overdue-first project view. `next_due` is derived from performed date
      + interval months, never stored.
- **Open-core boundary:** capture, badges, registry, history, attachments, and
  project due view stay free. The formatted calibration-sheet section of a
  compiled turnover-package PDF belongs to the paid deliverables sidecar; all
  source facts remain available through core.

## Service Cutover Tracker — built

Landed alongside Phase 2 ([ADR 0006](adr/0006-service-connections-third-subject.md)):
on a waterline replacement job the schedule and the PR risk live in the
services, not the pipe, and "can we prove customer N was noticed before we
shut their water off" is a dispute that a timestamped, photographed
door-hanger log ends. First non-equipment check subject — the deliberate
pilot for Phase 5 locations and Phase 6 segments.

- [x] `services` collection; checks and punch items take a service as their
      subject (exactly-one rule extended server-side); six service phases
      seeded as `subject_kind='service'` templates from
      `seed/service_templates.json`.
- [x] Service page at `/s/{id}` (derived phase standing, check ledger,
      punch flow); cutover board ordered by station with derived phase
      chips and the stuck-phase / open-punch / "noticed but not tied over
      > N days" filters; print-friendly board CSS.
- [x] Service CSV import (address/station/account/customer/meter/size,
      forgiving synonyms, duplicate-safe re-import).
- [x] Batch notice mode: walk the block, one notice check per service,
      each with its own door-hanger photo; per-row retry keeps a dead
      spot from losing anything.
- [x] Optional meter-box QR labels on the existing label sheet.
- **PII rule**: customer name/phone never render on public pages and never ride
  in URLs or QR codes. Migration `1789000020` moved them into auth-gated
  `service_contacts` and removed them from public `services`; protection is now
  structural rather than a `fields=` convention. The service importer/client
  auth reconciliation remains unfinished at the current snapshot.
- **Paid-tier boundary**: the compiled district-facing **Cutover Status
  Report** (per-service status, outage durations, notice-evidence index)
  and any customer-notification automation are sidecar deliverables; the
  free tier keeps the full field workflow and the print-friendly board.
- **Future work, recorded honestly**: a true offline queue for the field
  tier (batch notice today holds state client-side and retries per row —
  resilient to dead spots, but not a queue that survives closing the tab).

## LOTO Status Board — built

Landed alongside Phase 2 ([ADR 0007](adr/0007-loto-visibility-staleness-asymmetry.md)):
during commissioning the plant is half-live — some systems energized, some
locked out, multiple trades working around each other — and the QR code
already on every piece of equipment should answer, before anything else,
*is this locked out, by whom, since when*. Scan the thing before you touch
the thing.

- [x] `loto_events` — append-only apply/release ledger, same immutability
      enforcement as checks. Lockout state is derived (an apply with no
      release referencing it); group LOTO shows every active lock.
- [x] Tag-page banner above everything else; apply flow that demands the
      photo of the hung lock (atomic, server-enforced); release flow that
      demands picking the lock and justifying a holder-mismatch release.
- [x] Project board: active locks by system, oldest first, lock age
      visible (old locks are how equipment gets forgotten in a half-state).
- [x] The staleness asymmetry (the ADR's core): event logging queues
      offline and syncs later; displayed status never pretends — amber
      "STATUS MAY BE STALE" past 10 minutes, "No locks recorded as of
      {time}" instead of any affirmative all-clear, no green state.
- **Never part of the energy-control decision**: no interlocks, no release
  permissions, no "safe to work" indicators — rejected permanently
  (ARCHITECTURE.md §7). The app records; the written procedure decides.
- **Free tier permanently — safety visibility is never paywalled.**
  Future hosted-tier work is derivation on top: notification digests
  ("lock active > 7 days on RAS-PMP-2"), cross-project boards.

## Phase 3 — signatures and turnover (built; ADR 0010 pending formal acceptance)

The implementation is committed and review-hardened; ADR 0010 stays **Proposed**
only on the formal contract decision (the two collections sit as `delta` in
[API.md](API.md)) and auth-lockdown finalization (ADR 0011).

- [x] `turnover_packages` + `signatures` — two append-only collections. A
      package is a **frozen snapshot** (manifest + standing verdict +
      `sha256-canon-v1` content hash), assembled **server-side** in `pb_hooks`
      (`POST /api/turnover/build`) so a client can't forge the manifest; a
      re-issue supersedes the prior package for its scope.
- [x] `sign.html` — auth-gated signing of a package or a check: typed name is
      the signature, optional drawn mark, per-role frozen statement, and the
      "not a qualified e-signature" caveat (review C4).
- [x] `turnover.html` — the free print-friendly board: build packages, current
      vs superseded marking, per-package signatures + outstanding roles + drift
      warning, and the **ready-to-witness** list (checks with `witness_required`
      and no witness signature yet — review C5).
- [x] `lc-auth.js` + `login.html` — the shared auth helper the signing flow
      needs (ADR 0011 §6): token + `auth-refresh`, `?next=` preserved.
- The *compiled* multi-hundred-tag hyperlinked turnover binder stays the
  flagship **paid** deliverable; the free tier prints the HTML board.
- **Still open:** the broader ADR 0011 frontend re-plumb of the existing office
  pages, and the formal API-contract version bump for the two collections.

## Phase 4 — shutdown runbooks

Execution UI for the tie-in shutdown runbook already captured in `seed/`.
UI bar (decided): zero navigation taps, glove-sized targets — used at 2 AM,
in rain, under schedule pressure.

## Phase 5 — recurrence and location subjects

Compliance logs (chlorine residuals, SWPPP walks) from the seeded templates.

## Phase 6 — segment acceptance (schema/library built; execution and ownership open)

The additive foundation has landed: `segments` is the fourth check subject,
the pressure/gravity phase enums and templates are seeded, and pending checks
can resolve through a later linked check (`1789000023`–`1789000025`). The
segment import, page, board, QR route, open→resolve execution flow, and
acceptance package are **not built**.

This scope now overlaps the local LineCheck repository's explicit pressure-test
and linear-acceptance mission. Do not continue LoopCheck segment UI work until
the maintainer decides future ownership and migration strategy; see
[`product-boundary.md`](product-boundary.md) and
[`overlap-and-migrations.md`](overlap-and-migrations.md).

Deliverable: a per-segment acceptance package (hydro + disinfection +
passing bac-t = segment accepted), generated by the same PDF engine.
Deeply W/WW-specific with near-zero competition; ships as a module of the
commissioning tool, not a standalone product.

Design input recorded on the append-only constraint (CLAUDE.md): a bac-t
sample is the one record whose result is pending an external party — the
lab result arrives as an appended event, never an edit, and a failed
sample loops back to re-flush/re-chlorinate as new records.

## Raspberry Pi validation (parallel track — deferred 2026-07, hardware shortage)

Self-hosting on a Pi in the commissioning trailer is a core promise (hard
constraint #3: "must run well on a Raspberry Pi server"), and it stays one.
The maintainer's Pi order is caught in a supply shortage (weeks out), so the
**hardware validation** is deferred — deliberately, and without anxiety,
because the Pi was never a build dependency:

- PocketBase ships official `linux/armv7` and `linux/arm64` binaries;
  `scripts/setup.sh` has detected both architectures since the first commit.
- Everything that makes a Pi viable is enforced by construction, not by
  testing: single binary, embedded SQLite, kilobyte pages, no build step,
  no CDN. The hardware test confirms the bet; it does not place it.

**Interim step (cheap, do before the Pi arrives):** run the acceptance list
below on an ARM cloud VM (Hetzner CAX11 / AWS Graviton / Oracle free-tier
Ampere). That exercises the one thing the x86 droplet cannot — the actual
ARM binary path — for a few dollars.

**Acceptance criteria (the Pi test, one evening when hardware lands):**

- [ ] Fresh Pi OS: `git clone` + `scripts/setup.sh` fetches the right
      binary (test armv7 *and* arm64 userlands if practical).
- [ ] First `serve`: all migrations + the seed library apply cleanly.
- [ ] DEPLOY.md Option A followed **verbatim** (systemd unit); survives a
      reboot and a pulled power cord.
- [ ] Seeded demo (`scripts/seed_demo.sh`): tag page reachable from a phone
      over LAN Wi-Fi in ~1 s; the 60-label QR sheet renders and prints.
- [ ] A handful of simultaneous phone scans plus a check submission — no
      SQLite lock trouble at trailer-crew concurrency.
- [ ] Stop-copy-start backup per DEPLOY.md, restore verified on another box.
- [ ] Update DEPLOY.md with anything the hardware teaches; note the tested
      Pi model + OS in the doc.

Until then, the $6 droplet remains the reference deployment and nothing
else in this roadmap waits on this track.

## Auth reconciliation (parallel track, before internet exposure)

The selective backend lockdown and service-contact PII split have landed
(`1789000019`/`1789000020`), even though ADR 0011 still says Proposed. The
required next work is reconciliation, not a blanket lockdown: committed office
pages must consistently authenticate, `segments` must receive the intended
rule tier, the service importer must write protected contacts, and the smoke
test must assert the full access matrix. Public field reads and the deliberate
accountless check/punch-flag/LOTO paths remain load-bearing.

## The paid tier (separate repository, sidecar)

Bindery LoopCheck exists locally as a separate read-only sidecar with its own
database and weekly readiness workflow. Further office-facing modules remain
planned: notifications (including warranty-expiry alerts) and compiled
deliverables (the turnover binder and compiled Warranty Log & Closeout
Package). Per the boundary ADR, paid software can never
gate, degrade, or be required for any field workflow; a LoopCheck instance
with zero paid code present is the fully supported product; and any schema
the paid tier needs lands *here*, AGPL, for everyone, first.

## Explicitly not planned

Forms designer / conditional checklists · stored status fields · npm, build
steps, CDNs · vendor API integrations · being an ERP. See ARCHITECTURE.md §7.
