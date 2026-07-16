# Wiring a domain, TLS, and mail

How to put a real domain in front of a LoopCheck deployment: a public
landing page, the app itself over HTTPS, a first superuser, and outbound
SMTP for the admin/office account emails.

This sits on top of [DEPLOY.md](DEPLOY.md) (the base VPS install, the
`pocketbase` systemd service, backups, and hardening). Placeholders below —
`example.com`, `app.example.com`, `<droplet-ip>`, `you@example.com`,
`<server>.mxrouting.net` — are the only things you substitute.

## The shape of it

A single domain fans out across three names plus mail. The **website
records (A/AAAA)** and the **mail records (MX)** are different record types
on the same domain — they coexist with zero conflict.

| Name | Points to | Serves |
|---|---|---|
| `example.com` (apex) | GitHub Pages | the static landing page (`docs/`) |
| `www.example.com` | GitHub Pages | redirect to the apex |
| `app.example.com` | your VPS (`<droplet-ip>`) | the PocketBase app, over HTTPS |
| `@example.com` mail | your SMTP provider | outbound account email |

## 1. Landing page → GitHub Pages with a custom domain

The landing page (`docs/index.html`) is static and needs no server.

1. **CNAME file** in the Pages publishing source (`/docs`): a file
   `docs/CNAME` containing one line — `example.com`.
2. **DNS** at your registrar — the apex needs GitHub's four Pages A records
   (add the AAAA set too for IPv6):
   ```
   @   A   185.199.108.153
   @   A   185.199.109.153
   @   A   185.199.110.153
   @   A   185.199.111.153
   www CNAME  <your-github-user>.github.io.
   ```
   (If your registrar supports ALIAS/ANAME/CNAME-flattening, an
   `ALIAS @ -> <your-github-user>.github.io` is tidier than the four A
   records.)
3. **Repo → Settings → Pages → Custom domain** = `example.com`, wait for the
   DNS check, then enable **Enforce HTTPS**. GitHub provisions the cert.

## 2. App → VPS at `app.example.com`, HTTPS via Caddy

The app is `pocketbase serve` on `127.0.0.1:8090`, fronted by Caddy, which
fetches and renews a Let's Encrypt certificate automatically. The frontend
talks to `window.location.origin`, so nothing in the app needs the hostname
hardcoded — it just works once served at `https://app.example.com`.

1. **DNS:** `app  A  <droplet-ip>` (and AAAA if you have IPv6).
2. **Firewall:** open HTTPS — `ufw` must allow 443 as well as 80 (80 is
   needed for the ACME challenge and the HTTP→HTTPS redirect):
   ```sh
   ufw allow 80/tcp
   ufw allow 443/tcp
   ```
3. **Caddyfile** (`/etc/caddy/Caddyfile`) — point it at the hostname; that
   single change is what triggers automatic TLS:
   ```
   app.example.com {
       reverse_proxy 127.0.0.1:8090
   }
   ```
4. **Reload:** `systemctl reload caddy` (it validates first and keeps the
   running config if the new one is invalid). Caddy issues the cert on the
   first HTTPS request. Verify:
   ```sh
   curl -s https://app.example.com/api/health          # {"...healthy..."}
   curl -sI http://app.example.com/api/health | grep -i location   # 308 -> https
   ```
5. **QR labels:** set the label **Base URL** to `https://app.example.com` so
   printed QR codes encode the public address.

> A named Caddy site (`app.example.com { ... }`) only answers that host, so
> `http://<droplet-ip>` stops serving the app once you switch from a `:80`
> block — that's the intended end state. Keep a `/etc/caddy/Caddyfile.bak`
> for an easy revert.

## 3. The first superuser (admin account)

The admin UI (`/_/` → **Settings**, where SMTP lives) requires a
**superuser**. On a *public* instance PocketBase will **not** let anyone
create the first one through the browser without a one-time install token
(printed at startup, valid ~30 min) — so a stranger can't grab your admin.

Create it from the CLI instead — no token, works headless. Run it as the
service user so it targets the right `pb_data`:

```sh
cd /opt/loopcheck/app
sudo -u loopcheck ./pocketbase superuser upsert you@example.com "a-strong-password"
```

`upsert` creates the account, or resets the password if the email already
exists. Then log in at `https://app.example.com/_/`.

Gotchas seen in the wild:
- **"Only superusers can perform this action"** in the browser = you're on a
  stale installer link (`/_/#/pbinstall/…`) while a superuser already
  exists. Go to the plain `/_/` — it lands on the normal login.
- A blank/`404` installer link = the printed token expired. Don't chase it;
  use the CLI `upsert` above.

## 4. Outbound SMTP (admin/office email)

SMTP powers PocketBase's **password-reset, email-verification, and OTP**
mail for superuser/office accounts. The accountless field tier never sends
mail, so this is only for the people who log in.

**Admin UI → Settings → Mail settings → Use SMTP mail server:**

| Field | Value |
|---|---|
| SMTP host | your provider's server, e.g. `<server>.mxrouting.net` |
| Port / TLS | `587` StartTLS, or `465` SSL |
| Username | the full mailbox address, e.g. `no-reply@example.com` |
| Password | that mailbox's password |
| Sender address / name | `no-reply@example.com` / `LoopCheck` |

Then use **Send test email** — that's the instant pass/fail.

### Deliverability DNS (so mail doesn't land in spam)

The sending domain needs three records, whose exact values your provider
generates for `example.com`:

- **SPF** — `TXT @` — the `v=spf1 include:… -all` line the provider gives.
- **DKIM** — enable it in the provider's panel and add the selector record.
- **DMARC** — `TXT _dmarc` — e.g. `v=DMARC1; p=quarantine; rua=mailto:you@example.com`.

> **mxroute note:** a domain must be *added to your mxroute account*
> (DirectAdmin → add domain → create the mailbox) before
> `no-reply@example.com` exists there. Your mxroute server hostname is shown
> in the client area / DirectAdmin panel URL (`<server>.mxrouting.net`), not
> necessarily in your domain's current MX — a domain still on a registrar's
> free email forwarding has MX pointing elsewhere. To send only (not
> receive) through mxroute, you can leave inbound MX as-is and just add the
> SPF/DKIM records above; or, for a quick start, send from a mailbox on a
> domain you already have live on mxroute.
