# ADR 0011 — Auth lockdown: a small public allowlist, everything else signed in

**Status:** proposed · **Date:** 2026-07-10

**Implementation status (CURRENT, 2026-07-12):** migrations `1789000019` and
`1789000020` implemented the selective rules, `users.role`, disabled signup,
and the `service_contacts` PII split even though this ADR was never advanced
from Proposed. The committed office frontend is not fully reconciled with the
rules, and the later `segments` migration reopened public create/update for that
collection. Statements below saying no migration/rule has changed describe the
proposal when written, not current code. Decision status, implementation, API
version, and tests must now be reconciled explicitly.

This is a **decision proposal** for the maintainer to react to before any
migration touches the collection rules. Each fork below carries a
**Recommendation** (my proposed answer) and the alternatives; the forks
marked **(maintainer's call)** are the ones I most want a ruling on. The
original process intent was that no rules would change until acceptance.

## Context

LoopCheck's Phase-1 API rules are permissive for local testing — public
list / view / create on nearly every collection, with 19 `TODO(auth)`
markers scattered across `pb_migrations/`. Deletes are already superuser-only,
and the append-only collections (`checks`, `check_items`, `attachments`,
`closeout_log`, `loto_events`) reject updates and deletes regardless of auth.
Before LoopCheck is exposed to the internet, the permissive rules have to
close. At the time this proposal was written, an internet-facing LoopCheck was
a world-writable demo; the implementation-status note above records the
selective rules that have since landed and the reconciliation still required.

The `TODO(auth)` comments all say the same thing: *change every `""` rule to
`@request.auth.id != ""`*. That is exactly what the sibling TrenchNote did
([TrenchNote ADR 0004](https://github.com/levelbookdev/trenchnote): everything
locked, one shared field account, no public read at all). **LoopCheck cannot
copy it**, and the reason is the whole difficulty of this ADR:

- **Hard constraint #1 forbids a blanket lockdown.** A laborer with a stock
  camera and no account must scan a QR, see equipment status, and flag a
  punch item. Some reads and at least one create *must stay accountless* on
  an internet-facing box. TrenchNote could lock everything because everyone
  who touches it is already a signed-in crew member; LoopCheck's field tier
  is defined by the absence of an account.
- **Safety visibility is never paywalled or gated** ([ADR 0007](0007-loto-visibility-staleness-asymmetry.md)):
  the LOTO board and tag banners must be *readable* with no account.
- **PII cannot be hidden by a collection rule.** PocketBase rules are
  collection-level, not field-level. The public service page must exist
  (field tier), yet `services.customer_name` / `customer_phone` must not be
  publicly readable ([ADR 0006](0006-service-connections-third-subject.md)
  recorded this as an obligation for *this* ADR).
- **The paid sidecar needs a role** ([ADR 0003](0003-core-premium-sidecar-boundary.md)):
  a read-only service account it authenticates as, landing *with* the
  lockdown so tightening the rules doesn't break it.
- **Signatures just arrived** ([ADR 0010](0010-signatures-and-turnover-package.md),
  proposed): a signature attests identity, which is an auth question.

So the work is not a find-and-replace. It is a per-operation access decision
under a hard "keep the field tier accountless" constraint, plus one
structural change (the PII split) that no rule can substitute for.

## Decision (proposed)

### 1. Four access tiers

| Tier | Who | How they authenticate |
|---|---|---|
| **Public** | anyone, no account | no token |
| **Field/office (authenticated)** | crews + PMs | accounts the maintainer creates; no self-signup |
| **Admin** | the operator | PocketBase superuser |
| **Sidecar** | the paid read-only sidecar | a `service` role account (see §5) |

### 2. The access matrix

The public surface is a **deliberate, small allowlist** — everything not on
it requires the authenticated tier. Grouped by behavior:

| Collections | list / view | create | update | delete |
|---|---|---|---|---|
| `tags`, `systems`, `projects`, `checklist_templates`, `template_items` | **public** (read) | auth | auth | admin |
| `services` (PII split out — §4) | **public** (read) | auth | auth | admin |
| `checks`, `check_items` | **public** (read) | **auth** | never | never |
| `punch_items` | **public** (read) | **PUBLIC** (§3) | auth (close) | admin |
| `attachments` | **public** (read) | **public** *for a punch photo*, else auth (§3) | never | never |
| `loto_events` | **public** (read — safety) | auth | never | never |
| `test_equipment`, `warranties`, `closeout_requirements`, `warranty_claims` | auth | auth | auth / close-once | admin |
| `closeout_log` | auth | auth | never | never |
| `service_contacts` (new, §4) | **auth** | auth | auth | admin |
| `signatures`, `turnover_packages` (ADR 0010) | **public** (read — a turnover package is a shareable deliverable) | auth | never | never |

Reads stay public for everything a scanned QR needs to render (tags,
services minus PII, LOTO, checks/history, punch items, turnover packages) and
for the field-facing equipment/template data. Reads go behind auth only where
the row is office/back-office data with no field-scan surface (the equipment
registry, warranty/closeout facts, the contacts split). This is the inverse
of TrenchNote's choice, and deliberately so — LoopCheck's equipment list is
not a "shopping list of unattended sites"; it is bolted to concrete inside a
fenced plant, and the QR-scan-shows-status promise depends on public reads.

### 3. The one public write — punch flagging **(maintainer's call)**

Constraint #1 names exactly one accountless *write*: "flag a punch item." The
proposal takes that literally and no further.

**Recommendation:** `punch_items` **create** stays public, and an
`attachments` create stays public *only* when it parents a punch item (its
photo). **Everything else that writes — including logging a check — requires
the authenticated tier.** Rationale:

- "Log a check" is a commissioning tech's deliberate act, not a passing
  laborer's. It being *free forever* (ROADMAP) is a pricing promise, not an
  accountless one — free ≠ anonymous. A shared field account (below) keeps it
  zero-signup while stopping an open internet instance from taking injected
  append-only checks it can never delete.
- A stray *punch item* is cheap and self-correcting: it is closed or
  superseded, never deletes anything, and the whole point of the field tier
  is that flagging a defect must never hit a wall.

**Integrity of the public punch write** (the spam question): lean on
append-only + PocketBase's built-in rate limiting + the fact that exposing an
instance is opt-in. A vandal can add noise; they cannot destroy the ledger,
and corrections are new records. If abuse ever appears, a per-project
"accept-public-punch" toggle or a lightweight project field-token is a small
follow-up — **not** a CAPTCHA (friction on the one flow that must never have
any, and bot-detection is the wrong tool for a defect report).

**Alternative (if you want zero-friction check-logging too):** issue a
per-project **field token** — a capability embedded in the project's QR base
or a short PIN — that authorizes create without a personal account, so
check-logging stays signup-free while still being gated to people who have
the project's code. More machinery; revisit only if a real deployment wants
accountless check-logging.

### 4. The PII split — structural, because no rule can do it

`customer_name` and `customer_phone` move out of `services` into a new
**`service_contacts`** collection (one-to-one, `service` relation), whose
read rule is `@request.auth.id != ""`. `services` stays publicly readable and
carries **no PII**; the service page, cutover board, batch notice, and labels
read `services` exactly as today with no `fields=` gymnastics required,
because the sensitive columns are simply not there. Authenticated office
views join `service_contacts` when they need the person.

This is the only honest fix: PocketBase has no field-level read rule, so a
public `services` with hidden columns is impossible. Today's `fields=`-list
convention is discipline the pages happen to follow; this makes it mechanical
and un-bypassable. **Recommendation: adopt the split.** The migration moves
the two columns and their data, then drops them from `services`.

### 5. The sidecar service account

A `role` field on `users` (`field` | `pm` | `service`), or a dedicated
minimal auth collection if you'd rather not overload `users`. The sidecar
authenticates as a `service`-role account; read rules that are otherwise
`@request.auth.id != ""` already admit it, and it is never granted create /
update on anything (read-only in v1, ADR 0003). **Recommendation:** a `role`
field on `users`, because it is one field and the sidecar is just a user with
no write grants — no new collection to maintain.

### 6. Auth mechanics — ported from TrenchNote, adapted

- **Shared field account per crew/project, personal accounts for PMs**, all
  created by the maintainer in the admin UI. **`users.createRule = null`** —
  no self-signup, or the lockdown is decorative.
- **One `lc-auth.js`**, the single exception to the self-contained-page
  convention ([ADR 0001]-equivalent reasoning, and TrenchNote's `tn-auth.js`
  precedent): auth logic duplicated across ~15 pages would drift, and drift
  in auth code becomes lockouts or holes. Token in `localStorage`, validated
  and renewed via `auth-refresh` on load so a phone in daily use never logs
  out.
- **`login.html` preserves `?next=`** so a scanned QR → login → the tag/
  service page it pointed at. Printed labels keep working after the one-time
  sign-in.
- **Offline** (LOTO ADR 0007, and generally): trust the local token offline,
  let the server re-judge on reconnect — the queued apply/notice write
  carries the token and is accepted or rejected when it syncs (TrenchNote
  ADR 0008's rule). The public punch-flag path needs no token at all, so it
  works offline unconditionally.
- **Gotcha to document:** PocketBase treats a missing/invalid token on a
  read as a *guest* — empty list, 200, not 401. Expiry detection lives in the
  `auth-refresh` check, not in response status.

### 7. Signatures & performed_by **(maintainer's call)**

**Recommendation:** a **signature requires an authenticated account** — a
signature is an attestation of identity and is worthless if anyone can mint
one. But `checks.performed_by` / `witnessed_by` **stay free text**: with a
shared field account the token says which *crew*, not which *person*, so the
typed name remains the person-level answer, exactly as TrenchNote kept
`moved_by` free text. If per-person accountability is ever required, that is a
later ADR that converts these to user relations.

## Consequences

- Printed QR labels survive the lockdown (login preserves the deep link); the
  scan-shows-status promise survives because reads stay public by design.
- The public write surface shrinks to exactly one create (punch flagging +
  its photo) — the tightest reading of constraint #1 that still lets a
  laborer report a defect with no account.
- PII is structurally protected, not convention-protected; the ADR 0006
  obligation is discharged.
- The sidecar has a role the day rules tighten, so premium doesn't break.
- **Work to land it:** one migration that rewrites ~19 rules *non-uniformly*
  per the matrix (this is why it can't be a find-replace) + the
  `service_contacts` split migration and data move + the `users.role` field;
  frontend gains `lc-auth.js`, `login.html`, and the service pages re-point
  their PII reads at `service_contacts`; API.md gets a contract version bump
  (operations stay, auth becomes required) and DEPLOY.md loses its
  world-writable warning.
- A lost phone is handled by rotating the shared account's password; every
  phone re-authenticates on next use.
- The rejected alternatives are one rule away if needs change: a fully public
  read-only mirror is "set `listRule`/`viewRule` back to `""`."

## Alternatives rejected

- **Blanket `@request.auth.id != ""` on every rule** (the literal TODO(auth)
  text, and TrenchNote's model). Rejected — it locks the public read surface
  and the accountless punch flag, breaking hard constraint #1 and ADR 0007's
  never-paywalled safety visibility.
- **A field-level read rule to hide the PII columns.** Rejected — PocketBase
  has none; the split is the only mechanism.
- **Keeping PII in `services` behind the `fields=` convention.** Rejected —
  it is discipline, not enforcement; one careless query leaks it.
- **CAPTCHA / bot-detection on the punch-flag flow.** Rejected — friction on
  the one flow that must have none, and it is the wrong tool for a defect
  report.
- **Public self-signup** (`users.createRule = ""`). Rejected — makes the
  whole lockdown decorative.
- **Per-person accounts on every field action.** Rejected — kills the
  gloved-hands field flow; the shared field account is the proven shape.
