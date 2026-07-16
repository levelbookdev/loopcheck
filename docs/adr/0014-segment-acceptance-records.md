# ADR 0014 — Segment acceptance records: pipeline segments as the fourth subject kind

**Status:** superseded — ownership moved to LineCheck (maintainer decision,
2026-07-14) · **Date:** 2026-07-11

**Decision outcome (2026-07-14):** the maintainer decided that pipeline/segment
(linear) acceptance is **LineCheck's bounded context, not LoopCheck's**. This
ADR is therefore **not accepted**; LoopCheck stops here. Concretely:

- **Frozen at the landed schema, maintenance-only.** Migrations
  `1789000023`–`1789000025` (open→resolve schema, the `segments` collection +
  four-way subject XOR, segment phases, and the segment seed templates) already
  shipped to `origin` (commit `b0cbea5`) and **stay** — per
  `docs/overlap-and-migrations.md`, landed records "cannot be relabeled as
  LineCheck data," so the schema is maintained, not ripped out. No further
  LoopCheck expansion on it.
- **The segment execution UI is cancelled in LoopCheck** — the segment
  page/board/resolve UI/CSV import/acceptance package described below will **not**
  be built here. LineCheck becomes the authority; the eventual move happens
  deliberately, after LineCheck has equivalent capability and a versioned
  importer (`docs/architecture-status.md`, `docs/open-questions.md`).
- **The open→resolve schema (ADR 0012) is unaffected** — `result: "pending"` and
  `checks.resolves` are general-purpose and already used by other LoopCheck
  records (e.g. the tank leak test); only the *segment* application moves.

Everything below is the original proposal, retained as the historical record of
what was designed. It describes an ADR-first intent that implementation briefly
outran; it is **not** the current direction. The four "open questions" at the
end are now **LineCheck's** to answer, not LoopCheck's.

Phase 6. Extends the subject-kind recipe
([ADR 0006](0006-service-connections-third-subject.md)) a fourth time and is
the first real user of the open→resolve pattern
([ADR 0012](0012-open-resolve-duration-tests.md), accepted). The ADR was written
with an ADR-first intent, but implementation subsequently outran its status.

## Context

Water/wastewater linework is accepted **per pipeline segment**, station to
station, not per equipment tag. The acceptance record for a segment is a small,
fixed sequence of tests whose *result governs whether that reach of pipe may go
into service*:

- **Pressure pipe** (water main, force main): a **hydrostatic/pressure test**
  (test pressure held for a duration, allowable make-up water per AWWA C600 —
  spec-governed), then **disinfection** (AWWA C651: dose, contact, residual,
  flush, dechlorinate), then **bacteriological (bac-t)** sampling cleared by an
  outside lab.
- **Gravity sewer**: no disinfection/bac-t; instead **low-pressure air test**,
  **mandrel / deflection**, and **manhole vacuum** tests.

Two facts make this Phase 6 and not "just more templates":

1. **A segment is a new subject.** It is neither a tag (equipment) nor a system
   nor a service connection. It has its own identity (station limits, size,
   material, length) and its own acceptance sequence. Core's check engine is
   already subject-polymorphic (tag XOR system XOR service, ADR 0006) — a
   segment is the fourth, and the recipe is deliberately boring to repeat.
2. **Bac-t is the canonical open→resolve record.** The sample is signed at
   collection; the lab result returns days later and must attach without
   mutating the original; a failed sample loops back to re-flush/re-chlorinate
   as new records. That is exactly ADR 0012, and Phase 6 is where it gets
   built.

## Decision

### 1. A `segments` collection — the fourth subject kind

Fields: `project` (relation), `segment_id` (human label — the station range,
e.g. `"STA 10+00 → 16+50"` — presentable, unique per project like a
`tag_number`), `from_station`, `to_station`, `size` (diameter), `material`
(PVC / DIP / HDPE / …), `length_ft`, `description`. The XOR create-rule on
`checks` and `punch_items` extends to **four-way** (tag XOR system XOR service
XOR segment), the ADR 0006 recipe repeated. `subject_kind` gains `segment`.

Like services, a segment's URL/QR key is its **record id** (`/seg/{id}`), not
the station string (stations aren't URL-clean and can repeat across projects);
the page shows the station range big.

### 2. The type discriminator — reuse `tag_type` as "subject type"

A segment's required phases differ by **pipe type** (a pressure main owes
hydro + disinfection + bac-t; a gravity sewer owes air + mandrel + vacuum).
That is the same shape as a tag's required phases differing by `tag_type` — so
segment templates set the existing template `tag_type` field to a **segment
type** (`pressure_main` / `force_main` / `gravity_sewer`) and
`subject_kind: "segment"`. A segment carries a matching `segment_type` field,
and its required phases derive exactly as a tag's do: the phases that have a
`subject_kind='segment'` template for its `segment_type`. No new derivation, no
stored map. (Naming note: `tag_type` on a template is now really "subject
type"; documented, not renamed — renaming a shipped contract field is a bigger
move than this earns.)

### 3. Segment phases — appended to the shared enum

New phase values (additive, the ADR 0006 pattern): `hydro`, `disinfection`,
`bac_t` (pressure), and `air_test`, `deflection`, `vacuum` (gravity). Required
phases per segment stay derived from the templates for its `segment_type`.

### 4. Bac-t implements open→resolve (ADR 0012)

The bac-t phase is the first open→resolve record:

- **Open**: the sample-collected check, `result: "pending"`, signed at
  collection (who, when, sample IDs / locations in the frozen line items).
- **Resolve**: when the lab reports, a second check `result: pass|fail`,
  `resolves` → the open check, with the lab report attached via the existing
  polymorphic `attachments`. Never mutates the open record.
- **Reset**: a failing sample → the segment re-flushes/re-chlorinates
  (new disinfection + new bac-t open) — all new records; the failure stays in
  the ledger.

Standing gains the `running` state (ADR 0012): a segment with a pending,
unresolved bac-t reads *bac-t running*, not pass/fail/blank. The
hydrostatic/air tests are timed too but resolve in one sitting (held N minutes,
read make-up water) — they stay ordinary pass/fail checks unless a real form
shows a multi-day hold, in which case they adopt the same open→resolve shape.

### 5. The deliverable — a per-segment acceptance package (derived)

A segment is **accepted** when every required phase for its type folds to pass
(hydro + disinfection + bac-t resolved-pass for pressure; air + mandrel +
vacuum for gravity) — derived, never a stored `accepted` flag, the same
invariant as everything else. The free, print-friendly per-segment package
(the checks, dates, lab report, signatures) is generated by the same engine as
the tag turnover package; the compiled multi-segment PDF binder is paid-tier
(ADR 0003), consistent with every other deliverable.

### 6. `confirm_per_spec` governs the numbers

Hydro test pressure and allowable make-up water (AWWA C600), disinfection dose
and residual and flush velocity (AWWA C651) are **spec-governed** — the seed
templates name the check and flag `confirm_per_spec: true`; the project
confirms the number against the contract (the existing pattern).

## Alternatives rejected

- **A polymorphic `subject_id` on checks instead of a fourth relation.**
  Rejected again (ADR 0006's reasoning holds): PocketBase relations can't span
  collections, so it would be an untyped id — no integrity, no `expand`. One
  nullable relation per subject kind, XOR-enforced, stays the pattern.
- **A dedicated `segments`-only check engine / module.** Rejected — a segment
  acceptance test *is* a check (a signed, dated, append-only record against a
  subject). Forking the engine for it would duplicate subjects, append-only,
  freezing, and standing.
- **A new `segment_type` field on templates instead of reusing `tag_type`.**
  Rejected as needless schema churn — `tag_type` already serves as the
  template's subject-type discriminator; a fifth subject kind would reuse it
  the same way. Documented, not renamed.
- **Storing segment `accepted`.** Rejected — derived from the phase fold, like
  every other status (hard constraint #4).

## Consequences

- Core gains a `segments` collection (seventeen total) and four-way subject
  XOR; `docs/API.md` grows a contract collection and the phase set grows —
  additive, v1 stands.
- Open→resolve (ADR 0012) gets built here: `result` enum gains `pending`,
  `checks.resolves` relation, the `running` standing state. Reliability runs
  (the other ADR 0012 use) can adopt it later with no further schema.
- The seed library gains segment templates (hydro/C651/bac-t + gravity
  variants) — maintainer domain-review content, keyed by `segment_type`.
- The build is several tasks after this ADR: the migration (segments +
  four-way XOR + open→resolve schema + phases), the seed templates, the segment
  page + acceptance board + open→resolve execution UI + CSV import, then the
  acceptance-package print view. Task-by-task with review, per the working
  style.

## Open questions (now LineCheck's, per the 2026-07-14 ownership move)

These were the design questions this proposal left for the maintainer. With
linear acceptance moving to LineCheck, they carry over to LineCheck's own design
rather than being resolved in LoopCheck. Retained for continuity so LineCheck
inherits the thinking; the interim answers noted here reflect only what the
now-frozen LoopCheck schema happened to assume, not a LoopCheck commitment.

1. **Segment-type set.** `pressure_main` / `force_main` / `gravity_sewer` —
   enough, or split (e.g. `reclaimed_main`, `raw_water`)? Drives the seed.
2. **Do the hydro/air tests need open→resolve** (a multi-hour/-day hold that
   resolves later), or are they single-sitting pass/fail with a recorded
   duration? I've assumed single-sitting; a real C600 form may hold longer.
3. **Segment identity in the URL.** `/seg/{id}` (record id, like services) —
   confirm; stations aren't unique/clean enough to key on, and segments have no
   PII concern, so this is purely the URL-cleanliness call.
4. **Does a segment belong to a `system`** (rollup), or only a project? Services
   have no system; segments might roll up to a "pipeline" grouping. I've left it
   project-only for now — add a nullable `system`/grouping later if a real job
   needs the rollup.
