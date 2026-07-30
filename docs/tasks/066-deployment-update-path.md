# 066 — Fix the documented deployment update path

Status: DONE (2026-07-30 — droplet restored to a real git checkout; the
documented update path now runs verbatim)
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 065 — **resolved, Branch A**

## Outcome

The droplet at `/opt/loopcheck/app` is a genuine git checkout again:
`origin` = `levelbookdev/loopcheck`, `HEAD` = `fa290a5` on `main`, 34 migrations,
`lc-auth.js` present. Verified `sudo -u loopcheck git pull` runs verbatim and
reports honestly (`Already up to date.`, 0 commits behind).

Sequence used: back up `pb_data` off the tree, `git clone` the now-public repo
alongside, carry across the two untracked runtime pieces (`pb_data` and the
`pocketbase` binary), swap directories, restart, verify. Data intact — 60 tags,
15 checks, 25 punch items, unchanged. All 24 collections respond; the app serves
externally at `app.ringout.app` including the `/t/{tag}` QR route.

**The public repo made this the simple path.** Task `067` had to ship a
`git archive` from a Windows machine, which arrived full of CRLF and needed
normalizing on the server. Cloning directly on Linux gave native LF —
`0` CR bytes in `scripts/smoke_test.sh` — with no conversion step at all.

Two things this run taught, folded into DEPLOY.md rather than left here:

- **Run git as `loopcheck`, not root.** The checkout is owned by the service
  account and git refuses to operate on another user's repo ("dubious
  ownership"). Cost a step on the first attempt.
- **`/api/collections` returns 401 unauthenticated** — that is the lockdown
  working, not a fault, but it looks like a failure when verifying an update.
  DEPLOY.md now says so and gives per-collection checks instead.

DEPLOY.md's `## Updating` section also gained a verification block, because a
pull that succeeds while changing nothing is exactly how this deployment drifted
23 migrations behind in the first place.

## What `065` changed for this task (2026-07-28)

The hard part of this task was the credential problem: the droplet could not
authenticate to a private repo, which is why task `067` shipped a `git archive`
artifact instead of a checkout. **The repo is now public**, so:

- `git clone https://github.com/levelbookdev/loopcheck.git` works on the droplet,
  on a fresh ARM box, and anywhere else, with no deploy key to manage.
- The **deploy-key** and **artifact-deploy** options below are no longer needed.
  Pick the straightforward one: restore a real git checkout.

**Still to do, and still a genuine defect:** `/opt/loopcheck/app` contains no
`.git`, because task `067` replaced the tree with an extracted artifact. Until
that is fixed, DEPLOY.md's `## Updating` section (`git pull`) remains false for
the live deployment. The deployed commit is recorded in
`/opt/loopcheck/app/DEPLOYED_COMMIT`.

Recommended shape now: clone fresh alongside, move `pb_data/` and the untracked
`pocketbase` binary across, swap directories, restart, and verify the live
collection count is 24 before trusting it — the same sequence `067` used, minus
the credential gymnastics.

## Context

`docs/DEPLOY.md` documents installing and updating the VPS with git:

```sh
sudo -u loopcheck git clone https://github.com/levelbookdev/loopcheck.git /opt/loopcheck/app
...
cd /opt/loopcheck/app && sudo -u loopcheck git pull
```

**Both are currently false for the live droplet.** During the 2026-07-28
upgrade (task `067`) the application tree was replaced from a clean
`git archive` artifact rather than a git checkout, because:

- the droplet's `origin` pointed at the pre-org-migration repository, so a pull
  would have silently succeeded while changing nothing; and
- the droplet has **no credentials** for the private `levelbookdev/loopcheck`,
  so re-pointing the remote would not have been enough — `git ls-remote` there
  fails with "could not read Username for https://github.com".

The result is correct and running, but `/opt/loopcheck/app` now has **no `.git`
directory**, so the documented `git pull` update path cannot work. The deployed
commit is recorded in `/opt/loopcheck/app/DEPLOYED_COMMIT`.

This is a docs-as-code defect introduced by that upgrade: the deployment works,
the documentation describing how to maintain it does not.

## The dependency on task 065

The right fix depends on whether the repository goes public:

- **If public** (065 Branch A): `git clone` / `git pull` work with no
  credentials. Restore a real git checkout on the droplet and the existing
  DEPLOY.md instructions become true again with minimal edits.
- **If private** (065 Branch B): the droplet needs either a **deploy key**
  (read-only, per-repo — the conventional answer) or a documented
  **artifact-deploy** procedure. Pick one and document it; do not leave both
  half-described.

Do not guess. If 065 is unresolved, resolve it first or ask.

## Scope

**Touch:**
- `docs/DEPLOY.md` — the install snippet and the `## Updating` section.
- The droplet, only if the chosen fix restores a git checkout.

**Leave alone:**
- The running application, `pb_data`, and the Caddy config. This task is about
  how code gets onto the box, not about what it does once there.
- The credential itself — no key, token, host, or IP enters this repository.

## Specification

1. Decide the mechanism per 065's outcome (public clone / deploy key / artifact).
2. Rewrite `## Updating` so the documented commands are the ones that actually
   work on this deployment, including how to confirm the update landed —
   migration count and `DEPLOYED_COMMIT` (or `git rev-parse HEAD`) after
   restarting.
3. Carry forward the hard-won check from `067`: after any update, verify the
   live collection count matches the repo (24) before trusting it. An update
   that appears to succeed but changes nothing is the failure mode this section
   exists to prevent.
4. If a git checkout is restored, confirm `git remote -v` names
   `levelbookdev/loopcheck` — not the pre-migration repo.

## Acceptance criteria

- [ ] Every command in DEPLOY.md's install and update sections runs successfully
      against the live droplet as written (or is explicitly marked as applying
      only to a fresh install).
- [ ] The update section states how to verify the update actually landed.
- [ ] `git remote -v` on the droplet names `levelbookdev/loopcheck`, or the doc
      explains why there is deliberately no checkout.
- [ ] No credential, key, host, or IP added to the repository.

## Definition of done

- Acceptance criteria checked.
- `Status:` set to `DONE`.
- Committed as the maintainer (no AI trailer), message e.g.:
  `docs: make the deployment update path match how the droplet is actually updated`.
