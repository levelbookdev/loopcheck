# 090 — Punch List report: system/project roll-up (print + free CSV)

Status: DONE (2026-08-02 — `pb_public/punchlist.html`, both scopes, print + CSV)
Milestone: M2 Shutdown Runbooks + Punch List (v0.10.0)
Depends on: 070 (all of M1)

## Context

LoopCheck answers three questions; the second is *"what punch items are blocking
this system?"* Punch items can be flagged and closed per tag, but there may be no
consolidated **report** — an A/B/C roll-up across a system or project that a PM
prints for a walkdown or hands to the engineer. This task adds it as a
free-tier, print-friendly board plus a free CSV export
([DECISIONS.md D17](../DECISIONS.md#d17--punch-list-report-idea-b1-adopted-into-m2-pending-gap-confirmation)).

**First step is a gap check** (D17): confirm the roll-up/export does not already
exist before building. `system.html`, `project.html`, and `readiness.html`
already show punch information; if one of them already provides a printable,
CSV-exportable A/B/C roll-up at project scope, this task narrows to filling the
missing piece (and its scope/acceptance below adjust accordingly). Do not
duplicate an existing view.

### Gap check result (2026-08-02) — the report is missing; build it

| Page | Punch content today | Item list? | Print? | CSV? |
| --- | --- | --- | --- | --- |
| [`system.html`](../../pb_public/system.html) | open A/B/C **counts**, system totals + per-tag badges | no | no | no |
| [`project.html`](../../pb_public/project.html) | open A/B/C **counts** per system + an "unassigned" block | no | no | no |
| [`readiness.html`](../../pb_public/readiness.html) | **none** — checkout phases × closeout deliverables only | n/a | yes | no |

Both existing views are **aggregate counters that link away**, never a listing:
neither renders a punch item's description, assigned party, or status, and
neither prints or exports. `readiness.html` does not touch `punch_items` at all.
There is no `punchlist.html`. So all three deliverables (item-level A/B/C
roll-up, print view, CSV) are missing and this task builds in full — a new
`pb_public/punchlist.html` taking `?project=` **or** `?system=`, rather than
bolting a report mode onto two pages whose job is navigation.

**Subject-kind note.** `punch_items` can hang off a tag, a system, a service, a
segment, or the project alone (four nullable relations, migrations `1789000007`
/ `1789000013` / `1789000024`). The report renders whichever subject an item
actually has, so nothing is silently dropped; the CSV keeps the six columns
specified below, with the non-tag subjects written into `tag_number` under a
kind prefix (`SVC <address>`, `SEG <segment_id>`) and left blank for
system-only/project-only items.

## Scope

**Likely create/touch (confirm after the gap check):**
- A new `pb_public/punchlist.html` **or** an added report mode on
  `system.html`/`project.html` — whichever is the smaller, non-duplicative
  addition. Prefer extending an existing page if it cleanly fits.
- `pb_public/app.css` — only if new print styles are needed; reuse existing
  severity color tokens and print CSS patterns.
- Docs: `ARCHITECTURE.md`/`ROADMAP.md`/landing page per the docs-as-code rule if
  the feature is user-visible.

**Leave alone:**
- The `punch_items` schema and its rules — this is a **read/report** feature; it
  must not add or change collections. Punch closing already requires auth (ADR
  0011); the report does not change that.
- Any paid-tier concern — this is free-tier and stays free.

## Specification

1. **Gap check (do this first, record the result).** Inspect `system.html`,
   `project.html`, `readiness.html` for an existing printable + CSV A/B/C punch
   roll-up. If it fully exists, mark this task `DONE` with a note and stop. If it
   partially exists, build only the missing part.
2. **Report content.** For a chosen system (and a project-wide variant):
   - List open punch items grouped by **severity A / B / C**, using the fixed
     color language (A red = blocks startup, B amber = blocks substantial
     completion, C grey = cosmetic). Reuse the existing tokens in `app.css`; do
     not invent new colors.
   - Show, per item: the subject tag number (monospace), severity, description,
     assigned party if present, and open/closed state. Default to **open** items;
     allow showing closed too.
   - Order A before B before C; within a severity, a stable order (e.g. by system
     then tag number).
3. **Derived, not stored.** Compute the roll-up live from `punch_items` (and
   their tag/system relations) at `window.location.origin` via the PocketBase
   REST API. No stored status. Comment the API calls (filter/expand) per
   `CLAUDE.md` conventions.
4. **Print-friendly.** The board prints cleanly (the free deliverable) — follow
   the existing print CSS approach used by `cutover.html`/`readiness.html`.
5. **Free CSV export.** A client-side CSV of the same roll-up (like the existing
   per-tag ledger CSV and rotation CSV). Columns: system, tag_number, severity,
   description, assigned_party, status. Free tier — never gated.
6. **Auth posture.** Reading punch items is public (ADR 0011); the report page is
   field-facing and must render for a guest (soft-gate style — no hard redirect),
   consistent with the tag/service pages. Closing a punch still requires auth
   wherever that action already lives; this report does not add closing.

## Acceptance criteria

- [x] The gap check is recorded; the feature does not duplicate an existing view.
      *(Recorded above; all three deliverables were missing.)*
- [x] A system-scope and a project-scope punch roll-up render, grouped A/B/C with
      the correct fixed colors, open items by default and an option to include
      closed. *(Verified against the demo seed: project scope A 7 / B 10 / C 4 =
      21 open, 28 with closed; system scope A 3 / B 2 matches `system.html`'s
      counters for System 10.)*
- [x] The view prints cleanly using the existing print-CSS approach.
      *(`@media print` block modeled on `readiness.html`/`cutover.html`;
      confirmed the rules parse and apply — chrome hidden, items never split.)*
- [x] A free client-side CSV export produces the documented columns for the same
      roll-up. *(Header `system,tag_number,severity,description,assigned_party,
      status`, 21 rows for 21 open items.)*
- [x] The roll-up is derived live from `punch_items` via REST at
      `window.location.origin`; no new/changed collection; no stored status.
- [x] The page renders for a guest (no hard auth redirect); page-weight stays in
      line with sibling pages (no new heavy dependency, no CDN). *(16 KB of
      HTML+CSS+JS, Alpine only; verified signed out.)*
- [x] Docs updated if user-visible (landing page/ARCHITECTURE/ROADMAP checkbox).

**Verification note.** `scripts/smoke_test.sh` passes 89/89 against a fresh DB.
`scripts/browser_test.sh` was **not** run locally — Node is unavailable in this
environment — so the field-path suite should be run before the v0.10.0 tag. The
page was instead exercised in a real browser against a seeded instance (both
scopes, closed toggle, CSV capture, empty state, missing-parameter error state,
and a check that the service expand carries `address` only).

## Guardrails

- **Report only — no schema change.** Adding or altering a collection here is out
  of scope and would touch the API contract (needs an ADR).
- **Free tier, never paywalled** ([D17](../DECISIONS.md#d17--punch-list-report-idea-b1-adopted-into-m2-pending-gap-confirmation)).
  A compiled/branded punch report would be sidecar work — not this.
- Reuse existing severity tokens, print CSS, and CSV patterns; do not introduce a
  new styling system, a charting library, or any CDN/runtime dependency
  (constraint #3).
- Field-facing page: never hard-gate it (constraint #1). Render for a guest.
- Comment the PocketBase filter/expand calls so the maintainer can read the
  backend from the code.

## Definition of done

- Gap check recorded; the roll-up (or the missing piece) built, printing and CSV
  working, derived live, guest-renderable, docs updated.
- `Status:` set to `DONE`.
- Committed as the maintainer, message e.g.:
  `feat: punch list roll-up report with print view and free CSV export`.
