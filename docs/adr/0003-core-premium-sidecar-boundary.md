# ADR 0003 — Core/premium boundary: premium is a sidecar on the public REST API

**Status:** accepted · **Date:** 2026-07-09
**Provenance:** ported from the sibling TrenchNote repo's
[ADR 0011](https://github.com/levelbookdev/trenchnote/blob/main/docs/adr/0011-core-premium-extension-boundary.md),
adapted for LoopCheck's collections, invariants, and — critically — its
different, still-unsolved auth problem.

## Context

LoopCheck is open-core: the AGPL core (everything a field crew touches —
scan a tag, see status, flag a punch item, log a check) is free forever;
office-facing deliverables *derived from* the ledger (the compiled turnover
binder, commissioning risk alerts, dashboards, notifications) will be
commercially licensed. The guiding rule, same as TrenchNote's: **the ledger
is free, insight about the ledger is paid.**

That forces the same architectural decision TrenchNote faced: through what
boundary may premium code interact with the core? The boundary must keep
the license line clean, keep the core fully functional on a commissioning
trailer's Raspberry Pi with zero premium code present, and be usable by any
third party — premium gets no private doors.

## Decision

Premium is a **sidecar**: a separate application, in a separate private
repository, that talks to the core's PocketBase REST API over HTTP exactly
as any external client would.

### The boundary

- Premium may use **only the core's public, documented HTTP API**: the REST
  endpoints for the core's collections, the file-URL pattern, and
  PocketBase's realtime (SSE) subscriptions.
- Whatever premium can call, **any third party can call the same way**,
  with the same documentation. If premium needs a capability the API lacks,
  the capability lands in the *core* — AGPL, migrated, documented, for
  everyone — never as a private side channel.
- No shared process, no reading `pb_data/` or the SQLite file, no importing
  core source into premium or premium source into core.

This process is already proven here: every capture-side field premium's
modules need (`area`, `planned_startup`, `witness_required`, …) landed in
AGPL core first, with its own ADR
([ADR 0002](0002-capture-side-fields-before-crews-log.md)), exactly as this
boundary prescribes — before any premium module exists to use them.

### Contract surface (v1) and stability promise

The full surface is documented in [docs/API.md](../API.md). The contract
collections' record shapes, semantics, and rules cannot change without a
new ADR *and* a version bump announced in the release notes. Load-bearing
invariants of the contract:

- `checks`, `check_items`, and `attachments` are **append-only** — no
  client, premium included, can ever update or delete them.
- **A check's subject is a tag XOR a system**, enforced by the collection's
  server-side create rule ([ADR 0001](0001-seed-reconciliation-and-check-subjects.md)).
- **Status is always derived, never stored** — a tag's standing from its
  checks evaluated against its required phases (the phases that have a
  template for its tag_type); a system's readiness from its tags' checks,
  its own checks, and open A-severity punch items.
- **Tag numbers are unique per project**, and QR labels encode
  `{baseUrl}/t/{tag_number}` — a printed-label contract.
- The core documents which PocketBase version each release is tested
  against; a PocketBase upgrade that changes REST behavior is a breaking
  change.

### Auth boundary — implementation landed; reconciliation remains open

Migrations `1789000019` and `1789000020` have since implemented a selective
lockdown and structural PII split while ADR 0011 still says Proposed. The
harder constraint remains: the no-install, no-account field tier means
flagging a punch item and the deliberately public field paths cannot be lost
in a blanket auth sweep.

What this ADR fixes now, so the future auth ADR inherits obligations
rather than options:

- The auth ADR **must define the service-account role** the paid sidecar
  authenticates with — an ordinary account with ordinary API-rule
  permissions, never a superuser credential.
- The auth ADR must preserve the tag-XOR-system create-rule shape check
  while tightening who may create.
- Before internet exposure, the committed office client must consistently send
  tokens, later collections must receive the intended rules, and the complete
  access matrix must be tested. Premium development must not become an excuse
  to defer that reconciliation.

### Copyright and contributions

The maintainer holds sole copyright in the core, which is what makes the
open-core model legally possible. **External contributions require either
a CLA or a DCO before acceptance** — which of the two is deferred, but the
requirement is recorded now, before the first outside patch, because
accepting even one contribution without it creates a co-copyright-holder.
See [CONTRIBUTING.md](../../CONTRIBUTING.md).

### Premium must never

1. Gate, degrade, or be required for any core field workflow. A core
   instance with zero premium code present is the fully supported product.
2. Modify the core schema, API rules, or migrations. All schema is core.
3. Write to the checks ledger, or to any collection, in v1 — **premium is
   read-only**. If a future module needs a sanctioned write (e.g. a witness
   portal acknowledging a check), that write is added by a new ADR, through
   the same public API and server-side validation as every other client.
4. Become a dependency of core code — no imports, no bundling, no "premium
   detected" branches in core pages.
5. Run inside the core's process or touch `pb_data/` directly.
6. Assume it runs on the Pi. Premium runs *off-box*, pointed at the core's
   API, with polite polling or SSE — the trailer box serves field scans
   first.
7. Use any endpoint, header, or behavior not in the public docs.

## Alternatives rejected

Same analysis as TrenchNote's ADR 0011, and it transfers whole:

- **PocketBase hooks / plugin layer** — Go plugins mean compiling a custom
  binary (a build step, violating hard constraint #3); JS hooks put
  proprietary files inside the core's folder, couple premium to the
  embedded JS VM, let a premium bug crash the process serving field scans,
  and are exactly where AGPL combined-work questions get murky. LoopCheck
  already uses `pb_hooks/` for the core's own `/t/{tag_number}` route —
  that stays core-only.
- **Shared database, separate app** — bypasses every API rule (fatal here:
  append-only and tag-XOR-system live in those rules), couples premium to
  internals, invites SQLite locking hazards on an SD card.
- **Private/undocumented API for premium** — the boundary is only honest if
  the door premium uses is the door everyone gets.

## Consequences

- **Zero core changes now.** One binary + one folder; free self-hosters
  untouched by premium's existence.
- Premium buyers run a second application, or buy managed hosting.
- The nine contract collections become harder to refactor: breaking
  changes need an ADR + announced contract version bump.
- Open dependencies: the auth ADR (with its accountless-field-tier
  constraint and service-account definition) and the CLA-vs-DCO decision.
- The license analysis is engineering input, not legal advice; the
  maintainer confirms the AGPL specifics separately.
