# SESSION-NOTES — auth lockdown reconciliation

> Read CLAUDE.md FIRST — this file never repeats its constraints, it links to them.
> Delete this file in the same commit that ships the last piece of this effort.

**Goal (definition of done):** the README's "do not expose `main` to the public
internet" warning is deleted *truthfully* — every collection rule matches an
accepted ADR 0011 access matrix, the office pages authenticate through
`lc-auth.js`, and `scripts/smoke_test.sh` proves the matrix as guest, as user,
and as superuser.
**Started:** 2026-07-19   **Status:** checkpoint 3 of 6

## Current state (living — overwrite freely)
- **Done:** checkpoint 1 — access matrix approved. Checkpoint 2 — migration
  `1789000033` locks `segments` create/update to auth (committed `af54439`).
  Checkpoint 3 — nine pages reconciled onto `lc-auth.js`; the service CSV
  import's PII path repaired; verified in a browser against a seeded database.
- **In progress:** nothing — awaiting review of checkpoint 3.
- **Not started:** checkpoint 4 (smoke-test matrix assertions), 5 (docs +
  delete the README warning), 6 (tag + release).

## Next session: start here
Start checkpoint 4: extend `scripts/smoke_test.sh` to assert the matrix as
guest / user / superuser — assert on DATA PRESENCE, never status codes, and add
the back-relation expand check (`services?expand=service_contacts_via_service`
must return an empty `expand` to a guest).

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
- **Two gate shapes, and picking the wrong one breaks a hard constraint.** A
  page that READS an auth-gated collection must either hard-gate (redirect on
  load) or explicitly render a "requires sign-in" state — because the tokenless
  read returns 200+empty, the lazy option silently prints a confident absence.
  Field-facing pages (`tag.html`, `service.html`) can NEVER hard-gate; they must
  take the second option or they violate hard constraint #1.
- `localStorage` is per-origin: clearing the token while a tab is still on
  `file://` does not clear it for `http://127.0.0.1:PORT`. Cost 10 minutes of
  believing a gate had failed when it had not.
- Synthetic `input` events do not reliably drive Alpine `x-model`. To script a
  form in the browser pane, use `Alpine.$data(root)` and set properties, then
  call the component method directly.
- **PocketBase returns 200 + an empty list for a dead/absent token on reads,
  not 401.** Every "is auth working" assertion must test for data presence, not
  status code. `lc-auth.js` already detects expiry via `auth-refresh` for this
  reason; the smoke test's guest checks must count records, not read statuses.
- Stale `TODO(auth)` comments survive in the original create-migrations even
  where migration `1789000019` has since changed the rule. The comments are not
  evidence of the live rule.

## Session log (append-only, newest first — never edit old entries)
### 2026-07-19 (checkpoint 3)
- Attempted: reconcile the office pages onto `lc-auth.js`.
- Landed: not yet committed — 9 pages (`warranty`, `readiness`, `closeout`,
  `closeout-package`, `import`, `import_services`, `index`, `tag`, `service`)
  plus a scratch launch config.
- Learned: the lockdown's real damage was never the rules, it was the READS.
  `tag.html` told an accountless plant operator "No warranty recorded for this
  equipment" when it simply could not see the warranty — the same class of lie
  ADR 0007 forbids for LOTO, in a module nobody had connected to that doctrine.
  Separately, `import_services.html` had been writing customer PII to `services`
  columns that migration `1789000020` deleted, so service imports were dropping
  every customer name and phone on the floor and reporting success.
- Verified in-browser against a seeded DB: guest tag page keeps the full field
  tier and shows "requires sign-in" for office sections; signed in, the same
  page shows a real closeout requirement. Guest → office page → login?next= →
  back to the office page round-trips. Guest cannot list, view, or
  back-relation-expand `service_contacts`.
- Stopped because: checkpoint boundary — the smoke test should encode all of
  this next, so it is a gate and not a one-off manual check.

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
