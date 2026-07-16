# ADR 0016 — Instrument calibration uses a purpose-built as-found/as-left ledger

**Status:** accepted · **Date:** 2026-07-12

## Context

A loop check proves that a signal travels through the complete signal path. An
instrument calibration proves a different fact: the instrument read true at
known test points, and, when adjusted, preserves both the reading before the
adjustment and the reading after it. Engineers of record expect that paired
evidence on the calibration sheet.

The checklist engine is intentionally flat and limited to four response types.
It can record values, but it cannot cleanly express a repeated row containing
`expected_value`, `as_found`, `as_left`, unit, and tolerance together. Encoding
each point as several checklist items would lose the row pairing and make a
normal adjustment look like a conditional form. Adding a fifth response type
would expand the forms designer the project explicitly rejects.

The standard used is part of the evidence. A calibration performed with a
standard whose certificate had expired must remain in the ledger, visibly
flagged; blocking submission would erase the more valuable record of what
actually happened.

## Decision

Calibration is a purpose-built core module, separate from but complementary to
the checklist ledger.

- `test_standards` is an editable global registry of the calibrator or reference
  standard, including identity, ownership, certificate dates, and append-only
  certificate attachments. Its `updated` timestamp is the same lightweight
  registry-audit convention used elsewhere; historical use does not depend on
  the current registry values.
- `calibrations` is append-only and belongs to one instrument tag. It freezes
  the selected standard, technician/company, performed date, interval, result,
  notes, and `standard_expired_at_use`. A client-generated unique token makes
  offline retries idempotent.
- `calibration_points` is append-only and belongs to one calibration. Every row
  always records expected, as-found, and as-left values. As-found differing
  from as-left is normal and is represented by `adjusted_pass`, not by editing
  the original reading.
- The create endpoint derives `standard_expired_at_use` from the selected
  standard's certificate due date and the calibration's performed date. The
  client shows the warning before submission, but the server calculation is the
  authoritative frozen fact. Expiry never blocks capture.
- `next_due` is never stored. Readers add `interval_months` to the performed
  date and derive current, due within 30 days, overdue, or never calibrated.
  The badge only appears for `instrument_flow`, `instrument_level`, and
  `instrument_pressure` tags.
- Field capture, history, badges, the standards registry, project due view, and
  raw attachments remain AGPL core. A formatted calibration-sheet section in a
  compiled turnover-package PDF is paid-sidecar territory; core exposes all
  facts required to create it.

## Offline and atomicity

The phone form stores an outbox entry containing the complete calibration,
points, and optional report. Sync posts that package to one core endpoint,
which writes the calibration, its point rows, and report attachment in one
database transaction. Replaying the same outbox entry returns the existing
record by its unique client token instead of duplicating evidence.

## Consequences

- Three additive collections and one core capture route are added. No existing
  collection shape or status derivation changes.
- Calibration does not create a new checklist phase and therefore cannot drift
  the required-phase derivation.
- A later correction is another calibration. Neither calibration headers nor
  their point rows can be updated or deleted by normal clients.
- The `test_equipment` registry from ADR 0004 remains distinct: it identifies
  equipment used during a general check and freezes that identity on the check;
  `test_standards` carries certification provenance for this purpose-built
  calibration ledger.

## Rejected alternatives

- **Represent each point with ordinary checklist items.** Rejected because it
  breaks the as-found/as-left pairing and pushes a repeated domain record into
  the deliberately small response-type model.
- **Block use of an expired standard.** Rejected because the immutable record of
  the work is more valuable than silence. The red frozen flag makes the defect
  impossible to hide.
- **Store `next_due` or a calibration status on the tag.** Rejected because both
  are derivable from the latest ledger record and today's date.
- **Reuse `test_equipment` and roll its `cal_due` forward.** Rejected because a
  mutable current-due field cannot by itself prove which certificate governed a
  purpose-built calibration record.
