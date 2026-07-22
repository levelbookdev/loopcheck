# 090 — Punch List report: system/project roll-up (print + free CSV)

Status: TODO (do not start until M1 tasks 010–070 are DONE)
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

- [ ] The gap check is recorded; the feature does not duplicate an existing view.
- [ ] A system-scope and a project-scope punch roll-up render, grouped A/B/C with
      the correct fixed colors, open items by default and an option to include
      closed.
- [ ] The view prints cleanly using the existing print-CSS approach.
- [ ] A free client-side CSV export produces the documented columns for the same
      roll-up.
- [ ] The roll-up is derived live from `punch_items` via REST at
      `window.location.origin`; no new/changed collection; no stored status.
- [ ] The page renders for a guest (no hard auth redirect); page-weight stays in
      line with sibling pages (no new heavy dependency, no CDN).
- [ ] Docs updated if user-visible (landing page/ARCHITECTURE/ROADMAP checkbox).

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
