# Scoping LoopCheck-Lookahead — a constraint-driven startup lookahead sidecar

*Design note, 2026-07-10. Acts on §4 of the forms-library
review (source note retained in the private Bindery repo). Proposes the shape of the
`loopcheck-lookahead` repo (today an empty `.git` shell) before any code is
written. Checked against the shipped core schema, ADR 0003 (the core/premium
boundary), and `DATA_MODEL_PLAN.md`, which parks scheduling/lookaheads as
sidecar-side in their own database.*

---

## Why this is a design note, not an ADR (and where the ADR does go)

An ADR in **this** repo records a decision that changes LoopCheck core — a
schema shape, an enforcement rule, library mechanics — and is written before
the migration that implements it. The central finding here is the opposite:
**this work changes nothing in core.** Every readiness signal the lookahead
needs is already exposed by the public API (verified below). Forcing that
finding into the core ADR sequence would misfile a "no core change" conclusion
as a core change and pollute the ADR log.

So the instrument is a `docs/notes/` design note, living where the core
contract lives, whose job is to (a) confirm the boundary holds and (b) hand the
new repo its brief.

The sidecar's own load-bearing decisions — derived readiness with no stored
`ready` flag, constraints as first-class polymorphic records, the mutable-plan
vs. immutable-ledger line — are real structural choices, but they are
structural choices **about the sidecar's schema**, so they belong in the
sidecar's repo. They become **`loopcheck-lookahead/docs/adr/0001`, written
before that repo's first migration**, honoring the same docs-as-code discipline
one repo over. This note is that ADR's source material.

---

## 1. Core thesis: a startup lookahead is constraint-driven, not date-driven

A two-week lookahead answers one question: *what can we actually start next
week?* The honest answer is **"whatever's prerequisites have cleared"** — not
"whatever the Gantt bar says today."

MS Project models dates and predecessor links, then makes a human re-key
percent-complete every week. The schedule is a **stored belief** that decays
the moment the field diverges from it. The startup tracker's most important
column isn't the calendar grid — it's the free-text constraints: *"Need power
available to operate motorized valves," "Need water in the PA tank," "All dry
checklists signed to prove equipment is ready for clean-water test."* A startup
task is *ready* when its prerequisites clear, and stays blocked until they do.
That's a pull-plan / Last-Planner model, not a Gantt bar.

**The differentiator vs. MS Project:** a check-phase prerequisite clears
**automatically off LoopCheck's live derived ledger** — the same ledger the
crews are already writing in the field. "Commission the RAS pumps" becomes
ready the instant PMP-xxxx's energization phase reads *pass* in the check
ledger, with no human re-keying anything. MS Project can't do this because it
has no field ledger under it; Lookahead can *only* do it because LoopCheck's
accountless field tier exists.

**The invariant, inherited from tag status (hard constraint #4, ADR 0003):
readiness is derived, never stored.** A task's readiness is a pure fold over
its constraints, recomputed on every view — exactly as a tag's checkout
standing is a fold over its checks, never a `status` column. A stored `ready`
boolean would drift out of sync with the ledger the moment an upstream check
was logged or a constraint changed, reintroducing the precise failure mode the
whole product refuses. **There is no `ready` field anywhere in the sidecar.**

One distinction the model must keep crisp, because it's where "derived
readiness" gets misread:

- **Readiness** ("can this task start?") is **derived** — a fold over
  constraints, never stored.
- **Task progress** ("is this task done?") is **planner-asserted** — a mutable
  field on the plan, like any plan. It is *not* field truth and does not
  pretend to be.

The plan is mutable office data. The *ledger* it reads is immutable. Keeping
those two straight is what lets the sidecar honor "derived readiness" without
pretending a schedule is append-only (see §5 — append-only is deliberately
**not** inherited).

---

## 2. The read / own split

### Reads from LoopCheck core (public REST API, read-only per ADR 0003)

All over HTTP, exactly as any third-party client — no private door, no shared
DB, no in-process hook:

| Read | From | Used for |
|---|---|---|
| tags (`id`, `tag_number`, `tag_type`, `system`, `area`, `spec_section`, `loop_numbers`) | `tags` | the subjects tasks attach to |
| systems (`id`, `name`, `startup_sequence`, `parent_system`, `planned_startup`) | `systems` | phase ordering + the planner's target date |
| per-tag / per-phase check standing | folded from `checks` + `check_items` | the check-phase constraint signal |
| open A-severity punch items | `punch_items` (`fields=id,severity,status,tag,system`) | the open-A-punch blocker |
| which phases a tag_type owes | `checklist_templates` | required-phase derivation, so a constraint can name a real phase |

**Note the sidecar re-derives check standing; it does not read a status
field — there is none, by design.** It fetches the relevant `checks` and folds
them per phase with the same rule tag.html uses (any pass wins; a passing
retest clears an earlier fail). This is the boundary working as intended: the
derivation rule is public and documented (ARCHITECTURE §3, docs/API.md), so any
client can reproduce it. The cost is a **maintenance coupling** worth recording
now: the sidecar carries a copy of the any-pass-wins fold and must track the
core's rule. If core ever changes that rule it bumps the contract version
(ADR 0003) and the sidecar follows — the contract mechanism is exactly what
governs this.

### Owns in its own database (never in core)

This is office scheduling data — `DATA_MODEL_PLAN.md` parks it sidecar-side
explicitly, and the boundary doctrine keeps it out of the ledger:

- **tasks** — the lookahead line items (scope, phase group, duration, crew,
  inspection needs, planner-asserted progress)
- **task → subject links** — a task references a core tag or system by its core
  id / tag_number (a foreign reference *stored in the sidecar*, allowed; the
  link is the sidecar's, the record it points at is core's)
- **vendors / reps** and their **mobilization windows**
- **constraints** — first-class prerequisite records (§3)

### Confirming nothing new is required in core

Every read above resolves against a field that already shipped — verified in
the migrations, not assumed:

- `systems.startup_sequence`, `systems.planned_startup` — landed Migration A
  (ADR 0002); `planned_startup` was added *for exactly this* (G4).
- derived per-tag/phase standing — folded from the public `checks` /
  `check_items` reads; no status field to add (adding one would violate
  constraint #4).
- open A-severity punch — `punch_items.severity` + `.status`, present since
  Phase 1.
- required phases — derived from `checklist_templates`, already public.

**Result: zero core schema changes.** The lookahead is a pure consumer of the
existing contract. The temptation to add a `task` or `constraint` field onto
`tags` is the thing to resist — that is office data, and the boundary keeps it
sidecar-side.

**The one genuine core-first item — and it is auth, not schema.** Today's
permissive Phase-1 rules let the sidecar read `checks`/`punch_items`/`tags`
anonymously. After the auth lockdown, those reads must go through the
**read-capable service-account role ADR 0003 already obligates the auth ADR to
define** (an ordinary account with ordinary API-rule read permissions, never a
superuser). The lookahead's read scope is a concrete client of that role.
That's not a new requirement — it's naming Lookahead as the first consumer of
an obligation already on record. Flagging it per ADR 0003's "capability lands
in core first" rule so it isn't discovered late.

---

## 3. First-cut data model for the sidecar

Derived from the startup tracker columns — **Task/Scope · Responsible Party ·
Crew Size · Inspection Needs · Technician (vendor) · Duration (Days) ·
[calendar]** — grouped by its phase bands (Dry Checks → Dry Testing → Wet
Testing → Biological Seeding → Bio Ramp Up). This is the sidecar's *own*
PocketBase schema, in its *own* DB.

```
vendors                                       (a manufacturer's rep / specialty sub)
  └── mobilizations   (vendor)                a confirmed-or-tentative on-site window

tasks                 (subject_tag? XOR subject_system?)   a lookahead line item
  └── constraints     (task)                 a first-class prerequisite, polymorphic by kind
```

### `tasks`

| Field | Type | Notes |
|---|---|---|
| `scope` | text | "Commission RAS pumps", the Task/Scope column |
| `phase_group` | select | dry_checks / dry_testing / wet_testing / bio_seeding / bio_rampup (startup bands; extensible) |
| `subject_tag` | text | the equipment this task acts on, by `tag_number` (+ project) — resolved to core id on read (nullable) |
| `subject_system` | text | core system id — for system-level tasks (nullable) |
| `duration_days` | number | the Duration column |
| `crew_size` | number, optional | the Crew Size column |
| `responsible_party` | text | GC / sub / vendor — free text v1 |
| `inspection_needs` | text, optional | owner-witness / AHJ / none — the Inspection Needs column |
| `planned_week` | date, optional | the planner's **target**, NOT a readiness input |
| `progress` | select | planned / in_progress / done — **planner-asserted**, mutable (§1) |

`tasks` is **mutable and deletable** — it is a plan, and plans change. This is
the deliberate break from core's append-only ledger (§5).

### `constraints` — the heart of the model, first-class and polymorphic

A task is blocked until every constraint on it clears. `kind` selects how it
clears — mirroring core's tag-XOR-system pattern (one nullable field per kind,
a small fixed set, no polymorphic-id hack, no rule builder):

| `kind` | Clears when… | Fields it uses |
|---|---|---|
| `check_phase` | the core ledger's derived standing for (subject, phase) reads **pass** | `subject_tag`/`subject_system` + `phase` (a real phase key) — **this is the live, auto-clearing one** |
| `task` | the predecessor task's `progress = done` | `depends_on_task` (relation → tasks) |
| `vendor` | a **confirmed** mobilization window covers the task's `planned_week` | `mobilization` (relation → mobilizations) |
| `free_text` | a human sets `cleared = true` | `description` ("power available", "tank filled") + `cleared` (bool) + `cleared_by` / `cleared_at` |

The `free_text.cleared` boolean is the one place a human toggles state — and
it's honest: the app **cannot** derive "the PA tank is filled," so a planner
asserts it. Crucially this is a stored **input fact** (like a check *result* is
a captured input), **not** a stored *readiness* flag. Readiness is still a fold
over all constraints; this is one leaf of that fold. The distinction is the
same one core draws between storing facts and deriving status.

### `vendors` and `mobilizations` — vendor mobilization as a first-class constraining resource

§4.2 of the review is emphatic: startup dates are moved by **vendor
mobilization windows** far more than by labor. The blower vendor, the pump/mixer
vendors, the analyzer vendor, the valve vendor, the membrane (MBR) vendor —
almost every task names a rep who must be physically present. So the vendor is
a schedulable resource, not a text note on a task.

- **`vendors`** — `name`, `scope` (blowers / pumps / analyzers…), `contact`.
- **`mobilizations`** — `vendor` (relation), `window_start`, `window_end`,
  `confirmed` (bool: is the rep actually booked, or just pencilled?). A
  `vendor` constraint reads these: unconfirmed or non-covering window ⇒ *waiting
  on vendor*.

---

## 4. The readiness derivation and the weekly lookahead view

### Derivation (a pure fold, recomputed per view)

For a task in a given week:

```
ready(task) =
     every constraint on task is cleared
 AND no open A-severity punch item on the task's subject
```

- **check_phase** constraint → folds the core `checks` for its subject and
  checks the derived per-phase standing is *pass* (auto-clearing, off the live
  ledger).
- **task** constraint → predecessor `progress = done`.
- **vendor** constraint → a `confirmed` mobilization covers `planned_week`.
- **free_text** constraint → `cleared = true`.
- **open A-punch** → an extra live read against core, surfaced as its own
  blocker category (not stored as a constraint row — it's derived from core,
  same as a check-phase signal).

No step writes anything back to core (ADR 0003, read-only v1). Even clearing a
free-text constraint writes only to the sidecar's own DB.

### The weekly view — four honest states per task

The board renders each task in the lookahead window as exactly one of:

1. **Ready to start** — every constraint cleared, no open A-punch.
2. **Blocked by [named constraint]** — the specific unmet prerequisite, named:
   "energization not passed on PMP-xxxx", "waiting on predecessor: fill PA
   tank", "power available — not confirmed". Naming the blocker is the pull-plan
   value; a bare red bar isn't.
3. **Blocked by open A-punch** — the subject carries an open A-severity item;
   even all-green phases don't make it startable.
4. **Waiting on vendor** — no confirmed mobilization covers the week. Called out
   separately from (2) because it's the constraint that actually moves startup
   dates (§4.2) and the planner acts on it differently (book the rep, not chase
   the crew).

Field views stay dead-simple; the office/planner board carries the richer grid
(tasks × week, grouped by `phase_group` or by core `startup_sequence`).

---

## 5. Out of scope for v1, and inherited constraints

### Explicitly out of scope for v1

- **MS Project `.mpp` round-trip.** The `.mpp` lookahead files show people will
  *want* scheduler interop, but the native value is the constraint→readiness
  derivation, which an `.mpp` import can't carry (it has no field ledger under
  it). Treat MSP as an **export target later at most, never the native value**;
  importing it would drag date-driven Gantt semantics back in to fight the
  pull-plan model.
- **Critical-path / resource-leveling math.** Lookahead is a *readiness filter*,
  not a scheduling optimizer.
- **Cost / labor-hour rollups and S-curves.** That's core-derived premium
  territory (`DATA_MODEL_PLAN.md` module 7), computed off the ledger's
  timestamps, not the plan.
- **Any write back to core.** ADR 0003 read-only v1. A cleared constraint lives
  in the sidecar forever; the ledger is never touched.
- **Notifications / alerts.** Same posture as core — the tool stores facts and
  derives views; hosted-tier adds alerts on top later.

### Hard constraints the sidecar inherits

- **No build step** — static HTML + Alpine + PocketBase, its own single Go
  binary, runs on the trailer Pi (or off-box per ADR 0003; either way no
  bundler, no CDN, ~50 KB JS budget).
- **Derived readiness, never a stored `ready` flag** — the constraint #4 analog
  (§1).
- **Read-only against core** (ADR 0003) — polite polling / SSE, off-box, "the
  trailer box serves field scans first."
- **Tag numbers are the language** — tasks name their subject by `tag_number` /
  system, and the board can deep-link back to core's `/t/{tag_number}`.
- **No forms designer** — constraints are a fixed four-kind set, not a rule
  builder (constraint #5 analog).
- **Docs-as-code** — the sidecar repo gets its own ADR-0001 before its first
  migration; ARCHITECTURE + rejected-ideas list maintained there; commits
  authored as the maintainer, no AI attribution.

### One constraint deliberately **not** inherited

**Append-only.** Core's ledger is immutable because it's field truth that turns
into a turnover deliverable. The lookahead is a **plan** — tasks get edited,
re-sequenced, deleted as the job changes. Over-applying append-only here would
be a category error. The immutable thing the sidecar depends on is the *core
ledger it reads*, not its own plan.

---

## 6. Minimal repo skeleton (once this design is approved — not built yet)

Mirrors the core repo so a maintainer moves between them without re-learning
the layout:

```
loopcheck-lookahead/
  CLAUDE.md              sidecar doctrine: reads core / owns the plan, inherited
                         constraints, the readiness invariant, the not-inherited
                         append-only note
  README.md              under two pages
  ARCHITECTURE.md        the sidecar's shape + §3 data model + a "derived
                         readiness, never stored" section + a rejected-ideas list
  LICENSE                ⚠ commercial / proprietary, NOT AGPL — this is the paid
                         sidecar (see decision point below)
  docs/
    adr/
      0001-constraint-driven-readiness-sidecar.md   ← written BEFORE the first
                                                       migration; this note is its
                                                       source material
  pb_migrations/         the sidecar's OWN schema: vendors, mobilizations, tasks,
                         constraints (its own PocketBase, its own DB)
  pb_public/             Alpine pages — the weekly lookahead board, task editor,
                         vendor/mobilization editor, constraint editor. Plus a
                         core-connection config (see below)
  pb_hooks/              likely empty v1 (no clean-URL route needed yet)
  scripts/
    setup.sh             downloads the PocketBase binary (same recipe as core)
  examples/
    sample_lookahead.csv a startup-schedule-style task list for the import onboarding moment
```

**Two things that differ from core and must be designed in from day one:**

1. **The core-connection config.** Core pages talk to
   `window.location.origin` and never configure a host. The sidecar is a
   *different* origin from the core it reads, so it needs a configured **core
   base URL** (a small settings record or env, pointed at the core instance —
   same-box `localhost:8090`, a plant LAN IP, or a real domain). This is the
   one legitimate exception to "never hardcode a host," and it should be a
   config value, never a literal.

2. **Its own PocketBase instance and DB.** "Owns in its own database"
   (ADR 0003) means a second PocketBase process, not a second collection set in
   core's DB. The read client is the PocketBase JS SDK pointed at the core
   origin; the write client is its own local instance.

---

## Decision points for the maintainer — resolved 2026-07-10

1. **License / visibility — private, commercial.** `loopcheck-lookahead` is the
   **paid sidecar**: a private, commercially-licensed repo, **not AGPL**, per
   the boundary doctrine ("insight about the ledger is paid") and
   `DATA_MODEL_PLAN.md`'s parking of scheduling sidecar-side.
2. **Subject link format — `tag_number` + project.** Tasks and check-phase
   constraints reference their core subject by **`tag_number` + project**
   (the project's language), resolved to the core record id on read — reusing
   the same per-project collision handling core's `/t/{tag_number}` route
   already does. Systems link by core system id (no human-facing number).
3. **`phase_group` — free-form, startup bands as defaults.** The five startup
   bands (dry_checks → dry_testing → wet_testing → bio_seeding → bio_rampup)
   ship as the default set, but the field is free-form so a job that bands
   differently isn't forced into them.

These fold into the sidecar's ADR-0001. Skeleton and that ADR are the next
step; migrations and UI stop for separate review after.
