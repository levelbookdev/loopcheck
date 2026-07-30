# 060 — Deploy validation on an ARM cloud VM (interim for the Pi promise)

Status: IN PROGRESS — in-repo verification done and recorded; the live ARM run is
handed to the maintainer (no ARM hardware, no cloud credentials, and the
guardrail forbids creating paid resources unasked). Set to `DONE` when the
runbook in `DEPLOY.md` has been executed and the record replaced with real
results.
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 010, 020

## Outcome so far (2026-07-28)

**Verified, genuinely run:** the part of the ARM path most likely to be silently
broken — the installer's architecture mapping and the artifact it would fetch.
`setup.sh` maps `aarch64`/`arm64` and `armv7*`/`armv6*` correctly; PocketBase
0.39.6 publishes both `linux_arm64` and `linux_armv7`; the exact URLs `setup.sh`
constructs resolve (HTTP 206 on ranged requests); upstream checksums cover both.

**Not verified, and not claimed:** that the ARM binary runs, that migrations and
the seed apply on ARM, systemd behaviour, reboot survival, network reachability,
backup→restore, and anything about Pi *performance* — the "runs well" half of
hard constraint #3 is entirely unmeasured.

**Why it stopped here:** the existing droplet is `x86_64` (Ubuntu 24.04), which
by this task's own reasoning cannot exercise `linux/arm64`. No ARM provider
credentials or provisioning tooling exist on this machine (`doctl`, `hcloud`,
`aws`, `multipass`, `docker` all absent), and the guardrail forbids creating paid
cloud resources without explicit approval. A copy-pasteable runbook is in
`DEPLOY.md` for the live run.

**Finding, reported not fixed here — since fixed by task `057`:**
`scripts/setup.sh` did not verify the downloaded release against the published
`checksums.txt`. HTTPS authenticates the host, not the artifact. Left alone in
this task because it is a validation task guarded against patching scripts; the
fix landed separately.

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

## Practical notes for the live run (added 2026-07-28)

**Getting the code onto the ARM box.** The runbook says `git clone`, but this
repository is **private** and a fresh VM has no GitHub credentials — the same
wall the loopcheck droplet hit during task `067`, where a `git pull` would have
appeared to succeed while changing nothing. Pick one deliberately:

- **Deploy key** — `ssh-keygen` on the ARM box, add the public key to the repo as
  a read-only deploy key, clone over SSH. Best if the box will be kept.
- **Ship from the dev box** — `rsync`/`scp` a clean `git archive` of the commit
  under test. No credentials on the VM at all; good for a throwaway. Note the
  ARM box then has no git history, which is fine for a validation run.
- **Make the repo public** — resolves this and tasks `065`/`066` at once.

**Provider.** Any `aarch64` box works; the architecture is the point, not the
vendor. Hetzner CAX11 was the first choice but stock fluctuates. **Oracle Cloud
free-tier Ampere (VM.Standard.A1.Flex)** is the fallback and is also Ampere
Altra `aarch64`, so it validates the identical binary path.

Two Oracle-specific things that will otherwise cost an hour:

1. **Shape it DOWN.** The free tier allows up to 4 OCPU / 24 GB RAM. A 24 GB
   ARM server is a *worse* Raspberry Pi stand-in than a small one — it would
   prove the binary runs while quietly flattering the resource question. Choose
   roughly **1–2 OCPU and 4 GB** to stay near a Pi 4/5.
2. **Networking is closed by default, in two places.** Oracle blocks ingress at
   the VCN security list *and* again in the instance's own `iptables`. The
   "tag page reachable over the network" step will fail until both are opened.
   Fixing only one and concluding the app is broken is the easy mistake here.

**Still not a Pi.** Any of these share the instruction set but not the SD card,
the thermals, or the USB-power flakiness — which is where Pis actually fail. The
honest claim after this run is "the arm64 build is validated", not "Pi is
validated". Note also that a Pi on **32-bit** Raspberry Pi OS uses the separate
`armv7` build, which none of these boxes exercise.

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
