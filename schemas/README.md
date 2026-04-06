# ERP Forge Spec Schema

This directory contains the versioned product spec schema for ERP Forge.

## Files

| File | Purpose |
|---|---|
| `spec.schema.json` | JSON Schema (draft 2020-12) that validates any spec instance document |
| `spec.example.json` | Fully-populated example spec for "Acme Precision Parts LLC" |
| `render-profiles.json` | Rendering profiles for the three output audiences |
| `README.md` | This file — operational guide |
| `changelog.md` | History of changes to the meta-schema itself |

---

## What is a spec document?

A spec document is a single JSON file that describes everything needed to build a customer's ERP. It serves three simultaneous audiences:

- **Customer** — a business summary they can review and sign off
- **Dev** — a development plan Claude Code builds from
- **API** — an integration spec for connecting external systems

The same document produces all three outputs by filtering fields based on `_render` audience flags (see Rendering section below).

---

## Creating a new customer spec

1. Copy `spec.example.json` to `customers/<customer_slug>/spec.json`
2. Set a new UUID for `spec_id`
3. Set `spec_version` to `"1.0.0"`
4. Set `created_at` and `updated_at` to the current timestamp
5. Set `created_by` to `"interview_agent_v1"` or `"human:<your_email>"`
6. Fill in all sections (the interview agent handles this automatically)
7. Add an initial `history` entry with `change_type: "initial_creation"`

---

## Versioning rules

Spec documents use semantic versioning. Every change must bump the version and add a `history` entry.

| Change type | Bump | Examples |
|---|---|---|
| Customer re-scoped the project | **MAJOR** | Different industry, completely different workflows |
| New section, entity, or integration added | **MINOR** | Added a new workflow, new data entity, new integration |
| Correction, clarification, typo fix | **PATCH** | Fixed a field name, updated a description |

### History entries

Every change requires appending a new entry to the `history` array. History entries are **immutable** — never edit or remove an existing entry.

Required fields:
- `version` — the new spec version after this change
- `timestamp` — ISO 8601 UTC
- `author` — `"interview_agent_v1"` or `"human:email@domain.com"`
- `change_type` — one of the enum values in the schema
- `summary` — one sentence describing what changed
- `changed_sections` — array of section names that changed
- `rationale` — why the change was made (the business reason, not the technical one)

---

## Rendering: the `_render` flag system

Fields that differ by audience are wrapped in an envelope object:

```json
{
  "_value": "oauth2_authorization_code",
  "_render": ["dev", "api"],
  "_label": "Authentication Method",
  "_hint": "Used by the integration layer to configure the OAuth flow"
}
```

Fields without a `_render` array are **bare fields** — included for all audiences.

Sections carry a `_section_render` array to gate the entire section:

```json
{
  "_section_render": ["dev", "api"],
  ...
}
```

The three audiences are `"customer"`, `"dev"`, and `"api"`. See `render-profiles.json` for the full rendering rules each profile applies.

### Renderer logic

1. Check `_section_render` — if the section's render flags don't include the current profile's audience, skip the entire section
2. For each field: if the field is a bare value, include it. If it's an envelope, include only if `_render` contains the profile audience.
3. Unwrap envelopes: output `_value` as the field value, use `_label` as the display key

---

## Adding a field to the schema

When the interview agent or a developer needs to add a new field:

1. Identify the `$def` in `spec.schema.json` where the field belongs
2. Add the field definition with appropriate type, required, and enum constraints
3. If the field is audience-specific, document it as an envelope type in the schema
4. Update `spec.example.json` to include the new field in at least one entry
5. Bump `schema_version` in `spec.schema.json` (PATCH for additions, MINOR for breaking changes)
6. Add an entry to `changelog.md` explaining what changed and any migration notes for existing spec documents
7. Run validation: `ajv validate -s schemas/spec.schema.json -d schemas/spec.example.json`

---

## Cross-reference integrity

The spec uses ID references across sections. Maintaining these is the responsibility of whoever edits the spec:

| Reference | From | To |
|---|---|---|
| `entity_ref` in workflow steps | `core_workflows[].steps[].inputs/outputs` | `data_entities[].entity_id` |
| `ai_touchpoint_ref` in steps | `core_workflows[].steps[].ai_touchpoint_ref` | `ai_touchpoints[].touchpoint_id` |
| `step_refs` in AI touchpoints | `ai_touchpoints[].step_refs` | `core_workflows[].steps[].step_id` |
| `workflow_step_refs` in features | `feature_requirements[].workflow_step_refs` | `core_workflows[].steps[].step_id` |
| `data_entity_refs` in features | `feature_requirements[].data_entity_refs` | `data_entities[].entity_id` |
| `role` in workflow actors | `core_workflows[].steps[].actor.role` | `development_standards.roles[].role_id` |
| `system_id` in workflow actors | `core_workflows[].steps[].actor.system_id` | `integration_points[].integration_id` |
| `trigger_ref` in integration endpoints | `integration_points[].endpoints[].trigger_ref` | `core_workflows[].steps[].step_id` |

---

## ID formats

| Type | Format | Example |
|---|---|---|
| `spec_id` | UUID v4 | `a3f7c2e1-84b0-4d9a-b6f3-1e2c5a7d9f04` |
| `entity_id` | `ent_` + snake_case | `ent_purchase_order` |
| `workflow_id` | `wf_` + zero-padded number | `wf_001` |
| `step_id` | `wf_{N}_s{N}` | `wf_001_s03` |
| `feature_id` | `feat_` + zero-padded number | `feat_005` |
| `integration_id` | `int_` + zero-padded number | `int_002` |
| `touchpoint_id` | `ai_` + zero-padded number | `ai_003` |
| `pain_point id` | `pp_` + zero-padded number | `pp_002` |
| `success_metric id` | `sm_` + zero-padded number | `sm_001` |
| `rule_id` | `r_` + zero-padded number | `r_004` |
| `text_block id` | `tb_` + zero-padded number | `tb_002` |

---

## Validation

Validate a spec document against the schema:

```bash
npx ajv-cli validate -s schemas/spec.schema.json -d customers/<slug>/spec.json
```

Or validate the example:

```bash
npx ajv-cli validate -s schemas/spec.schema.json -d schemas/spec.example.json
```
