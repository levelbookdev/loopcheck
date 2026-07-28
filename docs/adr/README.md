# Architecture Decision Records — index & number register

This file is the **single source of truth for ADR numbers**. Before you start
a new ADR, claim the next free number by adding its row here *first*, then
create `NNNN-slug.md`. Numbers are permanent once claimed — an ADR that is
later rejected or superseded keeps its number and records that outcome in its
own **Status** line; the number is never reused.

Why a register: ADR numbers were being picked independently and two drafts
collided on `0009`. Claiming the number here before writing the file makes the
next free number unambiguous even when more than one change is in flight at
once.

**Next free number: `0018`.**

| #    | Title                                                                 | Status   |
|------|-----------------------------------------------------------------------|----------|
| [0001](0001-seed-reconciliation-and-check-subjects.md) | The seed library is the schema authority; a check's subject is a tag XOR a system | accepted |
| [0002](0002-capture-side-fields-before-crews-log.md) | Capture-side fields land before crews start logging | accepted |
| [0003](0003-core-premium-sidecar-boundary.md) | Core/premium boundary: premium is a sidecar on the public REST API | accepted |
| [0004](0004-test-equipment-and-punch-evidence-links.md) | Test-equipment traceability lives in core; punch items link to their evidence | accepted |
| [0005](0005-warranty-closeout-clock-start-provenance.md) | Warranty & closeout tracking: record the clock, not the deadline | accepted |
| [0006](0006-service-connections-third-subject.md) | Service connections: the third check subject, by nullable relation | accepted |
| [0007](0007-loto-visibility-staleness-asymmetry.md) | LOTO visibility: an append-only lock ledger, and the staleness asymmetry | accepted |
| [0008](0008-vfd-rotation-check.md) | VFD rotation & parameter check: a specialized capture UI on the ordinary ledger | accepted |
| [0009](0009-per-tag-phase-applicability.md) | Per-tag phase applicability (`tags.phases_na`) | accepted |
| [0010](0010-signatures-and-turnover-package.md) | Signatures & the turnover package: a signed, frozen snapshot over the append-only ledger | proposed |
| [0011](0011-auth-lockdown.md) | Auth lockdown: a small public allowlist, everything else signed in | Accepted |
| [0012](0012-open-resolve-duration-tests.md) | Open→resolve records: duration/reliability tests and bac-t samples as a linked pair of append-only checks | accepted |
| [0014](0014-segment-acceptance-records.md) | Segment acceptance records: pipeline segments as the fourth subject kind | superseded — moved to MainLine (2026-07-18) |
| [0013](0013-training-as-a-signable-milestone.md) | Training as a signable milestone check, not only a closeout deliverable | proposed |
| [0015](0015-stored-equipment-preservation-log.md) | Stored-equipment preservation log (recurring, tag-subject) | accepted |
| [0016](0016-purpose-built-instrument-calibration-records.md) | Instrument calibration uses a purpose-built as-found/as-left ledger | accepted |
| [0017](0017-vendor-field-service-reports.md) | Vendor field service reports: immutable visits with attached proof | accepted |

ADR 0010 has a companion, [`0010-review-notes.md`](0010-review-notes.md) — a
design review, not its own numbered decision.
