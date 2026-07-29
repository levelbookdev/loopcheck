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

### The test gate, local and remote

The same script is the gate in both places
([DECISIONS.md D15](docs/DECISIONS.md#d15--ci-runs-both-locally-and-in-github-actions)):

There are **two suites**, and they cover different failure modes:

| Suite | What it proves |
|---|---|
| `scripts/smoke_test.sh` | The REST surface: every migration applies, each module's seed populates, append-only and close-once rules hold, and the ADR 0011 access matrix behaves across guest / user / superuser. **89 assertions.** |
| `scripts/browser_test.sh` | The *rendered* field path: `/t/{tag}` serves a populated page, the LOTO honesty line and freshness stamp are present (ADR 0007), an accountless punch flag reads back, and a logged check appears in the ledger. **7 assertions.** The REST suite cannot see any of this — a broken Alpine binding would leave it green while the field tier is dead. |

| | What runs them | Behaviour |
|---|---|---|
| **Local** | `.githooks/pre-push` | Runs the REST suite on every push; runs the browser suite too when its tooling is installed, and says so when it isn't. Either failing blocks the push. Bypass with `SKIP_SMOKE=1 git push`. |
| **Remote** | `.github/workflows/ci.yml` | Runs **both** on every push and PR to `main`. The backstop for a bypassed, absent, or skipped local hook. |

Run them yourself exactly as CI does:

```sh
./scripts/setup.sh                          # once — fetches the PocketBase binary
LC_TEST_PORT=8399 sh scripts/smoke_test.sh  # REST suite
```

```sh
cd scripts/browser && npm ci && npx playwright install chromium && cd ../..
sh scripts/browser_test.sh                  # browser suite (boots its own seeded instance)
```

Both boot their own throwaway database from `pb_migrations/` and delete it on
exit — they never touch your `pb_data/`. Point the browser suite at an instance
that is already running with `LC_BASE=https://host sh scripts/browser_test.sh`.

The browser tooling is **dev-only** ([D16](docs/DECISIONS.md#d16--browser-test-tooling-is-dev-only-and-isolated)):
Playwright and its browser download are git-ignored, never vendored into
`pb_public/`, and never a runtime dependency. Hard constraint #3's no-build-step
and page-weight budget govern the shipped app, not the test harness.

CI **pins** `PB_VERSION` to the version `docs/API.md` names as the tested one,
rather than tracking latest — a PocketBase upgrade that changes REST behaviour is
a breaking change to the published contract, so moving the pin is a deliberate
act, not drift.
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
