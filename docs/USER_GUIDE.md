# LoopCheck — User Guide

Crew-facing how-tos, written for the person standing at the equipment.
Setup and deployment live in the [README](../README.md) and
[DEPLOY.md](DEPLOY.md).

## Lockout / tagout on the tag QR

**Scan the thing before you touch the thing.** Every piece of equipment
wears a QR code. Scan it with your phone camera — no app, no account —
and the very top of the page tells you if anyone has a lock on it.

**Read the banner first.**

- **Red — LOCKED OUT.** Someone is working on this equipment. Every
  active lock shows: who hung it, their trade, when, why, and a photo of
  the lock on the isolation point. More than one lock is normal — the
  equipment is not clear until every lock is gone.
- **Amber — STALE or UNKNOWN.** The phone couldn't reach the server, or
  the data on screen is more than 10 minutes old. Treat it as no
  information.
- **Grey — "No locks recorded as of {time}."** That is all it means. It
  is **not** a green light.

**The app is never the authority.** The locks on the equipment, the tags
on the isolation points, and your company's written energy-control
procedure are the only things that make equipment safe to work on. The
banner exists so you know to go look — it never replaces looking. Every
banner says it: **Verify physically before any work.**

**Hanging a lock?** Tap **Log lock applied**, enter your name and trade,
and take the photo of your hung lock on the isolation point — the app
will not accept an apply without the photo. If you're in a dead spot, log
it anyway: it saves on your phone and syncs when you're back in coverage.

**Removing a lock?** Tap **Log lock released** and pick which lock is
coming off. If you're logging the removal of someone else's lock
(supervisor removal), the app requires a note saying why and who
authorized it — that note is permanent. The app doesn't decide who may
remove a lock; your program does. The app just records what happened.

**Nothing is ever edited or deleted.** Applies and releases are permanent
records — who, when, why, photo. The project LOTO board shows every
active lock in the plant, oldest first, so a lock hung three weeks ago on
a forgotten valve is the first thing everyone sees.

## What needs an account, and what doesn't

**The field flow never needs an account.** Scanning a tag or service QR,
reading its status and LOTO banner, logging a check, flagging a punch item,
logging a lock apply/release, and exporting a tag's CSV all work with no login —
that is the whole point of the field tier.

**A sign-in is for the office actions:** creating a project, importing
equipment/services from CSV, closing a punch item, recording warranty or
closeout facts, and building or signing a turnover package. On the tag page, the
**Warranty** and **Closeout deliverables** sections show "requires sign-in"
until you log in — that means *not visible without an account*, never "none on
file." Accounts are created by your operator in the admin console; there is no
self-signup.

## Signing off a system for turnover

When a system is checked out, the **Turnover & signatures** page (from the
project home) builds the deliverable: a *sealed, frozen snapshot* of that
system's checkout — every check, its results, open punch items, and lock
status, captured as they stand at that moment.

**Building a package.** Pick the scope (a system or the whole project) and
tap **Build**. The app freezes the record and computes a tamper-evident
seal (a content hash). Build again after more work and it starts a new,
current package — the old one is marked **superseded**, because a signature
only ever means "I signed *this* snapshot."

**Signing.** Signing needs a login (a signature is worthless if anyone can
type any name). Tap **Sign this package**, pick your role (contractor,
owner, engineer of record, witness…), and confirm the statement — you can
add a drawn signature, but typing your name is enough. Your name, role,
time, and the exact wording are written permanently and bound to that
sealed snapshot.

**Witnessing a check.** The **Ready to witness** list shows checks the spec
requires an owner/EOR to witness that no one has witnessed yet. Tap
**Witness →** to sign the individual check; it drops off the list once
signed.

**What it is — and isn't.** This is a recorded attestation over an
unchangeable ledger, **not** a notarized or legally-qualified electronic
signature, and the page says so. It is only as trustworthy as who has
accounts on your instance. If a check is logged after a package is signed,
the page warns that the signatures no longer cover current state — re-issue
and re-sign. Print the page for the turnover binder; the compiled,
bookmarked PDF binder is the office/paid deliverable.
