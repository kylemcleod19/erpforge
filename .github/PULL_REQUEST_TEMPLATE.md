## What does this PR do?

<!-- One or two sentences. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation
- [ ] Infrastructure / deployment

## Checklist

- [ ] `npm run typecheck` passes locally
- [ ] `npm run validate-schema` passes (if anything in `schemas/` changed)
- [ ] If `schemas/spec.schema.json` structure changed: `schema_version` bumped and `schemas/changelog.md` updated
- [ ] If `schemas/spec.schema.json` changed: `spec.example.json` is valid against the new schema
- [ ] No customer data (`customers/` files) committed
- [ ] No secrets or API keys committed
- [ ] No changes to `web/railway.toml` or `.github/workflows/` without explicit review
