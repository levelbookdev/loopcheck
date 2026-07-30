# LoopCheck — Deployment & Backups

How to run LoopCheck somewhere other than your laptop, and how to make sure a
dead SD card can't erase a project's checkout ledger. Same boring-ops
philosophy as the sibling TrenchNote repo: systemd + Caddy + copy-a-folder
backups, no containers.

> **Auth status — read this first.** The selective backend lockdown, structural
> service-PII split, and the closing `segments` rule are committed
> (`1789000019`/`1789000020`/`1789000033`), and ADR 0011 is **Accepted**. Public
> tag/service/ledger reads and the narrow accountless check, punch-flag, and
> LOTO create paths remain; every other write and all office/PII reads require a
> user token. The office pages now authenticate through `lc-auth.js`, and
> `scripts/smoke_test.sh` asserts the access matrix across guest, user, and
> superuser tiers. The auth reconciliation that previously blocked public
> internet exposure is **complete** — this is no longer a blocker for the VPS
> option. Standard pre-release caution still applies (no tagged stable release
> yet), and any deployment still needs an immediately claimed superuser and a
> network exposure review.

> **Exposure lockdown — RESOLVED 2026-07-28 (historical record).** On
> 2026-07-15 an internet-reachable pre-release deployment was found serving the
> app, the `/_/` admin login, and live anonymous collection reads. HTTP Basic
> authentication was added to the Caddy vhost as a blunt stop-gap; it gated
> every path, including the public no-install field tier.
>
> Retiring it needed more than "the repository is reconciled". A first attempt
> on 2026-07-28 removed the gate on repo state alone; an external check
> immediately showed an anonymous `POST` to `projects` returning `200`, and the
> gate was restored within about two minutes. The cause: **the deployment was 23
> migrations behind the repository** (11 of 34, no `lc-auth.js`, and no
> `services` / `warranties` / `loto_events` / `segments` at all), so it still ran
> the original Phase-1 permissive rules. Compounding it, the droplet's git remote
> still pointed at the pre-org-migration repository, so a plain `git pull` would
> have appeared to succeed while changing nothing.
>
> The droplet was then brought up to `main`: data backed up off-box first, the
> tree replaced from a clean `git archive` of the deployed commit (line endings
> normalised on the server — see the correction below), the untracked binary and
> `pb_data` carried across, verified behind the gate, and only then opened. Twelve external checks passed: the field tier and `/t/{tag}` work
> anonymously, anonymous writes to `projects` and `segments` are refused, the
> office and PII collections **exist and return zero rows** to a guest, and no
> `customer_name` appears in any anonymous response.
>
> **Correction (2026-07-28, same day).** The note above originally said the
> repository stores CRLF line endings. That was wrong, and the error was a
> measurement mistake: `git show HEAD:<file>` applies the checkout conversion on
> Windows and therefore *prints* CRLF for a blob that is stored as LF. Checking
> the raw bytes with `git cat-file blob` shows every tracked text blob is
> CR-free. The CRLF was introduced by **`git archive` on a Windows checkout**,
> which applies the same conversion when the archived tree has no
> `.gitattributes` — so the artifact needed normalising, not the repository.
> A committed `.gitattributes` now pins LF and removes that failure mode.
>
> **Three lessons worth keeping.** "The repo is reconciled" and "the deployment
> is reconciled" are different claims, and only the second one makes a gate
> removable. When verifying, assert that a protected collection **exists** as
> well as being empty — a collection that is simply absent looks identical to a
> properly gated one, so the check can pass for entirely the wrong reason. And
> when a tool can transform bytes on the way out (`git show`, `git archive`,
> `curl` on a URL with spaces), verify with something that cannot — raw bytes,
> not rendered output.

## First-boot hardening (any internet-reachable box)

Before the app, in this order. On a LAN-only trailer box this is optional; on
a VPS (a Digital Ocean droplet or any cloud box) it is not.

1. `apt update && apt upgrade -y`, then reboot if `/var/run/reboot-required`
   exists (fresh cloud images usually have a pending kernel).
2. **A non-root admin user, key-only:**
   `adduser --disabled-password --gecos "" deploy`, add to the `sudo` group,
   copy `/root/.ssh/authorized_keys` into `/home/deploy/.ssh/` (mode 700 on
   the dir, 600 on the file, both owned by deploy). A passwordless account
   can't answer a sudo password prompt, so grant it explicitly:
   `echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy` and
   validate with `visudo -c`. **Verify you can SSH in as deploy and that
   sudo works BEFORE the next step — and keep your root session open until
   you have.**
3. **Disable root login and passwords** with a drop-in at
   `/etc/ssh/sshd_config.d/00-hardening.conf`:
   ```
   PermitRootLogin no
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   ```
   The `00-` prefix matters: OpenSSH keeps the *first* value it sees, and
   cloud images ship a `50-cloud-init.conf` that would otherwise win.
   Validate with `sshd -t` (silence = valid), then `systemctl reload ssh`,
   then prove root is refused and deploy still works before closing anything.
4. **Firewall, allows queued before enabling:**
   `ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`.
   Note what's absent: **8090**. PocketBase binds to localhost on a VPS and is
   reachable only through Caddy.
5. `apt install unattended-upgrades` and enable it (both lines in
   `/etc/apt/apt.conf.d/20auto-upgrades` set to `"1"`), so security patches
   don't wait for you.

## Option A — a box on the LAN (commissioning trailer, plant network)

A Raspberry Pi or any always-on machine on the same network as the phones.
No domain, no TLS, no monthly bill.

```sh
sudo useradd --system --create-home --home-dir /opt/loopcheck --shell /usr/sbin/nologin loopcheck
sudo -u loopcheck git clone https://github.com/levelbookdev/loopcheck.git /opt/loopcheck/app
sudo -u loopcheck sh -c "cd /opt/loopcheck/app && ./scripts/setup.sh"    # downloads the PocketBase binary
```

(`--shell /usr/sbin/nologin`: the app account is not for humans. The `sh -c`
wrapper is because your admin user can't `cd` into the app user's home —
that's the permissions working, not a problem.)

Give the box a fixed IP (reserve it in the router). QR labels encode that
address — if it changes, every printed label dies.

`/etc/systemd/system/loopcheck.service`:

```ini
[Unit]
Description=LoopCheck (PocketBase)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=loopcheck
WorkingDirectory=/opt/loopcheck/app
# 0.0.0.0 = listen on the LAN (Option A). Behind Caddy use 127.0.0.1 instead.
ExecStart=/opt/loopcheck/app/pocketbase serve --http=0.0.0.0:8090
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now loopcheck
```

Migrations and the seed library auto-apply on first start. Claim the
superuser immediately:

```sh
sudo -u loopcheck /opt/loopcheck/app/pocketbase superuser upsert you@example.com 'a-strong-password'
```

Then import your instrument index and print labels with the Base URL set to
the box's address. **Phones must be on the same network** (the site Wi-Fi or
an office AP that reaches the yard). If crews are on cell data only, you need
Option B.

## Option B — internet-facing VPS

Any $6-tier droplet/VPS (1 GB is plenty). Option A's steps, plus the
first-boot hardening above, plus Caddy as the front door — and PocketBase
listens on localhost only:

```ini
ExecStart=/opt/loopcheck/app/pocketbase serve --http=127.0.0.1:8090
```

Install [Caddy](https://caddyserver.com/docs/install#debian-ubuntu-raspbian),
then `/etc/caddy/Caddyfile`:

```
# No domain yet: plain HTTP on the bare IP.
:80 {
    reverse_proxy 127.0.0.1:8090
}

# With a domain, replace the block above with this and Caddy fetches and
# renews certificates automatically:
#   loopcheck.example.com {
#       reverse_proxy 127.0.0.1:8090
#   }
```

```sh
sudo systemctl reload caddy
```

(The firewall was already set in first-boot hardening; if you skipped it:
`sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable`.)

Reprint labels whenever the public address changes — QR codes encode it. This
is why you don't laminate 200 labels before choosing where LoopCheck lives.

## Updating

```sh
cd /opt/loopcheck/app
sudo -u loopcheck git pull
sudo systemctl restart loopcheck    # pending migrations auto-apply on start
```

**Then confirm the update actually landed.** An update that appears to succeed
while changing nothing is the failure mode this deployment has already hit once:
in July 2026 the droplet sat 23 migrations behind `main` while `git pull`
reported success, because its remote still pointed at a repository that had
stopped receiving commits. A clean exit code is not evidence.

```sh
cd /opt/loopcheck/app
sudo -u loopcheck git remote -v          # must be levelbookdev/loopcheck
sudo -u loopcheck git log --oneline -1   # the commit you expected
ls pb_migrations/*.js | wc -l            # migration count, vs the repo's
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8090/api/health
```

Two things about running these:

- **Run git as `loopcheck`, not root.** The checkout is owned by the service
  account, and git refuses to operate on another user's repository
  ("detected dubious ownership"). `sudo -u loopcheck` is not decoration.
- `/api/collections` returns **401** to an unauthenticated caller — that is the
  auth lockdown working, not a fault. To count collections, query individual
  ones, or authenticate as a superuser.

**Pre-release caveat:** while LoopCheck is pre-1.0, schema changes may amend
already-applied migration files in place (recorded in ADR 0001). If a pull
brings edited migrations rather than new ones, wipe and rebuild — stop the
service, delete `pb_data/`, start. Pre-release deployments hold demo data
only, so this costs nothing. After 1.0 this door closes and `git pull` +
restart is always sufficient. To upgrade the PocketBase binary itself: stop
the service, delete `pocketbase`, re-run `scripts/setup.sh`, start — but read
the PocketBase release notes first, and take a backup before any binary
upgrade.

## Backups

**Back up `pb_data/` and nothing else.** The schema rebuilds from
`pb_migrations/` + `seed/` in git; the binary is re-downloadable. `pb_data/`
holds the ledger — the thing the turnover package is built from — and the
uploaded photos (punch evidence, door-hanger notices, hung-lock LOTO shots).
If LoopCheck becomes a project's source of truth, `pb_data/` on one SD card
is the single point of failure.

### Rule one: never copy `pb_data/` while the server is running

SQLite keeps in-flight writes in sidecar files (`-wal`); a naive `cp` of a
live database can produce a corrupt copy that *looks* fine until you need it.
Use one of the methods below instead.

### Method 1 — PocketBase's built-in backups (recommended)

Admin UI → **Settings → Backups**. PocketBase snapshots `pb_data/` into a zip
safely (it handles the database locking for you), on demand or on a schedule —
set the cron expression to e.g. `0 3 * * *` for nightly at 3am, and keep
several (e.g. max 7). The same screen can store backups directly in any
S3-compatible bucket (Backblaze B2, Wasabi, AWS, DO Spaces), which gets them
**off the box** — a backup on the same disk as the database protects against
nothing.

Restoring: Admin UI → Settings → Backups → restore on the zip. PocketBase
unpacks it and restarts itself.

### Method 2 — offsite copy of the backup zips

If you'd rather not hand PocketBase S3 credentials, ship the zips elsewhere on
a schedule. Built-in backups land in `pb_data/backups/`, so a nightly cron on
another machine works:

```sh
# e.g. on the office NAS / your workstation, in crontab -e:
# pull last night's backups from the loopcheck box at 4am
0 4 * * * rsync -a loopcheck@192.168.1.50:/opt/loopcheck/app/pb_data/backups/ ~/loopcheck-backups/
```

For a fully manual cold copy without the built-in system: stop the service,
copy the whole folder, start it again. Fine for a pre-upgrade snapshot; too
manual to be your only plan.

```sh
sudo systemctl stop loopcheck
tar czf loopcheck-backup-$(date +%F).tar.gz -C /opt/loopcheck/app pb_data
sudo systemctl start loopcheck
```

### Test the restore — once, now

A backup you have never restored is a hope, not a backup. Do the drill once:
on any spare machine, clone the repo, run `setup.sh`, unzip a backup into a
fresh `pb_data/` (or use the admin UI restore), start PocketBase, and open a
**tag page** — confirm its check history and open punch items are intact. Ten
minutes, and the recovery procedure is now something you've done rather than
something you believe in.

## ARM validation record

Hard constraint #3 promises LoopCheck "runs well on a Raspberry Pi server."
That promise has **not** been proven on ARM hardware. This section records
exactly what has and has not been checked, so the gap is visible rather than
assumed ([DECISIONS.md D14](DECISIONS.md#d14--deployment-topology-labeling)).

### Verified — 2026-07-28, without ARM hardware

These were actually run and are reproducible from any machine. They cover the
part of the ARM path most likely to be silently wrong: the binary the installer
selects and where it fetches it from.

| Check | Result |
|---|---|
| `scripts/setup.sh` maps `aarch64`/`arm64` → `arm64`, and `armv7*`/`armv6*` → `armv7` | **PASS** — mapping present and correct for both 64-bit Pis and older 32-bit ones |
| PocketBase 0.39.6 publishes the assets that mapping implies | **PASS** — `pocketbase_0.39.6_linux_arm64.zip` and `..._linux_armv7.zip` both exist in the upstream release |
| The exact download URL `setup.sh` constructs resolves for ARM | **PASS** — `HTTP 206` on a ranged request for both `linux_arm64` and `linux_armv7` |
| Upstream publishes checksums covering the ARM assets | **PASS** — both appear in `checksums.txt` |

### Not verified — requires real ARM hardware or an ARM VM

Nothing below has been run. **Do not treat any of it as passing.**

- The ARM binary actually starts and serves.
- Migrations and the seed library apply cleanly on ARM.
- The Option A systemd unit starts, survives `systemctl restart`, and survives a
  reboot.
- A tag page is reachable over the network and the QR label sheet renders.
- Stop-copy-start backup, restored onto a second box, with data intact.
- Anything about **performance** on a Pi — the "runs well" half of the constraint
  is entirely unmeasured.

### Runbook for the live run

On a fresh ARM64 box, run the steps below and replace the table above with real
results. Any `aarch64` host works — Hetzner CAX11, AWS Graviton `t4g`, or Oracle
free-tier Ampere (`VM.Standard.A1.Flex`). DigitalOcean has no ARM droplet type.

Two things to get right before starting, both covered in
[`docs/tasks/060`](tasks/060-deploy-validation-arm-vm.md): the repo is private,
so decide up front how the code reaches the box (deploy key, or ship a
`git archive` from your dev machine); and if using Oracle, shape the instance
**down** to roughly 1–2 OCPU / 4 GB — a 24 GB ARM server proves the binary runs
while flattering the resource question a Pi actually poses.

```sh
uname -m                       # expect aarch64 — otherwise you are not on ARM
git clone <repo> loopcheck && cd loopcheck
./scripts/setup.sh             # must fetch ..._linux_arm64.zip, not amd64
./pocketbase --version         # expect 0.39.6
sh scripts/smoke_test.sh       # 89 assertions — proves migrations + seed on ARM
```

Then follow **Option A** verbatim for the systemd unit, and confirm:

```sh
sudo systemctl restart loopcheck && systemctl is-active loopcheck
sudo reboot                    # then, after it comes back:
systemctl is-active loopcheck  # expect: active
curl -s -o /dev/null -w '%{http_code}\n' http://<host>/t/<a-seeded-tag>   # expect 200
```

Finally exercise backup → restore per **Backups** onto a second box, and confirm
the tag count matches the source.

### Installer integrity — resolved 2026-07-28

This section previously recorded a finding that `scripts/setup.sh` downloaded the
release zip without verifying it. **That is fixed** (task `057`): the installer
now computes the SHA-256 of the download and compares it against the
`checksums.txt` the project publishes for every architecture. HTTPS
authenticates the host, not the artifact, so this closes the gap between "the
transfer succeeded" and "these are the bytes upstream published".

Behaviour, so an operator knows what to expect:

- **Match** — prints `Checksum verified (sha256 …)` and continues.
- **Mismatch** — refuses, prints both the expected and actual digests, **deletes
  the artifact**, and exits non-zero. A failed download is never left on disk
  where a later run could treat it as usable.
- **Cannot verify** — if `checksums.txt` is unreachable (offline or mirrored
  install) or no SHA-256 tool exists, it prints a loud warning naming the reason
  and continues. A skip is always visible; a silent skip would read as
  protection while providing none.

### Topology labels

Unchanged and restated for one-glance clarity: **single LAN host** and **single
internet-facing VPS** are supported and documented. **Raspberry Pi** and the
**primary/replica** arrangement below are **unvalidated**. Real Pi validation is
an M3 item and this interim record does not satisfy it.

## Proposed resilience topology: VPS primary + trailer Pi replica

> **UNVALIDATED — design direction, not a support claim**
> ([DECISIONS.md D14](DECISIONS.md#d14--deployment-topology-labeling)).
> **Supported today:** a single LAN host, or a single internet-facing VPS behind
> Caddy/systemd — both documented above.
> **Unvalidated:** Raspberry Pi performance (hard constraint #3 targets it, but
> it has not been exercised on real hardware — an M3 item) and the complete
> primary/replica replication and restore path described below.

Raspberry Pi performance and the complete replication/restore path remain to be
tested; the single-host LAN/VPS instructions above are the current documented
deployment options.

The target setup once you have a Pi to spare: one writable instance, one
ledger, and a Pi that exists to make the VPS expendable. **You don't need this
to run LoopCheck** — a single hardened droplet with Method-1 backups to a
bucket is a complete, safe deployment. This is the next resilience tier, and
it's the *only* thing Tailscale is for here.

```
phones (cell data) ──HTTPS──▶ VPS: Caddy → PocketBase   (the ONLY writable instance)
                                   │
                                   ├─ Litestream ──▶ Pi   (continuous SQLite replication)
                                   ├─ rsync ───────▶ Pi   (pb_data/storage/ — uploaded photos)
                                   └─ PocketBase zip backups (second, independent layer)
```

The Pi is **never a peer**: it doesn't serve crews, and nothing syncs back. It
holds a warm copy of the ledger and doubles as a staging box. A site with no
cellular at all gets its own standalone LoopCheck install with its own printed
labels — not a synced copy of this one.

> **Hardware note:** Raspberry Pis are hard to source right now. Until you have
> one, stop at Method-1 backups to an S3 bucket — that already gets the ledger
> off the droplet. The sections below are the build steps for when a Pi
> arrives; nothing here is a prerequisite for going live on the droplet.

### Reaching the Pi from the VPS

Litestream *pushes* from the VPS, and a Pi in a trailer or at home sits behind
NAT where the VPS can't see it. The boring fix is
[Tailscale](https://tailscale.com) on both machines — install it, sign both
into the same tailnet, and the Pi gets a stable private address (e.g.
`100.x.y.z`) reachable from the VPS with zero firewall or port-forward work.

(Alternative if you'd rather run nothing extra: skip Litestream and Tailscale
both, and have the **Pi pull** the nightly backup zips instead — `rsync` over
SSH from the Pi to the VPS is outbound-only, so NAT doesn't care and no
tailnet is needed. You lose point-in-time recovery; you keep last-night's
ledger. For a construction ledger that's often enough.)

### Litestream on the VPS

Litestream streams every SQLite write to the replica — losing the VPS costs
you seconds of ledger, not a day. Install it on the VPS, then
`/etc/litestream.yml`:

```yaml
dbs:
  - path: /opt/loopcheck/app/pb_data/data.db
    replicas:
      - type: sftp
        host: 100.x.y.z:22          # the Pi's Tailscale address
        user: loopcheck
        key-path: /opt/loopcheck/.ssh/id_ed25519
        path: /home/loopcheck/replica/data.db
```

Enable its systemd service and check `litestream replicas` reports the Pi.
`data.db` is the one that matters (the whole ledger); `auxiliary.db` is just
request logs. Photos live outside SQLite, so add a cron on the VPS:

```sh
# crontab -e on the VPS — photos to the Pi, hourly
0 * * * * rsync -a /opt/loopcheck/app/pb_data/storage/ loopcheck@100.x.y.z:/home/loopcheck/replica/storage/
```

### The restore drill (mandatory, same rule as ever)

On the Pi, prove the replica is real — this is also exactly the procedure for
standing up a replacement VPS:

```sh
litestream restore -o /tmp/restore/data.db sftp://loopcheck@100.x.y.z:22/home/loopcheck/replica/data.db
# drop it into a fresh checkout's pb_data/ + copy storage/, start PocketBase,
# open a tag page, check the check history and punch items are intact
```

### Staging on the Pi

Before upgrading PocketBase or applying a new migration on the VPS: restore
last night's ledger into a scratch `pb_data` on the Pi, run the new
binary/migration against it (`--dir` pointing at the scratch copy), click
through the pages. Ten minutes of rehearsal against real data, and production
upgrades stop being exciting. (This is exactly the `--dir`-pointed scratch
instance the maintainer uses for local verification.)

## Quick reference

| Task | Command |
|---|---|
| Status / logs | `systemctl status loopcheck` · `journalctl -u loopcheck -f` |
| Restart | `sudo systemctl restart loopcheck` |
| Update app | `sudo -u loopcheck git pull` then restart |
| Backup now | Admin UI → Settings → Backups → Create |
| Restore | Admin UI → Settings → Backups → ⟲ on the zip |
| Claim superuser | `pocketbase superuser upsert you@example.com 'pw'` |
