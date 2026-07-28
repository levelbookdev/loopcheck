# Contributing to LoopCheck

Thanks for your interest! Bug reports, commissioning war stories, and doc
fixes are always welcome as issues.

## Before sending code: the copyright requirement

LoopCheck is open-core
([ADR 0003](docs/adr/0003-core-premium-sidecar-boundary.md)): the core is
AGPL forever, and the maintainer holds sole copyright, which is what keeps
future licensing decisions possible. To preserve that, **code contributions
require either a CLA or a DCO before they can be merged**:

- **CLA** ("contributor license agreement") — a short agreement granting
  the maintainer broad rights to your patch.
- **DCO** ("developer certificate of origin") — a `Signed-off-by:` line in
  your commits asserting you have the right to submit the code.

Which of the two LoopCheck will use is **not decided yet**. Until it is,
please open an issue before writing a substantial patch — small fixes can
usually wait for the decision; large ones deserve a conversation first so
your work doesn't stall on paperwork.

## Ground rules for patches

- Read [CLAUDE.md](CLAUDE.md) — the hard constraints (no-install field
  tier, append-only records, no build step, derived status, no forms
  designer, tag numbers as the project's language) are load-bearing walls,
  and a patch that violates one will be declined regardless of quality.
- Schema changes ship as migrations in `pb_migrations/`, never as
  hand-edits, and need a short ADR in `docs/adr/` — written before the
  migration.
- Before landing a change that adds a migration or a module, the *combined*
  stack must pass `./scripts/smoke_test.sh` — it boots a fresh database,
  applies every migration, runs the full demo seed, and asserts the stack is
  healthy (all collections present, each module's seed populated, the
  append-only / close-once rules intact, the clean-URL routes serving).
  Modules are built and verified one per session, in isolation, where each
  looks fine on its own; this gate is what catches the breakage that only
  appears when everything runs together. `scripts/setup.sh` wires it in as a
  **pre-push hook** (`git config core.hooksPath .githooks`), so a push runs
  it automatically; a doc-only or emergency push can bypass it with
  `SKIP_SMOKE=1 git push`.
- The collections are a published API surface ([docs/API.md](docs/API.md)) —
  sixteen published as v1, 24 committed in total (the extra eight marked
  *delta*). Breaking changes need an ADR *and* a contract version bump, not
  just a migration.
- `seed/` is the maintainer-authored domain library (real water/wastewater
  checkout practice). Content changes there need domain review by the
  maintainer — checklist wording is engineering, not copy-editing.
- Anything touching the QR/URL format (`/t/{tag_number}`) is a breaking
  change to physical printed labels and needs explicit maintainer sign-off.
- Comment the "why," not the "what" — especially PocketBase API calls
  (filter syntax, expand, create-then-derive sequences). Boring, readable
  code wins.
- Update the affected docs in the same change — see the docs-as-code
  definition of done in [CLAUDE.md](CLAUDE.md).
