# LoopCheck — Data Model Plan

Maintainer planning document (fine to commit to the repo — it proposes core
schema, which is public business). Reviews the shipped Phase 1 schema against
every planned premium module and answers one question per module: **can the
paid sidecar build this from the ledger as-is, and if not, what must land in
core first?**

> **Revision 1 (2026-07-09):** validated against a real contractor startup
> forms package and startup-organization guide (kept private; see
> "Validation against real forms" below). Adds G10–G12, extends Migration A,
> and resolves two of the original open questions.

Governing rules (from CLAUDE.md and the boundary doctrine):

- Premium sees only what the public API exposes. If the ledger doesn't record
  it, premium can't compute it — and retro-tagging 800 loops is misery, so
  capture-side fields must exist *before* crews start logging.
- Derived status, never stored status. Nothing below adds a status column.
- Append-only stays append-only. Additions to `checks` are new optional
  fields on new records, never edits to old ones.
- Premium may keep *its own* office data (schedules, SOV mappings, alert
  configs) in its own database. Only facts about the field belong in core.

## Validation against real forms (Rev 1)

A real GC startup package — per-equipment precommissioning binder ToC and
log, installation/start-up certificates for pumps, valves, and mixers,
alignment and uncoupled-motor-run forms, tank leak and pipe pressure tests,
training records, and a "how to get organized" guide — was checked line by
line against this model. Source documents are internal company material and
stay out of this repo; only the *structural* conclusions are recorded here.

**What the forms confirmed:**

- **Certification blocks everywhere.** Every form terminates in signatures —
  performed-by plus witnesses. Append-only + Phase 3 signatures is the right
  spine; nothing in the package requires editing a completed record.
- **Test-equipment traceability is contractual, with a real rule:** test
  equipment calibrated to a NIST-traceable standard *within the previous 90
  days*. Confirms G2 (the `test_equipment` registry) and hands the premium
  calibration watchdog its actual alert logic (cal date + 90 days vs. use
  date and planned startup).
- **Witness-required is per-template — original open question 2 is
  resolved.** The real process contains checklists whose *defining feature*
  is the witness (an owner-witnessed repeat of a contractor test is a
  distinct checklist, not a flag on a line item). Per-template granularity
  matches reality; per-item remains an additive option if an owner format
  ever demands it.
- **`confirm_per_spec` is exactly how real forms behave.** Acceptance values
  appear as tables and tolerances with spec-paragraph citations next to
  them. Suggests one small addition: an optional `spec_reference` text field
  on `template_items` so a rendered check line can carry its citation.
- **The polymorphic `attachments` design matches the binder.** A real
  per-equipment binder mixes ledger-generated sheets with external documents
  (factory test reports, manufacturer certificates, spec excerpts, drawings,
  control narratives). The turnover compiler assembles both kinds; core only
  needs to *hold* the external ones, which `attachments` already does.
- **The per-equipment binder ToC is the turnover compiler's output spec** —
  a numbered, per-tag package cross-referencing checks, calibration sheets,
  certificates, specs, and drawings. Flagship premium module confirmed
  against a real deliverable.
- Multi-test-point value readings (design value + test points 1–4) and dual
  nameplates (driven equipment + motor) flatten cleanly into ordered
  template items — **no schema change**, just template-authoring
  conventions. Same for timed intermediate inspections (e.g. a 48-hour leak
  test's six inspection rows).

**New gaps the forms exposed:**

- **G10 — the tag reference block.** Every form header, and the master
  equipment list the organization guide prescribes, carries a standard set
  of cross-references the current `tags` collection lacks: **spec section**,
  **loop numbers (plural — one equipment tag references several loops)**,
  **PLC**, **MCC / breaker**, and drawing numbers beyond the P&ID
  (single-line, schematic, power and control plans). These are the compiler's
  hyperlink anchors and exactly what a real instrument index CSV contains.
  → Extend Migration A (below) and the CSV-import header synonyms.
  Design-point data (gpm, TDH, HP, RPM) stays out of dedicated fields for
  now — it varies by equipment type and is better captured as template
  value items or import-preserved description text.
- **G11 — system-subject checks.** The real sequence ends in tests and
  deliverables that belong to a *system or the whole project*, not one tag:
  integrated acceptance tests, reliability runs, precommissioning reports,
  training. `checks.tag` is currently `required: true`, so the ledger
  cannot record them. The seed library's `subject_kind` field anticipated
  exactly this. → Fold into the already-planned seed/migration
  reconciliation: make a check's subject **tag XOR system** (one set, never
  both — enforced in the create rule, mirroring a pattern proven in the
  sibling project). Needs its own short ADR.
- **G12 — multi-party witness (Phase 3 design input, no migration now).**
  Real certification blocks carry up to four roles: performed-by /
  manufacturer's rep, the GC's witness, the Engineer, and the Owner — the
  single `witnessed_by` text field cannot represent a real signature block.
  Record as a requirement on the Phase 3 signatures ADR: witness entries as
  data (role + name + signature + date), additive alongside the existing
  fields.

## Module-by-module dependency review

### 1. Turnover package compiler (flagship)

**Mostly supported already.** Frozen prompt text on `check_items`, polymorphic
`attachments`, `pid_reference` and nameplate fields on tags, and the
required-phases map (in `seed/`) give the compiler its skeleton. Rev 1: the
real binder ToC confirms the output shape, and G10's reference block is what
makes the binder's cross-references and hyperlinks possible.

Gaps:
- **G1 — seed/migration reconciliation** — **resolved 2026-07-09**
  ([ADR 0001](adr/0001-seed-reconciliation-and-check-subjects.md)): the
  compiler evaluates completeness against the required-phases map and
  `confirm_per_spec` items, and both now live in the real database —
  `confirm_per_spec` as a field, the map derived from the template library
  itself. Rev 1 added G11 (subject polymorphism) to this task; that landed
  with it.
- **G2 — test-equipment traceability.** Standard loop-sheet and startup
  forms require the test instrument used and its calibration status — field
  data captured at check time, so it belongs in core. Rev 1: the real rule
  is NIST-traceable within 90 days.
- **G3 — signatures** (Phase 3, already planned). Rev 1 adds G12: the
  signature model must support multiple witness roles.

### 2. Commissioning risk alerts

**Nearly free.** `systems.startup_sequence` orders the march; open A-severity
punch items and failed/missing checks are derivable per system today.

Gap:
- **G4 — `systems.planned_startup` (date, optional).** The sequence says
  *order*; alerts need *calendar*. **Recommendation: core field.** A free
  user's system page showing "planned startup: Aug 14" is genuinely useful,
  it's one optional date on an editable collection, and it makes the alert
  module pure derived insight. Premium can still overlay a richer schedule
  (P6 import, lookaheads) in its own DB later.

### 3. Punch & retest aging

**Derivable but lossy today.** A "retest" can be inferred (failed check →
later check, same tag + phase), and that inference should remain the
fallback. What's lossy is *punch closure evidence*: today closure is
`closed_by`/`closed_at`/`closure_note` free text, with no machine-readable
link to the check that proved the fix.

Gaps:
- **G5 — `punch_items.source_check`** (relation → checks, optional): the
  failed check that spawned the punch item, set at creation when applicable.
- **G6 — `punch_items.closing_check`** (relation → checks, optional): the
  passing retest that justified closure. Optional because plenty of punch
  items (paint scratch, missing label) close without a retest.
  Both are cheap, additive, and turn aging analytics from heuristic to
  evidence. They also strengthen the turnover binder: "punch A-041, raised
  by check 118, cleared by check 235" is a hyperlink chain an owner's
  inspector loves.

### 4. Owner witness portal

**Half supported.** `checks.witnessed_by` exists.

Gaps:
- **G7 — `witness_required` flag.** Template-level (`checklist_templates`),
  frozen onto `checks` at execution time — per-template granularity now
  confirmed by real process documents (see Rev 1 notes). Free users get
  "requires owner witness" on the tag page and a derivable "ready to
  witness" list; premium sells the owner-facing portal, notifications, and
  scheduling on top. Witness *scheduling* data stays premium-side.

### 5. Instrument index reconciliation

**No core schema needed.** Premium diffs a freshly uploaded index against
`tags` via the API. Rev 1 note: G10 makes this module stronger — a real
master equipment list carries the reference block, so reconciliation can
diff spec sections and drawing references too, not just tag existence.
- **G8 (defer) — import provenance.** Recording which CSV batch created a
  tag would let reconciliation distinguish "added by import" from "added in
  the field" — the field-added bucket being change-order gold. Defer until
  the module is real; additive whenever needed.

### 6. Sub billing verification (v3 — parked)

**Deliberately thin in core.** Percent-complete-vs-pay-app comparison,
SOV line mappings, and contract values are office/financial data — all
premium-side. The only field fact core should capture:
- **G9 — `tags.area` (text, optional).** Billing and progress break down by
  construction *area*, orthogonal to process *system*. One text field,
  added to the CSV import header synonyms, captured at import time.
  `punch_items.assigned_party` already covers responsibility attribution.

### 7. Readiness S-curves / portfolio rollup

**Fully derivable** from `checks.performed_at` + `created` timestamps, the
required-phases map, and (with G4) planned dates. No core change. Rev 1
note: the "Master Equipment Test Completion Summary Log" in real practice
*is* this module's output, hand-built — good demo framing.

### 8. Calibration watchdog

Covered by G2's registry: alerts on `cal_due` (with the 90-day
NIST-traceability window) vs. use dates and `systems.planned_startup` are
pure premium derivation once both exist in core.

## Proposed core additions (consolidated)

Everything below is **additive** — no field renames, no breaking changes to
existing collections, no stored status. Grouped into two migrations plus the
already-decided reconciliation (which now also carries G11).

### Migration A — capture-side fields — **landed 2026-07-09**
([ADR 0002](adr/0002-capture-side-fields-before-crews-log.md),
migration `1789000010`, including the CSV-import header synonyms)

| Change | Collection | Type | Module served |
|---|---|---|---|
| `area` | tags | text, optional (+ CSV synonyms) | billing (G9), filtering |
| `spec_section` | tags | text, optional (+ CSV synonyms) | compiler (G10) |
| `loop_numbers` | tags | text, optional — space/comma list (+ CSV synonyms) | compiler (G10), the product's namesake |
| `plc` | tags | text, optional (+ CSV synonyms) | compiler (G10) |
| `mcc_breaker` | tags | text, optional (+ CSV synonyms) | compiler (G10) |
| `drawing_refs` | tags | text, optional — single-line / schematic / plans (+ CSV synonyms) | compiler (G10) |
| `planned_startup` | systems | date, optional | risk alerts (G4) |
| `witness_required` | checklist_templates | bool, default false | witness (G7) |
| `witness_required` | checks | bool, frozen at execution | witness (G7) |
| `spec_reference` | template_items | text, optional | confirm_per_spec citations (Rev 1) |

G10 note: six discrete text fields (not one blob) because form headers and
the compiler's cross-references treat them as distinct, and the CSV import's
header-synonym machinery maps them cheaply. All optional; a minimal index
with just tag numbers still imports.

### Migration B — evidence linkage & test equipment — **landed 2026-07-10**
([ADR 0004](adr/0004-test-equipment-and-punch-evidence-links.md), migration
`1789000011`; landed with Phase 2, since the check-execution UI is what
populates these fields)

| Change | Collection | Type | Module served |
|---|---|---|---|
| `test_equipment` | **new collection** | description, make/model, serial, `cal_due` (date), NIST-cert via attachments; editable | turnover (G2), cal watchdog |
| `test_equipment_used` | checks | relation, optional, maxSelect ~3 | turnover (G2) |
| `test_equipment_note` | checks | text (frozen "Fluke 754 s/n 8823, cal due 2026-09-01") | turnover reads correctly even if registry later edited — same freezing pattern as prompts |
| `source_check` | punch_items | relation → checks, optional | retest aging (G5) |
| `closing_check` | punch_items | relation → checks, optional | retest aging (G6) |

### Reconciliation task additions (G11) — **landed 2026-07-09**

A check's subject is now **tag XOR system** (exactly one set, enforced in
the create rule), honoring the seed library's `subject_kind`: `checks.tag`
became optional, a `checks.system` relation was added, and the server-side
`createRule` enforces the XOR. Decided in
[ADR 0001](adr/0001-seed-reconciliation-and-check-subjects.md) alongside
the seed reconciliation itself.

### Phase 3 ADR inputs (no migration now)

- G12: witness entries as data — role (GC / Engineer / Owner /
  manufacturer's rep) + name + signature + date, multiple per check.

### Explicitly deferred (recorded so they aren't reinvented)

- Import provenance (G8) — until the reconciliation module is built.
- Any scheduling collections (witness requests, lookaheads) — premium-side.
- SOV / contract-value anything — premium-side, v3.
- Dedicated design-point fields (gpm/TDH/HP/RPM) — template value items or
  description text for now; revisit only if a real compiler format needs
  them structured.
- User-relation `performed_by` — free text is a hard-constraint consequence
  (no-account field tier); the auth ADR revisits attribution, not this plan.

## Open questions for the maintainer

1. ~~`test_equipment` scope~~ — **resolved (ADR 0004):** global registry,
   as recommended — serial numbers are the identity and meters move between
   jobs. A project filter can be added later if a fleet outgrows one list.
2. ~~`witness_required` granularity~~ — **resolved Rev 1:** per-template,
   confirmed against real process documents.
3. ~~Check one real turnover spec before freezing Migration B~~ —
   **resolved Rev 1:** validated against a real contractor startup package;
   G10–G12 are the result. Remaining sub-question: an *owner-side* ITR
   format (e.g. a district's required loop sheet) is still worth checking
   before the compiler renders its first owner deliverable — the package
   reviewed was contractor-side.
4. **New (Rev 1):** should `loop_numbers` stay a text list, or do loops
   eventually become first-class records (a loop spans several tags, and
   the product is named after checking them)? Text list now is cheap and
   import-friendly; first-class loops would be a significant model change
   deserving real field experience first.
