# SESSION-NOTES — auth lockdown reconciliation

> Read CLAUDE.md FIRST — this file never repeats its constraints, it links to them.
> Delete this file in the same commit that ships the last piece of this effort.

**Goal (definition of done):** the README's "do not expose `main` to the public
internet" warning is deleted *truthfully* — every collection rule matches an
accepted ADR 0011 access matrix, the office pages authenticate through
`lc-auth.js`, and `scripts/smoke_test.sh` proves the matrix as guest, as user,
and as superuser.
**Started:** 2026-07-19   **Status:** checkpoint 2 of 6

## Current state (living — overwrite freely)
- **Done:** checkpoint 1 — access matrix approved. Checkpoint 2 — migration
  `1789000033` locks `segments` create/update to auth; no collection is
  world-writable any more, and every append-only ledger is still frozen. Full
  smoke test green (60/60). ADR 0011's implementation note records the rulings.
- **In progress:** nothing — awaiting review of checkpoint 2.
- **Not started:** checkpoint 3 (office pages on `lc-auth.js`), 4 (smoke-test
  matrix assertions), 5 (docs + delete the README warning), 6 (tag + release).

## Next session: start here
Start checkpoint 3: put every office page that writes to an auth-gated
collection on the shared `lc-auth.js` pattern — begin with `import.html`,
`import_services.html`, `closeout.html`, `index.html`, then the punch-close
`PATCH` in `tag.html` / `service.html` / `project.html`.

## Decisions made mid-effort
- 2026-07-19 Ground truth for the matrix comes from booting a throwaway
  PocketBase from `pb_migrations/` and dumping `/api/collections`, not from
  reading migrations — later migrations amend earlier rules, so the file order
  alone is misleading.
- 2026-07-19 Maintainer rulings on the matrix: `segments` locks to auth
  (reads stay public); `signatures` list/view stay public; `test_equipment` /
  `service_visits` / `check_items` public creates and `attachments`' trust of
  the declared `parent_collection` are confirmed deliberate — the accepted cost
  of the accountless field tier. Recorded in ADR 0011's implementation note;
  fold into its §2 table when it moves to Accepted.
- 2026-07-19 `segments` is frozen at maintenance-only (Phase 6 moved to
  MainLine), but locking its rule counts as maintenance, not new module work.

## Gotchas discovered
- **PocketBase returns 200 + an empty list for a dead/absent token on reads,
  not 401.** Every "is auth working" assertion must test for data presence, not
  status code. `lc-auth.js` already detects expiry via `auth-refresh` for this
  reason; the smoke test's guest checks must count records, not read statuses.
- Stale `TODO(auth)` comments survive in the original create-migrations even
  where migration `1789000019` has since changed the rule. The comments are not
  evidence of the live rule.

## Session log (append-only, newest first — never edit old entries)
### 2026-07-19 (checkpoint 2)
- Attempted: implement the approved matrix as a versioned migration.
- Landed: `pb_migrations/1789000033_migration_r_segments_auth.js` + the ADR 0011
  implementation note. Only ONE rule actually needed changing — the matrix
  review found the rest of the lockdown already correct as landed.
- Learned: re-applying all migrations from scratch and diffing the live
  `/api/collections` dump is the cheap regression gate for rule work; it caught
  that every append-only ledger stayed frozen. Smoke test 60/60.
- Stopped because: checkpoint boundary — office-page reconciliation is next and
  is a much larger, frontend-only change.

### 2026-07-19
- Attempted: checkpoint 1 — produce the access matrix.
- Landed: no commits yet; `SESSION-NOTES.md` seeded.
- Learned: the live surface is 24 application collections plus `users`, not the
  sixteen the contract doc describes. Only 4 of 25 pages load `lc-auth.js`.
  `segments` is the one collection still fully world-writable. The structural
  PII split landed, but the service CSV import was never repointed at it.
- Stopped because: the matrix needs maintainer approval before any migration is
  written.
