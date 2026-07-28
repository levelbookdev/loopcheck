# 020 — Docs reconciliation: collection count, honest offline/topology labels, stale TODO(auth)

Status: DONE
Milestone: M1 Harden & Reconcile (v0.9.0)
Depends on: 010

## Context

Continues the M1 single-source-of-truth work after task `010`. Three remaining
truth gaps:

1. **Collection count drift.** `docs/current-state.md` says 18; `ARCHITECTURE.md`
   still describes the older 16-collection contract in places; the real count
   from committed migrations is **24 application collections** + PocketBase
   `users`. (`docs/API.md` is already correct — it says 24 with a v1-plus-delta
   split.)
2. **Offline and deployment honesty** (cheap doc fixes decided this session):
   publish per-workflow offline guarantees ([DECISIONS.md D13](../DECISIONS.md#d13--offline-document-guarantees-now-build-no-second-queue))
   and label deployment topology honestly ([D14](../DECISIONS.md#d14--deployment-topology-labeling)).
3. **Stale `TODO(auth)` comments.** ~21 `TODO(auth)` comments in
   `pb_migrations/` describe a pre-ADR-0011 world ("before internet exposure,
   change every rule to…"). ADR 0011 is **Accepted** and the rules are live; the
   comments are misleading (SESSION-NOTES flagged this).

## Scope

**Touch:**
- `docs/current-state.md` — collection count 18 → 24; refresh the "Active
  development" section that predates the now-committed signatures/turnover,
  calibrations, and service_visits work.
- `ARCHITECTURE.md` (root) — anywhere it says "sixteen collections" as the
  *current* total, state 24 (16 published-v1 + 8 delta), cross-referencing
  `docs/API.md`. Do not rewrite the schema sections wholesale — correct the count
  and the "16 is the whole set" framing only.
- `CLAUDE.md` — the conventions line "The sixteen collections are a published API
  contract": clarify that 16 are the published **v1** set and the committed
  schema has 24 (see `docs/API.md`); keep the contract-discipline point intact.
- `CLAUDE.md` — the **"Security posture"** section still describes a Phase-1
  all-permissive world ("before LoopCheck is exposed to the internet", "every
  permissive rule carries a `TODO(auth)` comment"). ADR 0011 is Accepted and the
  selective lockdown is live. Rewrite this section to describe the *current*
  posture: public scan/reads + the deliberate accountless field creates, auth for
  office writes/PII, append-only ledgers immutable regardless of auth, deletes
  admin-only — pointing at ADR 0011 and `docs/API.md`. Keep the `docs/` GitHub
  Pages sensitivity note. Do not change any rule; this is documentation.
- `docs/current-state.md` **Offline behavior** and **Deployment** sections, and
  `docs/DEPLOY.md` — apply the D13 (per-workflow offline guarantees) and D14
  (LAN/single-VPS supported; Pi/replica unvalidated) labeling. Much of this may
  already be present; make it consistent and explicit.
- `pb_migrations/*.js` — the `TODO(auth)` comments (see Specification).

**Leave alone:**
- LineCheck/MainLine ownership and `AGENTS.md` — done in task `010`.
- The formal API v1 **version bump** — that is M3 (D12), not this task. Here you
  only make the *documentation of the current set* truthful; do not bump a
  version number or change `docs/API.md`'s contract status rows.
- Any collection **rule** or schema. Editing a migration comment must not change
  behavior.

## Specification

1. **Collection count.** Any doc stating a current total says **24 application
   collections** (plus PocketBase `users`). If a doc distinguishes the published
   contract, say "16 published as v1; 8 additional marked delta pending a
   version bump (see `docs/API.md`)". The authoritative list of 24 is derivable
   by grepping `new Collection(` in `pb_migrations/` — verify against it.
2. **TODO(auth) comments.** For each `TODO(auth)` in `pb_migrations/`:
   - The migration files are historical records of the schema at that version and
     must keep applying identically. **Do not change any rule value.**
   - Replace the now-false instruction text with a short, accurate note that the
     auth lockdown landed in migrations `1789000019`/`1789000020`/`1789000033`
     (ADR 0011, Accepted) and that the live rule is whatever the latest migration
     set establishes — i.e. this comment is historical. A single consistent
     replacement line is fine.
   - Do not delete the comment lines wholesale if that would change file line
     semantics you're unsure about — rewriting the text in place is safer and
     sufficient.
   - Verify no rule string was altered: a fresh DB built from migrations must
     produce byte-identical collection rules before and after (see acceptance).
3. **Offline / topology.** Ensure `docs/current-state.md` and `docs/DEPLOY.md`
   state: only the LOTO module has a durable offline cache/queue; `notice_batch`
   is tab-local; all other pages are online-required. Topology: LAN and single
   VPS are supported documented options; Raspberry Pi and primary/replica are
   unvalidated until exercised (Pi validation is tracked for M3).

## Acceptance criteria

- [ ] No doc states 16 or 18 as the current *total* collection count; the current
      total stated anywhere is 24.
- [ ] `grep -rn "TODO(auth)" pb_migrations/` comments no longer instruct a future
      rule change as if auth were unlanded; each reads as a historical note
      pointing at the ADR 0011 migrations.
- [ ] Building a fresh DB from `pb_migrations/` yields the **same collection
      rules** as before this task (prove by running `scripts/smoke_test.sh` — it
      asserts the ADR 0011 matrix; it must still pass with the same count).
- [ ] `docs/current-state.md` and `docs/DEPLOY.md` carry the D13 offline and D14
      topology labeling, consistent with each other.
- [ ] `docs/API.md` contract-status rows and any version number are unchanged.

## Guardrails

- **A migration file is a historical artifact. Never change a rule value or
  field in an already-shipped migration** — only comment text. If you think a
  rule is wrong, stop and raise it; do not fix it here.
- Do not bump the API contract version or promote delta collections — that is a
  deliberate M3 decision (D12).
- Run `scripts/smoke_test.sh` if the PocketBase binary is present; it is the
  regression gate proving you changed only comments.

## Definition of done

- All acceptance criteria checked; smoke test still passes (same assertion
  count).
- `Status:` set to `DONE`.
- Committed as the maintainer, message e.g.:
  `docs: state the true 24-collection set; historicize stale TODO(auth) notes`.
