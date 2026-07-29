# 055 — Bump GitHub Actions off the deprecated Node 20 runtime

Status: DONE (2026-07-28 — run `30471431474` green, annotation gone)
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 050

## Outcome

Bumped to `checkout@v7`, `setup-node@v7`, `cache@v6`. **The majors guessed in
this task's spec (v5) were wrong** — checking rather than assuming was the point
of that instruction, and it paid.

Release notes reviewed: all three majors are ESM migrations plus dependency
updates, with no change to the inputs this workflow uses. `checkout@v7` adds a
fork-PR restriction scoped to `pull_request_target` / `workflow_run`; this
workflow uses plain `pull_request`, so it is unaffected.

Verified on run `30471431474`: green, **no annotations at all** (the deprecation
notice is gone, which is the thing being fixed — a green run alone would not have
proved it), both suites still passing at 89 and 7, and all three caches
restoring rather than re-downloading.

## Context

`.github/workflows/ci.yml` is green, but every run emits this annotation:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are being
> forced to run on Node.js 24: `actions/cache@v4`, `actions/checkout@v4`,
> `actions/setup-node@v4`.

Nothing is broken — GitHub is transparently running them on Node 24 — so this is
housekeeping, not a fix. It is queued rather than done inline because bumping a
pinned action version is a change that should be verified by a real run, not
assumed, and it should not ride along inside an unrelated commit.

Two reasons not to leave it indefinitely: the forced-runtime shim is a
compatibility measure that will eventually be withdrawn, and a warning that is
always present trains a reader to ignore the annotations panel — which is where a
genuine CI problem would appear.

## Scope

**Touch:**
- `.github/workflows/ci.yml` — the `uses:` version pins only.

**Leave alone:**
- Job structure, step order, the `PB_VERSION` pin, caching keys, and both test
  scripts. This task changes action versions and nothing else.

## Specification

1. Check the current major for each action (`actions/checkout`,
   `actions/setup-node`, `actions/cache`) and move each pin to the major whose
   runtime is current — at time of writing that is expected to be `v5`, but
   **verify against the action's own releases rather than assuming**.
2. Read each action's release notes for breaking changes before bumping. In
   particular confirm the inputs this workflow uses still exist and behave the
   same: `node-version`, `cache`, and `cache-dependency-path` on `setup-node`;
   `path` and `key` on `cache`.
3. Push and confirm a real run is green **and** that the Node 20 annotation is
   gone. A green run alone does not prove it — the warning is the thing being
   fixed, so it must be checked explicitly.

## Acceptance criteria

- [ ] Every `uses:` in `ci.yml` targets a currently-supported runtime.
- [ ] A CI run after the change is green, with **both** suites still passing
      (89 REST assertions and 7 browser assertions).
- [ ] The run's annotations no longer contain the Node 20 deprecation notice.
- [ ] Caching still works — the PocketBase and Playwright cache steps report a
      hit on a second run rather than re-downloading.

## Guardrails

- Bump one thing at a time if anything goes red; a version bump that breaks CI
  should be trivially bisectable.
- Do not switch to floating tags (`@main`, `@latest`) to make the warning go
  away — pinned majors are deliberate.
- Do not "fix" the warning by suppressing annotations.

## Definition of done

- Acceptance criteria checked, including the annotation actually being gone.
- `Status:` set to `DONE`.
- Committed as the maintainer (no AI trailer), message e.g.:
  `ci: bump actions off the deprecated Node 20 runtime`.
