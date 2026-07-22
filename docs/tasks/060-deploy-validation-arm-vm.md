# 060 — Deploy validation on an ARM cloud VM (interim for the Pi promise)

Status: TODO
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 010, 020

## Context

Hard constraint #3 promises LoopCheck "runs well on a Raspberry Pi server." Real
Pi hardware is deferred (supply shortage), but the maintainer wants operational
trust before deploying on a real job
([DECISIONS.md D2](../DECISIONS.md#d2--trust-before-features-m1-comes-first)).
The cheap interim is validating the **actual ARM binary path** and the clean
install/backup/restore procedure on an ARM cloud VM
([D14](../DECISIONS.md#d14--deployment-topology-labeling)). Real Pi hardware
validation stays an M3 item. See ROADMAP → M1 and the Raspberry Pi track.

**This task has a manual/operational component.** If the executing agent cannot
provision a cloud VM, it must still do everything it *can* verify locally/in-repo
and produce the validation runbook + a clearly-marked "pending live run" record,
then hand the live steps to the maintainer. Do not fabricate results
(`CLAUDE.md`: report outcomes faithfully).

## Scope

**Touch/create:**
- `docs/DEPLOY.md` — add an "ARM validation" record section and reconcile the
  topology labeling (LAN/single-VPS supported; Pi/replica unvalidated) if task
  `020` didn't already fully land it there.
- Optionally a `docs/deploy-validation.md` runbook if `DEPLOY.md` would get too
  long — but prefer keeping it in `DEPLOY.md`.

**Leave alone:**
- Application code, schema, scripts (unless a genuine deploy bug is found — then
  **stop and report**, don't silently patch).

## Specification

1. **Target.** An ARM64 (aarch64) cloud VM — e.g. Hetzner CAX11, AWS Graviton,
   or Oracle free-tier Ampere — running a mainstream Linux. This exercises the
   `linux/arm64` PocketBase binary that `scripts/setup.sh` selects, which an x86
   droplet cannot.
2. **Validation steps (record the actual result of each):**
   - Fresh OS: `git clone` the repo, run `scripts/setup.sh`, confirm it fetches
     the correct ARM binary.
   - First `serve`: confirm all migrations + the seed library apply cleanly.
   - Follow `docs/DEPLOY.md` Option A (systemd unit) verbatim; confirm the
     service starts, survives a reboot, and survives a `systemctl restart`.
   - Seed the demo (`scripts/seed_demo.sh`); confirm a tag page is reachable over
     the network and the QR label sheet renders.
   - Backup/restore: perform the stop-copy-start backup per `DEPLOY.md`, restore
     onto a second box (or a fresh VM), and confirm the data is intact.
3. **Record.** In `DEPLOY.md`, add a dated validation record: VM type/arch, OS,
   PocketBase version, which steps passed, and anything the run taught (fold real
   corrections back into the deploy instructions). Mark topology honestly:
   LAN/single-VPS **supported**; Raspberry Pi/replica **unvalidated (pending
   hardware)**.

## Acceptance criteria

- [ ] `docs/DEPLOY.md` contains a dated ARM-VM validation record covering: setup
      fetches the ARM binary, migrations+seed apply, systemd Option A starts and
      survives reboot, demo tag page reachable, and backup→restore verified — each
      marked pass/fail with real results (or clearly marked "pending maintainer
      live run" if the agent could not provision a VM).
- [ ] Topology labeling in `DEPLOY.md` is honest and consistent with
      `docs/current-state.md` (LAN/single-VPS supported; Pi/replica unvalidated).
- [ ] Any correction the live run surfaced is folded into the deploy steps
      themselves, not just the record.
- [ ] No application/schema/script change (or, if a deploy bug was found, it is
      reported as a finding and the task is marked `BLOCKED` with the reason,
      not silently patched).

## Guardrails

- **Never fabricate a validation result.** If a step wasn't actually run, mark it
  "pending live run" and hand it to the maintainer. Faithful reporting is a hard
  rule.
- Provisioning a cloud VM may incur cost and requires the maintainer's cloud
  account — the agent must not create paid cloud resources on the maintainer's
  behalf without explicit approval. Prepare the runbook and ask.
- Keep this an interim record; it does **not** satisfy the Pi promise — the M3 Pi
  acceptance checklist (ROADMAP) still stands.
- Do not commit any secrets, VM IPs, or credentials into the repo.

## Definition of done

- Validation record present (real results or clearly-marked pending), topology
  labeled honestly, deploy steps corrected if the run taught anything.
- `Status:` set to `DONE` (or `BLOCKED (reason)` if a real deploy bug must be
  fixed first, or `IN PROGRESS` if awaiting the maintainer's live run).
- Committed as the maintainer, message e.g.:
  `docs: record ARM cloud-VM deploy validation and honest topology labeling`.
