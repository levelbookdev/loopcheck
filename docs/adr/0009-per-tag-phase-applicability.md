# ADR 0009 — Per-tag phase applicability (`tags.phases_na`)

**Status:** accepted · **Date:** 2026-07-10
Acts on the forms-library review
(§2.1 — source note retained in the private Bindery repo).
Migration `1789000018` implements it.

## Context

A tag's **required phases are derived, not stored**: they are the phases that
have a checklist template for the tag's `tag_type`
([ARCHITECTURE.md §3, §9](../../ARCHITECTURE.md)). That derivation assumes
every tag of a type owes every phase that type has a template for. Real
turnover matrices contradict that assumption **per individual tag**, not per
type:

- The "Master Equipment Test Log" marks `NA` in specific cells — one
  bar-screen motor has `Configuration Rpt = NA`, another has
  `Calibration = NA`, a specific instrument skips `Functional`.
- An across-the-line motor has no VFD/configuration step; a hardwired float
  switch has no analog loop check. Both are the same `tag_type` as siblings
  that *do* owe those phases.

Today such a phase reads as "required but missing," so the checkout standing
plate — and the readiness matrix (rec #3) and Lookahead (rec #6) that derive
from the same signal — will show **false red** for a phase that legitimately
does not apply. A line-level `N/A` response cannot fix this, because the whole
*phase* is absent for this tag, not one line within a phase that still runs.

## Decision

Add an optional **`tags.phases_na`** — a capture-side text field listing the
phase keys that are Not-Applicable to this specific tag. The required-phases
derivation becomes:

> required(tag) = phases with a template for `tag.tag_type`
>                 **AND** not in `tag.phases_na`

This is still fully derived — nothing stores a *status*. `phases_na` is an
input *fact* about the equipment ("this across-the-line motor has no
configuration phase"), exactly the kind of capture-side field ADR 0002
established (`witness_required`, `planned_startup`, the instrument-index
block): known at import or install time, recorded before crews log against a
phase that was never going to happen.

### Shape

- **Text field, not a constrained select.** It holds phase identifiers as a
  space/comma-separated list, matching the other capture-side text fields
  (`loop_numbers`, `drawing_refs`) and staying import-friendly. A
  multi-`select` bound to the phase enum was rejected (below).
- **Forgiving comparison.** The derivation normalizes both sides (lowercase,
  strip non-alphanumerics) before matching, so `loop_check`, `Loop Check`,
  and `loopcheck` all exclude the `loop_check` phase. Unrecognized tokens are
  inert — they match no candidate phase and simply do nothing.
- **Empty is the safe default.** A blank `phases_na` (the vast majority of
  tags) means "every phase this tag_type has applies" — today's behavior,
  unchanged. This is a denylist, not a positive applicability list, precisely
  so the default requires no data entry and can never *under*-require.
- **Tags only, for now.** Services (ADR 0006) derive required phases the same
  way and could get the same field if a real need appears; not built ahead.

### Where it lands (implementation, this task)

- Migration `1789000018` adds the field (additive; no DB reset).
- The standing derivation on `tag.html` subtracts `phases_na`; the plate's
  denominator and "N phases passed" reflect only applicable phases, and the
  page surfaces which phases are marked N/A (read-only) so the smaller
  denominator is self-explaining.
- `import.html` gains a `phases_na` header synonym so an instrument index /
  test matrix can carry it in.
- **Docs:** ARCHITECTURE §3/§9 and the rejected-ideas list; `docs/API.md`
  (the required-phases clause gains "and not in `phases_na`"). Contract-wise
  this is an additive field plus a refinement of a documented derivation, not
  a breaking change — API v1 stands.

## Alternatives rejected

- **Line-level `N/A` response.** Wrong grain. When a whole phase does not
  apply, there is no check to run and no line to mark; forcing an empty check
  just to N/A its lines would pollute the append-only ledger with hollow
  records.
- **A `select` field constrained to the phase enum.** Would validate tokens,
  but couples the `tags` collection to the full phase enum (which includes
  service phases meaningless for a tag), duplicates the enum, and is clumsy to
  populate from a CSV. The text field with normalized comparison is looser but
  matches the established capture-side pattern.
- **A positive "applicable phases" list per tag.** Inverts the default the
  wrong way — every tag would need data entry to avoid under-requiring, and a
  blank field would wrongly mean "nothing required." The denylist defaults to
  the correct, safe behavior with zero input.
- **A stored required-phases map per tag.** Already rejected project-wide
  (ARCHITECTURE §9): a stored map drifts from the template library. `phases_na`
  is a small subtraction *on* the derivation, not a replacement for it.

## Consequences

- The readiness matrix (rec #3) and any Lookahead readiness (rec #6) inherit
  the corrected derivation for free — they read required phases the same way.
- Recommendation #5 (training as a signable phase) depends on this: without
  `phases_na`, adding a training phase would false-red every tag that needs no
  training. #5 should not land before this.
- A tag whose `phases_na` excludes *every* templated phase derives an empty
  required set — its standing reads "no applicable phases," which is honest,
  not an error.
- Accepted looseness: `phases_na` is unvalidated free text; a typo that
  matches no phase silently excludes nothing. The read-only surfacing on the
  tag page makes a mis-entry visible (a phase the operator expected to be N/A
  still showing in the plate).
