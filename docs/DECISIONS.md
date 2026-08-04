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
**Gap confirmed, built (2026-08-02).** `system.html` and `project.html` carried
open A/B/C **counts** only — no item listing, no print, no export — and
`readiness.html` did not read `punch_items` at all, so all three deliverables
were missing. Built as a new `pb_public/punchlist.html` taking `?project=` or
`?system=`, rather than a report mode bolted onto two navigation pages.
**Cross-ref.** task `090` (DONE); `ARCHITECTURE.md` UI section.

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

---

## Session 2026-08-04 — multi-vendor startup field-observation review

Decisions D20–D24 come from reviewing a full compiled vendor startup report
package (equipment vendor forms, field service reports, I/O check reports,
clean water test checklists) from a multi-vendor plant startup against what
LoopCheck can currently record. Ten gaps came out of that review; the
structural answers are in
[ADR 0018](adr/0018-multi-vendor-startup-evidence-model.md) (*proposed*) and
the sequenced work is the M4–M6 track in [ROADMAP.md](ROADMAP.md).

### D20 — The multi-vendor startup track is post-1.0 (M4–M6)
**Decision.** The ten field observations become **M4 (v1.1.0)**, **M5
(v1.2.0)**, and **M6 (v1.3.0)**, sequenced **after** M3/v1.0 — they do not
preempt or reorder M1–M3. Priority *within* the track follows observed pain:
staged per-tag-per-phase lifecycle, ball-in-court punch items, and vendor
evidence first (M4); explicit line resolution, typed values, and tag validation
second (M5); instrument configuration, signature QC, phase gates, and
continuation chains last (M6).
**Rationale.** Three reasons, in order of weight. (1) [D2](#d2--trust-before-features-m1-comes-first)
already fixed trust-before-features and M1–M3 are the trust work. (2) Three of
these items make **breaking changes to v1-published collections**
(`punch_items.assigned_party` most sharply), and
[D12](#d12--api-v1-reconciliation--version-bump-sequenced-to-m3-v10) sequences
the API v1 reconciliation to M3 — doing the reconciliation first makes the
breaks clean instead of compounding. (3) v1.0's bar
([D19](#d19--v10-stranger-ready-bar)) is "a stranger can adopt this," and a
stranger adopting a schema mid-revision is the worse outcome.
**Rejected.** Interleaving M4 items into M2/M3 to get the vendor evidence
ledger sooner — it would put a breaking enum change ahead of the contract
reconciliation that makes it survivable.
**Cross-ref.** ADR 0018; ROADMAP "The multi-vendor startup track".

### D21 — D7 and D8 amended — the "real job" trigger fired
**Decision.** [D7](#d7--preservation-adr-0015-and-vendor-visits-adr-0017-uis-are-parked)
parked the **vendor field service visit UI** (ADR 0017) and
[D8](#d8--openresolve-and-tank-leak-test-uis-are-parked) parked the
**open→resolve UI** (ADR 0012) until a real job asked for them. A real
multi-vendor startup asked for both. Both are **unparked** and scheduled:
vendor visits as **M4.3**, the continuation-chain half of open→resolve as
**M6.4**. The rest of D7 and D8 stands — **equipment preservation (ADR 0015)
stays parked** (its ownership boundary vs TrenchNote is still open,
open-questions #3), and the **tank leak-test execution UI stays parked** until
a real tank/duration-test job needs it.
**Rationale.** D7/D8 were not "never"; they named a trigger condition
precisely so a future session would know when to build. Amending them on the
stated trigger is the mechanism working, not a relitigation.
**Cross-ref.** ADR 0017, ADR 0012, ADR 0018 §§5, 10.

### D22 — Ambiguity is legal at capture and illegal at signature
**Decision.** A checklist line may still be submitted unanswered — the record
of a crew getting pulled off is worth more than no record. But a check may not
be **signed**, and a scope may not be **frozen** into a turnover package, while
any included line carries a blank result. The gate lives at signature and
freeze, not at capture.
**Rationale.** This is the one requirement that pulls directly against a
shipped, deliberate behavior (ARCHITECTURE §6 records unanswered lines on
purpose). Both concerns are legitimate and they apply at different moments:
hard constraint #1 owns the capture moment; the evidence promise owns the
deliverable. Blocking submission would trade a recoverable partial record for
no record at all — the worse failure on a dead-zone phone.
**Rejected.** Requiring every line before submit; leaving blanks legal all the
way into a frozen package.
**Cross-ref.** ADR 0018 §4; ROADMAP M5.1.

### D23 — No fifth response type, no per-project phase table, no vendor accounts
**Decision.** Three requirements are answered **inside** existing constraints
rather than by relaxing them:
- **Typed values with expected ranges** are metadata on the existing `value`
  response type (`expected_min` / `expected_max` / `expected_text` /
  `comparison` on `template_items`, frozen onto `check_items`), **not** a
  fifth response type. Hard constraint #5 stands.
- **Per-project configurable phases** are configured by the project's template
  library, not by a per-project `phases` collection. A stored phase map is the
  same drift `ARCHITECTURE.md` §7 already rejects for required phases; the
  shared enum gains `wet_commissioning` and `process_seeding` additively.
- **Vendor participation** is never solved by giving vendors accounts, a
  portal, or an integration. Vendors use their own paper; LoopCheck is the
  GC's master ledger that indexes it. ADR 0017 already rejected the adjacent
  vendor-scheduling/contract/billing scope.
**Rationale.** Each of the three had an obvious constraint-relaxing answer and
a slightly less obvious constraint-preserving one that is as good or better.
Recording the reasoning stops a future session from taking the easy version.
**Cross-ref.** ADR 0018 §§1, 5, 7; CLAUDE.md constraints #3, #5.

### D24 — Phase-entry gates warn; they never block
**Decision.** A phase-entry prerequisite checklist is an ordinary check with a
system subject against a template flagged `gate_for_phase`. An unsatisfied gate
shows prominently and **does not prevent** anyone from running the phase.
**Rationale.** ADR 0007's principle — the app records, it never authorizes —
generalizes beyond safety. A crew that runs a phase over an unsatisfied gate
has made a decision, and the ledger's job is to record visibly that they did.
A hard block also strands the field tier the moment a gate item is owed by
someone who is not on site, and it is the first step toward the workflow-
engine scope LoopCheck refuses to become.
**Rejected.** Hard-blocking phase entry; a dedicated `gates` collection (a
gate is a check).
**Cross-ref.** ADR 0018 §12; ADR 0007.

### D25 — D6 amended — the turnover manifest folds into `sha256-canon-v1` now
**Decision.** ADR 0018's eight hash-affecting manifest additions land in **one
pass, into `sha256-canon-v1`**, before any real package is signed — not behind a
`sha256-canon-v2`. D6 is **amended, not reversed**: the canonical form and
manifest allowlist are unfrozen for this fold, while ADR 0010's *acceptance*
stays blocked on its own gates (the "not a qualified e-signature" wording C4,
required-role semantics, and the D12 contract bump). ADR 0010 stays **Proposed**
with a completed allowlist. Partial folds are forbidden — each addition alone
changes the canonical bytes, so piecemeal shipping means several silent breaks
instead of one deliberate one. The golden vector is regenerated as the
acceptance test.
**Precondition.** The builder and canonicalizer are already shipped and running,
so this is a code change. **Confirm no `turnover_packages` record carrying real
signatures exists on any live instance before the fold lands.** If one does, the
decision inverts and the additions go behind `sha256-canon-v2`; a signed package
that stops verifying is the outcome the ADR exists to prevent. Test packages are
discarded, not migrated.
**Rationale.** A hash version exists to protect history, and there is no history
to protect. A v2 carrying additions no v1 package ever saw would leave a version
boundary that records nothing. D6's own reasoning — that hash semantics are hard
to change once real records exist — argues *for* completing the allowlist now,
because the allowlist is exactly the thing that becomes unchangeable. D6
conflated the canonical form with acceptance of the ADR; they are separable, and
only one of them gets more expensive with delay.
**Rejected.** Accepting ADR 0010 wholesale (its legal and contract gates are
untouched by this work); minting `sha256-canon-v2` (no history to protect).
**Cross-ref.** ADR 0018 §15 and open question 5; ADR 0010; D6, D12.
