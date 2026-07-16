# ADR 0006 — Service connections: the third check subject, by nullable relation

**Status:** accepted · **Date:** 2026-07-10
Implemented by `pb_migrations/1789000013_migration_d_services.js` (schema) and
`1789000014_seed_service_templates.js` (the cutover template library).

## Context

Water main replacement jobs carry hundreds of individual service connections,
each of which must be noticed, located/potholed, re-served, metered, tied
over, and restored. Today that is a highlighter on a plan sheet and a
spreadsheet that is wrong by Wednesday. The two questions the module must
answer: *what is the status of every service on this job*, and *can we prove
customer N was noticed before we shut their water off* — the second being the
dispute-proof record, because "we were never told" complaints to the district
are routine and a timestamped, photographed door-hanger log ends them.

A service connection is LoopCheck's first non-equipment subject. The checklist
engine (templates → frozen-prompt check_items → append-only checks, derived
results) already does everything the cutover sequence needs. The question was
only **how a check points at a service** — and the answer had to make the
*fourth* subject kind (Phase 5 locations, Phase 6 segments) boring to add.

## Decision

**A service is the third check subject, added exactly the way a system became
the second (ADR 0001): one nullable relation per pointing collection, with
the shape enforced server-side.**

1. **New `services` collection** — project, address (required; the
   human-facing identifier everywhere a tag_number would appear), station
   (crew-sequencing sort key, parsed numerically client-side), account/parcel,
   customer name/phone (PII — see below), old/new meter numbers, size,
   material. **No status field**: a service's cutover standing is derived
   from its check ledger against the service phase set (hard constraint #4).
   Unique per project on (address, station), so re-imports skip as
   duplicates the same way tag imports do.

2. **`checks.service`** (nullable relation) — the createRule becomes a
   three-way exactly-one: `tag` XOR `system` XOR `service`. Same reasoning as
   ADR 0001: the ledger is append-only, a malformed record is permanent, so
   the server-side rule is the gate. Every previously valid request stays
   valid.

3. **`punch_items.service`** (nullable relation) — rule: `service = "" ||
   (tag = "" && system = "")`. A punch targets a service XOR the tag/system
   pair (tag+system legitimately coexist because system is the equipment
   rollup; a service has no system). All-blank stays legal — a general
   project punch item.

4. **`checklist_templates.subject_kind` gains `service`**, and the shared
   `phase` select on templates and checks gains the six service phases
   (`notice`, `locate_pothole`, `new_service`, `meter`, `tie_over`,
   `restoration`). Phase sets are per-subject-kind by convention, not by
   separate columns: a template's subject_kind determines which set its phase
   draws from, and a subject's **required phases stay derived** — the phases
   that have a template for its kind (for tags, its tag_type) — exactly as
   before. No stored phase map, nothing new to drift.

5. **URL: `/s/{record id}`**, served by a pb_hooks route like `/t/{tag}`.
   Deliberately *not* the address: addresses are unique only per project,
   full of spaces and abbreviation drift ("St." vs "Street"), and the PII
   rule forbids anything person-identifying in a URL or QR. The address is
   what every page *displays*; the record id is what the URL *carries*. A QR
   inside the meter box lid encodes `/s/{id}` — opaque and PII-free.

6. **PII rule** (recorded in CLAUDE.md): `customer_name` and
   `customer_phone` are visible only to authenticated users, never rendered
   on any page reachable without sign-in, and never encoded in QR codes or
   URLs. The address is the public identifier; the person is not. Today this
   is enforced by discipline the pages actually implement — every fetch on a
   public page (service page, cutover board, batch notice, check execution,
   labels) uses a `fields=` list that excludes both columns, so the PII never
   even crosses the wire to those pages. PocketBase API rules are
   collection-level, not field-level, so **the auth lockdown ADR must pick
   the mechanical enforcement** — most likely splitting the two fields into a
   contacts collection whose read rule requires auth, or a field-level
   mechanism if PocketBase grows one. Recorded there as an open obligation.

## Alternatives considered

- **A polymorphic `subjects` table** (`subject_kind` + `subject_id`, checks
  point at it) — rejected. It buys uniformity at the price LoopCheck can't
  pay: PocketBase relations can't span "one of several collections," so
  `subject_id` would be an untyped text id with no referential integrity, no
  cascade semantics, no `expand`, and every query joining through a second
  hop. The nullable-relation route keeps real foreign keys, real `expand`,
  and per-subject indexes, and the XOR rule keeps the shape as strict as a
  single typed column would. Three (later four) nullable columns is not
  drift; it is the schema saying what it means.
- **Forking the checklist engine** (a `service_checks` collection) —
  rejected outright; the brief and hard constraint #2 both forbid it. Two
  ledgers means two immutability enforcements, two frozen-copy patterns, two
  history views, and a PDF engine that reads both.
- **A `subject_kind` discriminator + single reused relation column** —
  rejected; a relation field points at one collection in PocketBase, so this
  degenerates into the polymorphic table above.
- **Address as the URL key** (`/s/1414+Maplewood+Ave`, mirroring
  `/t/PMP-3101`) — rejected, reasons in Decision 5. Tag numbers are
  engineered identifiers; addresses are not.
- **An enum for `service_size` / `service_material`** — rejected; real
  district exports say "5/8x3/4" and "poly (blue)". Free text, like the tag
  nameplate fields; an enum would fight every import.
- **A stored per-service status column** — rejected without discussion;
  hard constraint #4.

## Consequences

- Adding subject kind #4 (Phase 6 `segments`) is now a recipe: one
  collection, one nullable relation on `checks` (+ `punch_items` if
  applicable), extend the XOR rule, add a `subject_kind` value and its phase
  values, seed its templates. No engine changes.
- The `phase` select is now a union of per-kind sets. Accepted quirk:
  nothing in the schema prevents a service check from carrying an equipment
  phase — the UI never offers it, and the phase-set convention is documented
  here and in API.md. A per-kind CHECK constraint would need a phase→kind
  map in the schema, which is exactly the stored-map drift ADR 0001 rejected.
- `checks` gains no `project` column (unlike `punch_items`): the cutover
  board filters through the relation (`service.project='…'`), which
  PocketBase supports. If that read ever gets slow on a Pi with thousands of
  checks, denormalizing `checks.project` is an additive follow-up.
- The batch notice page writes full, normal notice checks (frozen prompts,
  photo attachment, append-only) — the ledger cannot tell batch entries from
  single ones, which is the point. Its resilience is per-row retry with
  client-held state; a true offline queue remains future work (ROADMAP.md).
- The Cutover Status Report (district-facing compilation: per-service
  status, outage durations, notice-evidence index) sits on the paid side of
  the ADR 0003 boundary; the free tier keeps the print-friendly board, which
  reads only contract-surface API. Everything premium needs (outage times,
  notice photos) already lands in core records — no premium-only fields.
