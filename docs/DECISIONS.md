# LoopCheck — Decision log (roadmap, scope & sequencing)

**What this file is.** A lightweight, append-only log of **roadmap, scope,
sequencing, and cut** decisions — the questions a future agent should not
relitigate. Newest decisions carry the highest `D` number.

**What this file is NOT.** It does not replace or duplicate the ADRs. Structural
decisions (schema shape, enforcement rules, library mechanics) live in
`docs/adr/` and are the authority for *how* something is built. This log records
*what we chose to build, in what order, and what we deliberately are not
building*, and cross-links the relevant ADR where one exists. Unresolved
architecture questions live in [`open-questions.md`](open-questions.md); this
log records the ones that have been **decided**.

**Precedence.** When any doc disagrees with reality, the code is truth and the
doc is a bug (the docs-as-code rule in `CLAUDE.md`). Among docs: `CLAUDE.md`
holds the constraints, `docs/adr/` holds structural decisions, this file holds
scope/sequencing decisions, `docs/ROADMAP.md` holds the sequence.

---

## Session 2026-07-21 — roadmap planning session

Decisions D1–D19 were made in a planning session with the maintainer on
2026-07-21. They set up the roadmap in `docs/ROADMAP.md` and the task files in
`docs/tasks/`.

### D1 — Milestone structure and version mapping
**Decision.** Milestones are named by goal, each mapped to a semver tag. The
first tagged release is **v0.9.0** (the product is feature-broad but has never
been tagged, hardened, or validated). `v1.0.0` is the "a stranger can adopt and
self-host this" release. Milestones: **M1 Harden & Reconcile (v0.9.0)** → **M2
Shutdown Runbooks + Punch List (v0.10.0)** → **M3 Stranger-Ready (v1.0.0)**, then
post-1.0 planned modules and a Later/Ideas parking lot.
**Rationale.** Calling the first milestone "v0.1" would misrepresent a nearly
feature-complete product; the maintainer already proposed v0.9.0 in the auth
work (SESSION-NOTES). Naming by goal keeps definitions-of-done testable.
**Rejected.** Starting the version line at v0.1.0.

### D2 — Trust before features (M1 comes first)
**Decision.** No new feature work lands before M1 (Harden & Reconcile) is done.
M1 = expand the smoke test, add a browser/UI test, reconcile the docs to a
single source of truth, and validate deployment — gated by CI.
**Rationale.** The maintainer will not deploy on a real job until the existing
breadth is trustworthy. The features exist; the trust plumbing does not.
**Rejected.** Shipping features (Phase 4) before hardening.

### D3 — `docs/DECISIONS.md` scope
**Decision.** This file logs roadmap/scope/sequencing/cut decisions only, and
cross-links ADRs rather than duplicating them. The daily-driver workflow reads
`CLAUDE.md`, `docs/ROADMAP.md`, and this file.
**Rationale.** A second heavyweight decision store would drift against
`docs/adr/`. Single source of truth (M1 goal) applies to our own process too.

### D4 — No duplicate `docs/ARCHITECTURE.md`
**Decision.** The root `ARCHITECTURE.md` stays the single authoritative
architecture document. We do **not** create `docs/ARCHITECTURE.md`.
**Rationale.** A parallel architecture doc is exactly the drift M1 exists to
eliminate. ROADMAP and CLAUDE point at the root file.

### D5 — `AGENTS.md` becomes a thin pointer to `CLAUDE.md`
**Decision.** `AGENTS.md` (currently a full, and now stale, parallel copy of
`CLAUDE.md` for Codex sessions) is reduced to a short pointer that directs any
agent to `CLAUDE.md` as the single source, keeping only genuinely
Codex-specific notes if any remain.
**Rationale.** Two full copies of the constraints guarantee drift; `AGENTS.md`
already lags (it still calls Phase 6 a LoopCheck module, still says "sixteen
collections", references a `.Codex/` path). Executed as a task in M1.
**Cross-ref.** Task `010`.

### D6 — ADR 0010 (signatures & turnover) stays Proposed and frozen
**Decision.** The shipped signature/turnover code keeps running, but ADR 0010
stays **Proposed**; no new signature/turnover work happens this cycle. The
open gates are recorded so a future agent does not casually "finish" it:
golden-vector/canonicalization tests, required-role semantics, and legal
wording ("not a qualified e-signature"). Revisit before external users.
**Rationale.** Accepting it now hardens hash/attestation semantics that are
hard to change once real records exist; there is no user pressure to decide.
**Cross-ref.** ADR 0010; open-questions #5 and #9 stay open.

### D7 — Preservation (ADR 0015) and Vendor Visits (ADR 0017) UIs are parked
**Decision.** Both ADRs are Accepted and their schema shipped, but **no UI is
built** for either until a real job requests it. The schema stays frozen
(maintenance-only). They are not roadmap milestones.
**Rationale.** Accepted-ADR-plus-shipped-schema-plus-no-UI is latent scope that
dilutes focus; parking it explicitly stops an agent from building it unprompted.
Preservation additionally has an unresolved ownership boundary vs TrenchNote.
**Cross-ref.** ADR 0015, ADR 0017; open-questions #3 (preservation ownership).

### D8 — open→resolve and tank leak-test UIs are parked
**Decision.** The pending→resolve execution flow (ADR 0012) and the tank
leak-test UI stay unbuilt until a real tank/duration-test job needs them. Schema
stays frozen. The open→resolve *pattern* remains a general-purpose, accepted
part of the schema.
**Rationale.** Same as D7 — proven in schema, no demand yet.
**Cross-ref.** ADR 0012.

### D9 — Service cutover stays in LoopCheck, semantics frozen
**Decision.** The Service Cutover Tracker remains LoopCheck-authoritative and
fully supported. Its semantics are **frozen**: no new service phases, no
customer-notification automation, no second cross-product master. A future move
to a sibling requires feature parity there plus a lossless migration; no
dual-write.
**Rationale.** It works and has real value; no sibling is ready to take it;
moving it now would strand users and evidence.
**Cross-ref.** ADR 0006; open-questions #1.

### D10 — Segment acceptance is owned by MainLine (correction of record)
**Decision.** Linear/segment acceptance is **not** LoopCheck's bounded context;
it belongs to **MainLine** as a future module (maintainer decision 2026-07-18,
ADR 0014 superseded). The shipped LoopCheck segment schema slice (migrations
`…23`–`…25`, `…33`) stays frozen, maintenance-only. **No segment execution UI,
import, board, QR route, or acceptance package is built in LoopCheck.** Several
docs still incorrectly name "LineCheck" as the owner; correcting them is an M1
task.
**Rationale.** MainLine already models alignments, stations, and append-only
test ledgers with derived acceptance. LineCheck is archived.
**Cross-ref.** ADR 0014 (superseded); task `010`.

### D11 — Portable identity scheme deferred
**Decision.** Do not choose a cross-product portable identity/deployment/project
id scheme yet. The roadmap flags it as the gate before the first real
cross-product handoff or import.
**Rationale.** No real users and no cross-product handoff exists; choosing now
mints permanent identifiers that cannot be taken back.
**Cross-ref.** open-questions #4; `docs/ecosystem-contracts.md` (stays PROPOSED,
non-binding).

### D12 — API v1 reconciliation / version bump sequenced to M3 (v1.0)
**Decision.** The formal API contract version bump for the added collections and
the auth/PII semantics is done in **M3 (Stranger-Ready)**, not M1. M1 only makes
the *documentation* of the current collection set truthful.
**Rationale.** It is the backbone of stable release discipline and the sidecar
contract, but it needs care and is not a field-trust blocker. `docs/API.md`
already documents the delta honestly.
**Cross-ref.** ADR 0003; open-questions #7.

### D13 — Offline: document guarantees now, build no second queue
**Decision.** Publish honest, per-workflow offline guarantees as part of the M1
docs reconciliation (only LOTO is durable; batch-notice is tab-local; everything
else is online-required). Do **not** build a general offline app-shell or a
second durable write queue this cycle.
**Rationale.** A half-built offline layer is more dangerous than honest
"online-required" labeling; a durable queue needs an idempotency decision first.
**Cross-ref.** ADR 0007; open-questions #8.

### D14 — Deployment topology labeling
**Decision.** Label LAN and single-VPS as **supported** documented options and
Pi + primary/replica as **unvalidated** until exercised. The M1 deploy
validation proves the ARM binary path on a cloud VM; real Pi validation is an
M3 item.
**Rationale.** Cheap honesty fix; avoids presenting aspirational topology as
tested.
**Cross-ref.** open-questions #10; ROADMAP Raspberry Pi track.

### D15 — CI runs both locally and in GitHub Actions
**Decision.** The automated gate is **both** a hardened `.githooks/pre-push`
local gate (fast, offline) and a GitHub Actions workflow (remote backstop) that
fetches PocketBase and runs the smoke + browser tests.
**Cross-ref.** task `050`.

### D16 — Browser test tooling is dev-only and isolated
**Decision.** The browser/UI smoke test may use a headless-browser tool
(Playwright is the default choice) as a **dev-only, git-ignored** dependency,
invoked from `scripts/`, **never** vendored into `pb_public/`, never part of the
app runtime, and never affecting the no-build-step field tier. If any objection
arises to introducing a Node/dev dependency at all, the task stops and asks the
maintainer before proceeding.
**Rationale.** Hard constraint #3 (no build step) governs the *app*, not dev
tooling; but the boundary must be explicit so the tooling never leaks into the
shipped product.
**Cross-ref.** task `040`.

### D17 — Punch List report (idea B1) adopted into M2, pending gap-confirmation
**Decision.** A project/system Punch List report (print-friendly board + free
CSV, across A/B/C severity) is adopted into M2. The implementing task must first
confirm the roll-up/export does not already exist before building it.
**Rationale.** It directly serves LoopCheck's second core question ("what punch
items are blocking this system?") and is high-value per effort. It must stay
free-tier (never paywalled).
**Cross-ref.** task `090`.

### D18 — Parked and rejected ideas (do not re-propose without new evidence)
- **B2 "Walk the system" batch-check mode** — PARKED to Later/Ideas. Useful, but
  overlaps the Phase 4 glove-sized UI ergonomics; revisit after M2 proves the
  pattern.
- **B3 Field-tier offline app-shell (service worker)** — REJECTED this cycle,
  parked behind the offline-guarantee decision (D13). Half-built offline is worse
  than honest online-required; TrenchNote hit painful SW/IndexedDB issues.
- **B4 Ledger-integrity / provenance view** — PARKED. Overlaps the frozen
  signatures/hash work (D6); building it pre-commits hash semantics.
- **B5 Free JSON turnover manifest export** — ADOPTED in principle but DEFERRED
  with ADR 0010 (D6); it is the open-core keystone (paid PDF becomes
  presentation-only) but is coupled to the frozen turnover work.
**Rationale.** Recorded so future ideation passes don't re-surface them as new.

### D19 — v1.0 (Stranger-Ready) bar
**Decision.** M3/v1.0 requires all of: a getting-started onboarding path with
screenshots; stable release discipline (semver tags, CHANGELOG, documented
upgrade path, API v1 reconciled and versioned per D12); Raspberry Pi validation
on real hardware; and an accessibility + field-device + offline-honesty polish
pass across all pages (not just LOTO).
**Rationale.** These are the gaps between "the maintainer can run it" and "a
stranger can adopt and self-host it."
