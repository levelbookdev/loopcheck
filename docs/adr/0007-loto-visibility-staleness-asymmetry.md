# ADR 0007 — LOTO visibility: an append-only lock ledger, and the staleness asymmetry

**Status:** accepted · **Date:** 2026-07-10
Adds the LOTO (Lockout/Tagout) Status Board module: one append-only
collection (`loto_events`), a tag-page banner + apply/release flow +
history, and a per-project board. Free tier, permanently.

## Context

During commissioning a plant is half-live: some systems energized, some
locked out, multiple trades working around each other. LoopCheck already
puts a QR code on every piece of equipment. A scan of PMP-3101 should
show — before anything else — whether that equipment is locked out, by
whom, and since when. *Scan the thing before you touch the thing.*

The trap in building this is obvious and lethal: any software display of
lockout status invites someone to treat it as authority. It is not. The
physical locks, the tags on the isolation points, and the written
energy-control procedure are the only authority; real programs have
strict supervisor-removal procedures that live entirely outside
software. LoopCheck's role is a **visibility layer** — it records, it
never authorizes. Every design decision below follows from refusing to
let the app become part of the energy-control decision.

## Decision

### The staleness asymmetry — writes may queue, displayed status never pretends

This module deliberately treats the two directions of offline behavior
**differently**, and this asymmetry is the load-bearing decision:

- **Logging events tolerates delay.** An electrician in a radio dead
  zone can still record an apply; the event syncs when coverage
  returns. A LOTO event that is true but arrives late is still true —
  `performed_at` is client-set (the lock was hung when it was hung),
  `created` is the server log stamp, the same split as
  `checks.performed_at`. The tag page keeps a small `localStorage`
  outbox and retries; if the browser's quota can't hold a queued photo,
  the page falls back to holding the form state on screen with an
  explicit retry — it never silently drops an event.

- **Displayed status tolerates nothing.** A cached "no locks shown"
  presented confidently is the dangerous failure mode: it reads as
  *safe*, and it may be minutes or days behind the physical plant.
  So every LOTO status display carries its data-freshness timestamp
  and the line **"Verify physically before any work."** If the data on
  screen is older than **10 minutes** (fetch failed and the page fell
  back to cache, or the page has simply sat open), the banner area
  degrades to an unmissable amber **"STATUS MAY BE STALE — last synced
  {time}. Verify physically."** state instead of any confident
  presentation.

- **Absence of locks is never an affirmative claim.** A tag with no
  known locks displays *"No locks recorded as of {time}"* — a statement
  about the ledger, never a green light, never "not locked out," never
  a safety claim. There is no green state anywhere in this module.

Why the asymmetry: a late write converges to the truth; a stale read
masquerades as it. The rest of LoopCheck can afford optimistic reads —
a punch-item list ten minutes old wastes a walk. A lock display ten
minutes old can put a hand in an energized cabinet.

### One append-only collection, derived lock state

`loto_events` is a single ledger with an `action` enum (`apply` |
`release`) rather than a mutable "locks" table with a status column:

- **Append-only, same enforcement as `checks`**: `updateRule: null`,
  `deleteRule: null`. Who locked what, when, and who logged the release
  and why is exactly the kind of record that must survive a dispute —
  and a lock record someone can edit is worthless in one.
- **A tag is LOCKED OUT if any `apply` event has no `release`
  referencing it** (`applies_to`, a self-relation). Derived, never
  stored (hard constraint #4). Multiple simultaneous locks per tag are
  normal (group LOTO) — the tag shows **all** active locks and remains
  locked out until every one is released. There is no per-lock status
  field to drift; a redundant second release of the same apply is
  harmless to the derivation and stays visible in the ledger.
- **Release is a recorded act, not a permission.** The app never
  enforces who may release a lock — supervisor-removal procedures live
  outside software. It records who logged the release and why:
  `released_by_note` is **server-required whenever the releaser's name
  differs from the lock holder's** (`applies_to.lock_holder_name =
  lock_holder_name || released_by_note != ''` in the createRule), so a
  supervisor removal always carries its justification into the
  immutable record.
- **Release integrity is in the createRule**, because append-only means
  a malformed record is permanent (the ADR 0001/0006 reasoning): a
  release must reference an `apply` event on the **same tag**; an apply
  must not reference anything.
- `project` is denormalized from the tag (the `punch_items` /
  `warranties` precedent) so the project board filters flat.

### The photo is a field on the event, not an attachment

Deviation from the polymorphic `attachments` pattern, and deliberate: a
**photo of the hung lock/tag on the isolation point is required on
`apply`** — it is constitutive evidence, not optional decoration. The
existing two-step create-then-attach sequence could fail between steps
and permanently strand an append-only apply event with no photo, and no
server rule on `attachments` can require a child record to exist. A
direct `photo` file field makes the record atomic — one multipart POST
carries the event and its evidence — and lets the createRule enforce it:
`action = 'apply' && photo != ''`. On `release` the photo is encouraged,
not required (the createRule's release branch doesn't demand it).

### Free tier, permanently

Everything in this module — banner, apply/release, board, history — is
free tier. **Safety visibility is never paywalled.** Future hosted-tier
work is derivation-on-top, per the ADR 0003 boundary: notification
digests ("lock active > 7 days on RAS-PMP-2"), cross-project boards.

## Consequences

- The API contract grows from fifteen to **sixteen collections** —
  additive, contract v1 stands, `docs/API.md` updated (the ADR
  0004/0005 precedent). Third-party clients that render LOTO status
  inherit the display obligations: freshness timestamp, the
  verify-physically line, no affirmative all-clear.
- The tag page renders the lockout banner **above everything else** —
  above the equipment identity, above punch items. Highest-consequence
  information first.
- The project LOTO board sorts active locks **oldest first** with a
  visible lock age. Old locks are how equipment gets forgotten in a
  half-state through a commissioning season; age visibility is the
  board's real job.
- ARCHITECTURE.md's rejected list gains: **the app as part of
  energy-control decisions** — interlocks, release permissions, "safe
  to work" indicators. Any feature request in that direction is a no.
- CLAUDE.md gains the module's safety framing verbatim, so every future
  session inherits it as a hard constraint.

## Rejected

- **Any "safe to work" / all-clear indicator.** The app must never be
  usable as evidence that equipment is safe to touch. A green state is
  a design defect in this module, not a UX improvement.
- **Enforcing release permissions in software** (only the holder may
  release, supervisor override roles). That would make the app part of
  the energy-control procedure. The app records; the program decides.
- **A mutable `locks` table with a status column.** A lock row that
  flips `active → released` in place is an edit to a safety record;
  the two-event ledger keeps both acts and their authorship immutable.
- **Photo via the polymorphic `attachments` two-step.** Non-atomic, and
  the photo requirement would be unenforceable server-side (see above).
- **A confident green "not locked out" display.** Absence of records is
  not absence of locks. "No locks recorded as of {time}" is the
  strongest statement the app is allowed to make.
- **Treating cached status like the rest of the app's optimistic
  reads.** Everywhere else, stale data wastes time; here it can hurt
  someone. Hence the explicit amber stale state and the 10-minute
  threshold.
