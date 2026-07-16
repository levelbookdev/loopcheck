# Review notes — ADR 0010 (Signatures & the turnover package)

Design review of [ADR 0010](0010-signatures-and-turnover-package.md) captured
before Phase 3 implementation. **C1–C3 have been folded into ADR 0010** (rev.
2026-07-10); **C4–C7 remain open** for the implementer/maintainer to decide.

**Verdict:** direction is sound and consistent with the codebase's grammar —
append-only ledger, frozen copies, derived-status discipline, the ADR-0003
free/paid line. The frozen-snapshot `turnover_packages` idea is a genuine
improvement over signing a live derived verdict. The comments cluster on two
themes: **(1) making the content hash an actually verifiable primitive**, and
**(2) carrying the ADR's own honesty about accountless signing onto the
printed artifact.**

---

## C1 — "Canonical serialization" must be pinned exactly · **RESOLVED in ADR 0010**

A hash is evidence only if an independent party can *recompute* it. The core
builder (goja), the paid sidecar, and an outside expert's tool run in
different languages and will disagree on the bytes unless key ordering,
whitespace, number/timestamp/unicode formatting, and the exact field set are
pinned. → ADR 0010 now specifies a versioned canonical form
(`sha256-canon-v1`: sorted keys, NFC, integers/decimal-strings, RFC 3339 UTC,
a per-collection field allowlist) and a **golden vector** both core and
sidecar assert against.

## C2 — Specify *what* the hash covers (check_items + attachments) · **RESOLVED in ADR 0010**

"Key immutable fields" left two gaps: the answered `check_items` (the
substance of a turnover, not just the parent check's id+result), and
`attachments` (photos are evidence; on a world-writable instance an unbound
photo can be swapped without changing the hash). → ADR 0010's manifest bullet
now names a per-collection field allowlist including ordered `check_items`,
and binds referenced attachments by file-byte digest (or `{id, filename,
size}` with the residual risk stated).

## C3 — Supersession: state the re-sign rule; design against stale-signature misreading · **RESOLVED in ADR 0010**

Signatures bind to one snapshot, so they do not carry forward — one appended
check means every signer re-attests. Correct, but it is the LOTO stale-status
failure mode in a new dress: a superseded package carrying real signatures
reads as current acceptance. → ADR 0010 now states signatures-don't-carry-
forward, defines the "current package" derivation (head of the `supersedes`
chain), and requires the print view/board to mark superseded packages
unmistakably, show outstanding required signatures, and warn when the live
ledger has drifted past a signed package.

---

## C4 — Put the accountless-identity caveat on the *artifact*, not just the ADR · **open**

**Location:** §Consequences (signer-identity rests on the open auth ADR); the
free `turnover.html`.

The ADR is admirably honest that pre-auth, anyone can POST a `signatures`
record with any name. That honesty has to live where a reader could be
misled — the signing UI and, above all, the printed `turnover.html`, exactly
as LOTO prints "Verify physically before any work." A printed turnover that
*looks* notarized but isn't is the failure mode.

**Suggestion.** Mandate a visible caveat on every signing surface and the
print view, e.g.: *"Attestation recorded in an append-only ledger. Not a
qualified electronic signature; signer identity is only as strong as this
deployment's access controls."* Tie any softening to the auth-lockdown ADR
(now drafting as ADR 0011).

## C5 — Confirm the per-check "ready to witness" flow is in Phase 3 scope · **open (scope)**

**Location:** §`signatures` ("the same collection also signs a single
check — a witnessed hold point"); ROADMAP Phase 3 ("witness_required surfaced
… 'ready to witness' lists derive from it").

The ADR centers *package-level* signing; the ROADMAP promises a *per-check*
witness workflow off the already-frozen `checks.witness_required`.
Complementary but distinct build items.

**Suggestion.** State explicitly whether per-check witness signing ships now.
If yes, define the derivation — "ready to witness" = checks with
`witness_required = true` and no `signatures` record where `subject = that
check` and `signer_role = witness` — and where it surfaces (tag.html,
system.html). If deferred, say so, so ADR and ROADMAP agree.

## C6 — Idempotent build route · **open (nit)**

**Location:** §"assembled server-side" — `POST /api/turnover/build`.

Append-only + world-writable + a server builder means a double-tap or retry
mints duplicate frozen packages, and the route is spammable pre-auth.

**Suggestion.** Make build idempotent: if the freshly-computed `content_hash`
for the scope equals the latest package's, return that package instead of
minting a new one. Carry the standard `TODO(auth)` and fold the route into the
auth-lockdown ADR's surface.

## C7 — Where the per-role statement strings live · **open (nit)**

**Location:** §`signatures` — `statement` frozen per role.

Freezing the wording onto the record is right; unstated is the *source* of the
default per-role wording and the guarantee that the record freezes exactly
what was shown to the signer.

**Suggestion.** Note where default statements live (a small seed/config is
consistent with the seed-library pattern) and that the record freezes the
exact string presented at sign time, so the UI can't later be claimed to have
shown different wording.

---

### Summary

Accept the direction. C1–C3 were the difference between "a hash" and "a
verifiable seal" and between a supersede history and a stale-signature trap —
folded into ADR 0010. C4 is a half-hour of print-view copy that keeps the
module as honest on paper as the ADR is in prose. C5 is a one-line scope
decision. C6–C7 are polish. None require reshaping the two collections or the
build route — the bones are good.
