# Schema Changelog

This file tracks changes to `spec.schema.json` itself — the meta-schema that validates all customer spec documents.

This is **separate** from the `history[]` array inside each customer spec document. The `history[]` array records changes to a specific customer's spec. This file records changes to the schema definition that all specs conform to.

---

## Versioning

The meta-schema version is the `schema_version` field at the root of `spec.schema.json`.

Schema versioning follows semver:
- **PATCH**: New optional fields added, enum values added (backwards compatible)
- **MINOR**: Required fields added (existing docs need migration), sections restructured
- **MAJOR**: Breaking changes — field types changed, fields removed, IDs renamed

When bumping schema version, note the migration path for existing spec documents.

---

## [1.0.0] — 2026-04-06

**Initial schema release.**

Defines all sections and `$defs` for:
- `BusinessProfile` with `company_size`, `revenue_model`, `pain_points`, `success_metrics`
- `CoreWorkflow` with `WorkflowStep`, `WorkflowActor`, `WorkflowRule`, `EntityRef`
- `DataEntity` with `FieldDescriptor`, `FieldRelationship`, `ValidationRule`, `EntityIndex`
- `FeatureRequirement` with `UINote`
- `IntegrationPoint` with `IntegrationEndpoint`, `DataMapping`
- `AITouchpoint` with `AITrigger`, `AIInputContext`, `AIExpectedOutput`, `AIHumanInTheLoop`, `AIFallback`
- `DevelopmentStandards` with `UserRole`, `DocumentationRules`, `APIConventions`, `TextBlock`
- `HistoryEntry`
- Rendering system: `RenderAudience`, `RenderAudienceArray`, `StringEnvelope`, `ArrayEnvelope`, `ObjectEnvelope`

All spec documents created against this schema set `schema_version: "1.0.0"`.
