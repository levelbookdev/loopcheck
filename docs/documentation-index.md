# LoopCheck documentation index

This index records what each document is authoritative for. Labels describe
the document's role, not whether every sentence is current.

| Document | Authority | Use and caveats |
| --- | --- | --- |
| [`README.md`](../README.md) | Descriptive | Short product/setup entry point. Must match shipped behavior; known drift is reconciled during the current documentation session. |
| [`AGENTS.md`](../AGENTS.md) | Normative | Repository constraints and working rules supplied in the session worktree. Untracked at the baseline snapshot; preserve as maintainer-owned. |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Normative + descriptive | Detailed LoopCheck design and rejected ideas. Reconciled in this documentation session to distinguish committed schema, unfinished UI, and active Phase 3 work. |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Normative | Contribution and authorship process. |
| [`CLAUDE.md`](../CLAUDE.md) | Historical design specification | Earlier agent/project context. Useful for rationale, but `AGENTS.md`, accepted ADRs, migrations, and current-state evidence take precedence. |
| [`docs/current-state.md`](current-state.md) | Descriptive | Evidence-backed snapshot of committed behavior and limitations at a named commit. |
| [`docs/product-boundary.md`](product-boundary.md) | Normative + proposed | LoopCheck bounded context, non-goals, neighboring products, and boundary recommendations. |
| [`docs/lifecycle-map.md`](lifecycle-map.md) | Proposed | Ecosystem ownership/handoff map; not a shared runtime design. |
| [`docs/architecture-status.md`](architecture-status.md) | Descriptive + proposed | Decision/status register showing current implementation, intent, and unresolved calls. |
| [`docs/domain-model.md`](domain-model.md) | Descriptive | Current entities, mutability, authority, relationships, and separately labeled proposed additions. |
| [`docs/invariants.md`](invariants.md) | Normative + proposed | Enforced LoopCheck rules and separately labeled desired ecosystem invariants. |
| [`docs/ecosystem-contracts.md`](ecosystem-contracts.md) | Proposed | Non-binding conceptual handoff envelopes. Not an API contract. |
| [`docs/overlap-and-migrations.md`](overlap-and-migrations.md) | Proposed | Bounded-context overlaps and candidate migration sequence; does not authorize code movement. |
| [`docs/open-questions.md`](open-questions.md) | Proposed | Decision backlog with owner and latest safe decision point. |
| [`docs/API.md`](API.md) | Normative contract + descriptive delta | Published v1 PocketBase REST contract and current 18-collection/auth implementation table. The delta is documented but still needs ADR/version reconciliation before external stability is promised. |
| [`docs/USER_GUIDE.md`](USER_GUIDE.md) | Descriptive | Crew-facing instructions, currently concentrated on LOTO. |
| [`docs/DEPLOY.md`](DEPLOY.md) | Normative operations guide | LAN/VPS operation and backup guidance, with current auth-reconciliation warning and proposed (unvalidated) replica topology. |
| [`docs/DEPLOY_DOMAIN.md`](DEPLOY_DOMAIN.md) | Normative operations guide | Domain, TLS, and mail wiring. |
| [`docs/ROADMAP.md`](ROADMAP.md) | Proposed + historical | Sequencing and free/paid boundary. Segment and auth sections lag landed migrations. |
| [`docs/DATA_MODEL_PLAN.md`](DATA_MODEL_PLAN.md) | Historical + proposed | Earlier schema/module analysis. Landed sections are historical; remaining proposals require revalidation against current migrations. |
| [`seed/README.md`](../seed/README.md) | Normative data specification | Authoritative built-in template JSON format and domain-review list. |
| [`docs/adr/`](adr/) | Normative + historical + proposed | One decision per file; the status inside each ADR controls. Accepted ADRs are normative, Proposed ADRs are not authorization to implement. |
| [`docs/adr/README.md`](adr/README.md) | Descriptive index | ADR navigation; must be kept synchronized with the directory and statuses. |
| [`docs/notes/lookahead-sidecar-scope.md`](notes/lookahead-sidecar-scope.md) | Proposed working note | Sidecar scope ideas subordinate to ADR 0003 and the public API contract. |
| [`docs/notes/2026-10-11-historical-startup-records.md`](notes/2026-10-11-historical-startup-records.md) | Descriptive working note | Structural findings from historical contractor startup and commissioning records, anonymized. Evidence for open questions and future ADRs; decides and authorizes nothing. |
| [`docs/index.html`](index.html) | Descriptive public page | Self-contained GitHub Pages landing page. User-visible claims must match shipped code; screenshots under `docs/img/` are illustrative assets. |

## Evidence precedence

When documents conflict, use this order for claims about current behavior:

1. committed migrations, hooks, and frontend behavior;
2. passing tests that exercise that behavior;
3. accepted ADRs for intended semantics;
4. `ARCHITECTURE.md` and the normative API/operations documents;
5. roadmap, plans, notes, and proposed ADRs.

An accepted ADR with no implementation is `DECIDED`, not `CURRENT`. A migration
with no complete user workflow may be `CURRENT schema` while the feature
remains unfinished. The named snapshot in `current-state.md` is the concise
place to resolve those distinctions.
