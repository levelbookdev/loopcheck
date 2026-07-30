# 065 — Landing page: make the GitHub Pages claim true

Status: DONE (2026-07-28 — Branch A: repo public, Pages live at ringout.app)
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: none (but see the branch decision below — it needs a maintainer ruling)

## Outcome — Branch A

The maintainer ruled **public**. The CLAUDE.md claims that `docs/` is served
publicly by GitHub Pages are now **true**, so no doc text needed correcting —
the infrastructure was brought up to match the documentation rather than the
reverse.

What landed:

- `levelbookdev/loopcheck` is **public**.
- GitHub Pages enabled from `main` / `/docs`.
- Custom domain `ringout.app` set; `protected_domain_state: verified` (the org
  holds the `_github-pages-challenge-levelbookdev` TXT record).
- `https://ringout.app/` serves the real landing page (16,824 bytes, valid TLS).
  It previously served a 5-byte `hehe` placeholder.
- `docs/index.html` and `docs/CNAME` unchanged, as required.

**Before flipping visibility, the full history was scanned** for anything that
should not become public: no `.env`/`.pem`/`.key`/credential-shaped file was ever
committed, no token or private-key patterns appear in any commit, and no public
IP was ever recorded — the discipline of keeping host and credentials out of the
repo held. The one item found was commit `f1e2e78`, which replaced invented demo
firm names that happened to match real companies; the old names remain in
history. Judged not worth a history rewrite: fictional names, no secrets, no
customer data.

**DNS corrections needed along the way** (recorded because the same shape will
recur on any sibling product):

- The apex carried a stray `A` record pointing at the app droplet alongside the
  four GitHub Pages IPs, so it round-robined between Pages and an app server that
  had no vhost for it.
- Removing that also removed the `app` subdomain record, taking the application
  offline; it was then briefly re-added as a `CNAME` to a Pages host rather than
  an `A` record to the droplet. The rule worth remembering: **the apex and `www`
  point at GitHub Pages; `app` is the only name that points at your own server.**

## Consequence for other work

The repo being public removes the credential wall that blocked `git clone` on
every fresh box — the loopcheck droplet hit it in task `067` and the ARM box in
`060` would have. See `066`.

## Context

`CLAUDE.md` ("Definition of done", item 5) and the "Security posture" section
both assert that **`docs/` is served publicly by GitHub Pages**. As of
2026-07-28 that is **false**: the repository is private and the GitHub Pages API
returns 404 for it (Pages on a private repo requires a paid plan, so making the
repo private almost certainly took the site down).

This is a docs-as-code violation of exactly the kind this project keeps
catching: a load-bearing claim in the file every session reads first, describing
infrastructure that is not running. It also means real work is being paid for
with no benefit collected — `docs/index.html` is maintained as a self-contained
public landing page (inline CSS, no JS, no webfonts, no external requests), and
`docs/` is kept free of anything sensitive or premium-related, specifically
*because* it is supposed to be public.

Supporting facts (all verified 2026-07-28):
- `docs/CNAME` contains `ringout.app` — a custom domain is configured in the
  repo but not active on GitHub for *this* repo.
- **`ringout.app` is already live and already served by GitHub Pages** (`Server:
  GitHub.com`), but **not from this repository**. It returns HTTP 200 with a
  5-byte placeholder body (`hehe`), and `https://ringout.app/api/health` is 404,
  so it is a static placeholder, not the LoopCheck application. Some other
  repository or account currently claims that custom domain. GitHub permits only
  one repo to claim a domain, so **Branch A must resolve that conflict first** —
  find and release the current claimant, then add the domain here.
- The repo is AGPLv3. That licence's mechanism is network copyleft; it does
  nothing while the source is unpublished.
- The repository does **not** contain the live VPS hostname or public IP (the
  only address in `DEPLOY.md` is a private-range `192.168.1.50` in an
  illustrative backup cron). Publishing the repo therefore does not disclose
  where the deployment is.

## The branch decision (maintainer ruling required)

This task has two mutually exclusive resolutions. **Do not guess — if the
maintainer has not recorded a ruling, stop and ask.**

- **Branch A — the repo goes public.** Enable GitHub Pages from `docs/` on the
  default branch, confirm `ringout.app` resolves and serves `docs/index.html`
  over HTTPS, and leave the CLAUDE.md claims as they are (they become true).
- **Branch B — the repo stays private.** Correct every claim that `docs/` is
  publicly served, so the docs match reality. Keep the *discipline* (self-
  contained landing page, nothing sensitive in `docs/`) and say why it is
  retained — the intent is still to publish — but stop asserting it is live.

**Prerequisite for Branch A — the custom-domain conflict.** `ringout.app` is
already claimed by another GitHub Pages site (see Context). Enabling Pages here
with the existing `docs/CNAME` will fail or misbehave until that claim is
released. Resolve ownership first, or enable Pages on the default
`*.github.io` URL and defer the custom domain.

**Note on the live VPS.** The temporary Caddy `basic_auth` gate documented in
`docs/DEPLOY.md` is a separate concern and is **not** a blocker for this task:
the repo does not name the deployment's host, so publishing does not reveal it.
Removing that gate remains a live-server operator action that no agent performs.

## Scope

**Touch (Branch B, or Branch A where noted):**
- `CLAUDE.md` — the "Definition of done" item 5 landing-page rule and the
  "Security posture" closing line about `docs/` being served by GitHub Pages.
- `docs/current-state.md` — add or correct a statement of how (or whether) the
  landing page is served, alongside the existing deployment labels.
- `README.md` — only if it claims a live public site.
- Branch A only: repository settings (Pages source + custom domain). No file
  change may be needed beyond confirming `docs/CNAME`.

**Leave alone:**
- `docs/index.html` content and styling. Whether or not Pages is live, the page
  itself is fine and its self-contained constraints stay.
- `docs/CNAME` — do not delete it under Branch B; the domain intent survives.
- Anything about the live VPS, Caddy, or the `basic_auth` gate. Documenting the
  gate is already done in `DEPLOY.md`; removing it is the operator's action.
- The AGPL licence and the paid-sidecar boundary.

## Specification

1. Determine the current truth before editing: `gh repo view --json visibility`
   and `gh api repos/<owner>/<repo>/pages` (a 404 means Pages is not enabled).
   Record what you found in the commit message.
2. Apply Branch A or Branch B per the maintainer's ruling.
3. Under **either** branch, the end state must satisfy: **no document claims the
   landing page is publicly served unless it verifiably is.** If it is served,
   the claim names the URL and that URL returns HTTP 200.
4. Under Branch B, keep the reason for the constraints explicit so a future
   session does not "simplify" `docs/index.html` on the grounds that nothing
   serves it.

## Acceptance criteria

- [ ] `gh api repos/<owner>/<repo>/pages` and the docs agree: either Pages is
      enabled and the docs say so, or Pages is absent and no doc claims it.
- [ ] Under Branch A: `https://ringout.app/` returns HTTP 200 and serves the
      landing page over HTTPS with the custom domain configured.
- [ ] Under Branch B: `grep -rn "GitHub Pages" CLAUDE.md docs/ README.md`
      returns no line asserting the site is *currently* served.
- [ ] `docs/index.html` is unchanged in content, and `docs/CNAME` still exists.
- [ ] No application code, migration, seed, or test changed.

## Guardrails

- **Do not flip repository visibility as a side effect of this task.** Making a
  repository public is irreversible in practice (it can be cloned, forked, and
  indexed within minutes) and is the maintainer's decision to take explicitly.
- Do not touch the live server, Caddy config, or DNS.
- Do not remove `docs/CNAME` or rewrite the landing page to "match" a private
  repo — the publication intent is unchanged; only the claim about current state
  is at issue.

## Definition of done

- Acceptance criteria checked; docs and infrastructure agree.
- `Status:` set to `DONE`.
- Committed as the maintainer (no AI trailer), message e.g.:
  `docs: reconcile the GitHub Pages claim with reality`.
