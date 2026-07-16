# Draft ecosystem contracts

**Status: PROPOSED and non-binding.** These conceptual envelopes exist to make
open decisions concrete. They are not LoopCheck API v1, are not implemented,
and must not be used to couple products until an ADR, versioning policy,
fixtures, and compatibility tests approve a real contract.

The producer remains authoritative. A consumer stores the source envelope and
a local projection/reference; it does not rewrite the source fact.

## Common conventions

- Schema identifiers are globally namespaced strings such as
  `loopcheck.lifecycle-event.v1`.
- Times are RFC 3339 UTC; business dates remain explicit date-only strings.
- Decimal measurements are strings plus explicit unit and method metadata,
  never unqualified binary floats.
- Product-local database ids may appear as locators, but `public_id` is the
  portable identity once an issuance scheme is approved.
- Unknown additive fields are ignored within a compatible version; breaking
  semantic or required-field changes require a new version.
- Supersession/correction is a new envelope referencing the prior envelope.

## Project reference

Identifies the same construction project across independently deployed
applications without assuming shared database ids.

```json
{
  "schema": "construction.project-ref.v1",
  "public_id": "PROPOSED",
  "project_number": "P-1234",
  "name": "North Plant Improvements",
  "owner": "Example Utility",
  "source": { "product": "loopcheck", "deployment_id": "PROPOSED", "local_id": "..." }
}
```

Open issue: neither LoopCheck nor the inspected sibling READMEs establish a
portable deployment/project id. `project_number` may be blank or non-unique and
cannot be the sole technical key without validation.

## Public identifier

Identifies an entity or event independently of its database record id.

```json
{
  "schema": "construction.public-id.v1",
  "namespace": "loopcheck",
  "entity_type": "plant_asset",
  "public_id": "PROPOSED",
  "business_id": "PMP-3101",
  "project_public_id": "PROPOSED"
}
```

`business_id` is what people use; `public_id` is what systems use. Printed
LoopCheck QR URLs continue to use the tag number unless an explicit migration
changes that contract.

## External reference

A durable pointer from a consumer record to a producer-owned fact.

```json
{
  "schema": "construction.external-ref.v1",
  "source_product": "trenchnote",
  "source_deployment_id": "PROPOSED",
  "source_public_id": "PROPOSED",
  "source_contract": "trenchnote.api.v1",
  "source_url": null,
  "observed_at": "2026-07-12T00:00:00Z"
}
```

URLs are optional locators, not identity; deployments and routes change.

## Evidence envelope

Describes an immutable or frozen evidence object without transferring its
authority.

```json
{
  "schema": "construction.evidence.v1",
  "evidence_id": "PROPOSED",
  "kind": "photo",
  "media_type": "image/jpeg",
  "captured_at": "2026-07-12T00:00:00Z",
  "captured_by": "Recorded name or actor reference",
  "source_ref": { "schema": "construction.external-ref.v1" },
  "byte_length": 12345,
  "digest": { "algorithm": "sha256", "value": "..." },
  "locator": "producer-defined authenticated or public locator"
}
```

Digest and locator are optional until the producer can guarantee stable bytes
and access rules. A hash is not identity proof or a trusted timestamp.

## Lifecycle event

Reports that the authoritative producer observed a domain transition.

```json
{
  "schema": "construction.lifecycle-event.v1",
  "event_id": "PROPOSED",
  "event_type": "plant_asset.checkout_phase_passed",
  "occurred_at": "2026-07-12T00:00:00Z",
  "recorded_at": "2026-07-12T00:00:05Z",
  "project": { "schema": "construction.project-ref.v1" },
  "subject": { "schema": "construction.public-id.v1" },
  "producer": { "product": "loopcheck", "contract_version": "PROPOSED" },
  "source_records": [{ "schema": "construction.external-ref.v1" }],
  "supersedes_event_id": null
}
```

Candidate event families—not accepted names—include material receipt/release,
plant checkout phase passed, linear test accepted, placed in service, and
turnover package issued. Consumers must not infer authorization from an event
whose producer did not assert it.

## Handoff manifest

Bundles a bounded set of lifecycle events/evidence references for export.

```json
{
  "schema": "construction.handoff-manifest.v1",
  "manifest_id": "PROPOSED",
  "created_at": "2026-07-12T00:00:00Z",
  "producer": { "product": "loopcheck", "contract_version": "PROPOSED" },
  "project": { "schema": "construction.project-ref.v1" },
  "purpose": "plant_turnover",
  "events": [],
  "evidence": [],
  "supersedes_manifest_id": null,
  "digest": null
}
```

A manifest is an export index, not a shared workflow or a replacement for
source records. A consumer may validate and import it without contacting the
producer, but offline verification requirements are still open.

## Import provenance

Records what a consumer accepted and how it mapped locally.

```json
{
  "schema": "construction.import-provenance.v1",
  "import_id": "PROPOSED",
  "imported_at": "2026-07-12T00:00:00Z",
  "manifest_id": "PROPOSED",
  "source_product": "loopcheck",
  "source_contract_version": "PROPOSED",
  "source_digest": null,
  "local_project_id": "...",
  "local_records": [],
  "outcome": "accepted"
}
```

Required behavior before implementation: duplicate `(source deployment,
manifest_id)` imports are idempotent; rejected versions/records are explicit;
and corrections never overwrite imported historical provenance.

## Decisions required before binding v1

1. portable deployment, project, subject, event, and manifest id issuance;
2. first real producer/consumer handoff and its minimum payload;
3. authentication, authorization, and evidence-locator lifetime;
4. compatibility rules and machine-readable validation format;
5. canonicalization/digest rules, if offline verification is required;
6. event correction, void, supersession, and retention vocabulary;
7. ownership of service cutover and segment acceptance.

