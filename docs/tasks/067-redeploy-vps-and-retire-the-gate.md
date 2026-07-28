# 067 — Bring the VPS up to `main`, then retire the temporary gate

Status: DONE (2026-07-28 — deployment brought up to `4f2ef0f`; gate retired;
12/12 external checks passed)
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none (but do not start before the deployment can be taken briefly offline)

## Context

The internet-facing droplet is **far behind `main`** and is only safe because a
temporary Caddy `basic_auth` gate sits in front of it.

Established 2026-07-28 by inspecting the running host:

- The deployment had **11 migrations** (`1789000000`–`1789000010`) against the
  repository's **34**. No auth lockdown (`1789000019`), no PII split
  (`1789000020`), no `segments` lock (`1789000033`).
- `pb_public/lc-auth.js` was **absent** — the office pages there cannot
  authenticate at all.
- Collections that exist in the repo — `services`, `service_contacts`,
  `warranties`, `closeout_*`, `loto_events`, `segments`, `calibrations`,
  `signatures` — **do not exist on the box**.
- Its database had not been written since 2026-07-11.
- The deployed commit is not an ancestor of current `main` (its hash and message
  are absent from the repository's history entirely), so treat the droplet's
  checkout as untrusted and re-point it rather than fast-forwarding.
- **The droplet's git remote points at the wrong repository.** Its `origin` is
  the pre-org-migration personal repo (`mds08011/loopcheck`), not
  `levelbookdev/loopcheck`. That old repo still exists and still accepts reads,
  with no activity since 2026-07-15 — so a plain `git pull` on the droplet
  **succeeds and changes almost nothing**, which is the worst possible failure
  mode: it looks like the deployment updated. The remote must be re-pointed (or
  the checkout replaced) before any pull.

The gate was removed briefly during a supervised verification and an anonymous
`POST /api/collections/projects/records` returned **200** — the original
permissive Phase-1 rule. The gate was restored within about two minutes. See the
corrected removal condition in [`DEPLOY.md`](../DEPLOY.md).

**The lesson, recorded so it is not repeated:** "the repo is reconciled" and
"the deployment is reconciled" are different claims. Only the second one makes
the gate removable.

## Scope

**This is an operator task on live infrastructure.** An agent may prepare and
verify; **an agent must not remove the gate.** The final removal is the
maintainer's action, taken only after steps 1–4 below all pass.

**Touch:**
- The droplet: application checkout, migrations, service restart.
- `docs/DEPLOY.md` — once the gate is genuinely gone, replace the temporary-gate
  note with a short historical record of what happened and when.

**Leave alone:**
- Application code, schema, and seeds. If the upgrade needs a code change, that
  is a separate task — stop and report.
- The Caddy vhost beyond the `basic_auth` block itself.

## Specification

1. **Back up first.** The droplet holds a database with real demo content
   (~60 tags, checks, punch items). Take a copy of `pb_data/` off the box before
   any migration runs, per the backup section of `DEPLOY.md`. A migration set
   this far behind will apply ~23 migrations in one pass.
2. **Fix the remote, then update the checkout** to a commit at or after
   `d073a99`. Confirm `git remote -v` names `levelbookdev/loopcheck` before
   pulling anything — if it still names `mds08011/loopcheck`, a pull will appear
   to succeed while bringing in nothing. Because the deployed commit is not in
   `main`'s history, prefer re-cloning fresh over a merge; a hard reset onto the
   corrected `origin/main` is the alternative.
   Verify afterwards that `ls pb_migrations/*.js | wc -l` reports 34, not 11.
3. **Restart the service** and confirm migrations applied cleanly — the log must
   show no migration error, and the live collection set must be the full 24.
4. **Verify behind the gate first** (the gate is still up at this point, so use
   the basic-auth credential or check from the host itself): the collection set
   is complete, and a spot-check of the ADR 0011 rules behaves as
   `scripts/smoke_test.sh` expects.
5. **Only then** remove the `basic_auth` block, `caddy validate`, reload, and run
   the external verification from a machine outside the droplet.
6. **Restore the gate immediately** if any external check fails.

## Acceptance criteria

- [ ] A pre-upgrade copy of `pb_data/` exists off the droplet.
- [ ] The droplet runs a commit at or after `d073a99`; `pb_public/lc-auth.js`
      exists there; the live instance reports all 24 application collections.
- [ ] External, unauthenticated checks against the live host all hold:
      anonymous `/t/{tag}` and `/api/health` succeed; anonymous `POST` to
      `projects` and to `segments` are refused; `warranties`,
      `closeout_requirements`, `closeout_log`, `warranty_claims`, and
      `service_contacts` each **exist** and return zero rows to a guest; no
      `customer_name` or `customer_phone` appears in any anonymous response.
- [ ] The `basic_auth` block is gone from `/etc/caddy/Caddyfile` and Caddy is
      running the validated config.
- [ ] `docs/DEPLOY.md` no longer carries a live temporary-gate warning; it
      records the episode as history instead.

## Guardrails

- **Never remove the gate before step 4 passes.** The gate is currently the only
  access control on that instance.
- **Do not assert an office collection is "protected" when it may be absent.** A
  missing collection and a properly gated one both return nothing to a guest.
  Assert existence *and* emptiness.
- Keep the droplet's host, IP, and the basic-auth credential **out of this
  repository** — that rule is unchanged.
- A backup of the current gated Caddyfile exists on the box as
  `Caddyfile.gated.2026-07-28`; restoring it re-enables the gate in one command.

## Definition of done

- Acceptance criteria checked; the deployment matches the repository.
- `Status:` set to `DONE`.
- Committed as the maintainer (no AI trailer), message e.g.:
  `docs: retire the temporary VPS gate after bringing the deployment up to main`.
