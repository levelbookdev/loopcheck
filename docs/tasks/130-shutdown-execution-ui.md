# 130 — Shutdown execution UI: the 2 AM page

Status: TODO
Milestone: M2 Shutdown Runbooks + Punch List (v0.10.0)
Depends on: 120

## Context

This is the page the whole module exists for, and the hardest UI in the product.
It is used **at 2 AM, in rain, wearing gloves, on a live main, with a district
operator and an inspector standing there and a negotiated window burning**. The
UI bar was fixed before any of this was designed (`CLAUDE.md`, ROADMAP M2,
ADR 0019): **zero navigation taps, glove-sized touch targets.**

Read ADR 0019's safety framing before writing a line. The single rule that
governs every decision on this page: **it records and coordinates; it never
authorizes.**

## Scope

**Create:** `pb_public/shutdown.html`.
**Leave alone:** planning (`120`), the board and report (`140`), all schema.

## Specification

1. **Zero navigation taps.** Everything needed during the window is on one
   screen: the current step, the next step, elapsed vs. planned, the active hold
   point if any, and the contingency list one tap away. No menus, no tabs, no
   modals that must be dismissed before logging.
2. **Log an event in one tap.** Start / complete are the two hot actions and are
   the largest targets on the page. Each writes one append-only
   `shutdown_step_events` record with a `client_token`, freezing
   `frozen_description` and `frozen_role_key` onto the event.
3. **Hold points: prominent, and never blocking.** An unreleased hold point is
   the loudest thing on the screen. The release action is available to whoever
   is standing there — accountless (below). **Nothing on this page prevents
   logging any step at any time.** If you find yourself writing a disabled
   button because a hold point is unreleased, stop: that is the app claiming
   authority, and ADR 0019 forbids it.
4. **Contingencies are invocable.** The four trigger/action pairs are readable
   in one tap, and invoking one writes a `contingency_invoked` event with who
   decided and a note. This is the highest-value record on the page — today that
   decision survives only in someone's memory.
5. **Abort.** One deliberate action (confirm-to-fire, since it is
   consequential), writing an `aborted` event with reason and decider. The
   shutdown **stays open** and restore steps keep logging normally — ADR 0019 §6.
   Standing then derives *aborted — restoring*, then *aborted — restored*.
6. **Elapsed vs. planned, derived live.** Actual event timestamps against
   `planned_offset_min` from `planned_window_start`. "We are 20 minutes behind"
   is the number the superintendent is actually managing.
7. **Accountless.** Logging events requires **no sign-in** (hard constraint #1).
   A hold-point release may optionally attach a `signatures` record for
   evidentiary weight; optional, never required — a required signature is a
   block wearing a different hat.
8. **Offline honesty.** If a queue is added, follow ADR 0007's asymmetry:
   queueing a *write* is fine and it must render as "not yet synced," never
   silently missing. **Displayed state must never overstate freshness.** Do not
   build a general offline layer (D13); if you queue, queue only this page's
   event writes, with `client_token` making retries idempotent.

## Acceptance criteria

- [ ] The critical path — open the shutdown, start a step, complete it — is
      reachable with **zero navigation taps** from the page load, verified by
      walking it, not asserted in prose.
- [ ] Touch targets on the hot actions meet the glove-sized bar (≥ 60 px), and
      the page is usable one-handed on a small phone viewport.
- [ ] Every logged action creates exactly one append-only event; a double-tap or
      a retry creates **one** record, not two (`client_token`).
- [ ] An unreleased hold point renders unmissably and **does not disable any
      control** — proven by logging a later step while a hold point is open.
- [ ] Invoking a contingency records which one, who, when, and a note.
- [ ] Abort records reason + decider, and restore steps still log afterwards
      against the same shutdown.
- [ ] Elapsed-vs-planned is derived at render; no stored progress field exists.
- [ ] Everything works **signed out**.
- [ ] The browser smoke test (`scripts/browser_test.sh`) gains a shutdown path:
      load → start step → complete step → read the event back.
- [ ] Page JS within the ~50 KB budget; no new library.

## Guardrails

- **Never render a green "safe to proceed."** No interlocks, no permissions, no
  all-clear. Same doctrine as LOTO, and the reason the LOTO module has no green
  state at all.
- **No stored status** — a step's state is its latest event; the shutdown's
  standing is a fold. Constraint #4.
- Corrections are **new events**. Never offer an edit or delete on a logged
  event; a mis-log is fixed by appending, exactly like `checks`.
- Resist adding a confirm dialog to the hot actions. Confirms are for `abort`
  only; on the two actions used fifty times a night they are a tax paid in the
  worst conditions the product has.

## Definition of done

The page works end to end signed-out against a seeded shutdown; browser test
extended and green; docs updated (`ARCHITECTURE.md` §6, landing page if this is
user-visible on the public site); committed as the maintainer, e.g.
`feat(ui): shutdown execution page (ADR 0019)`.
