/**
 * ERP Forge Dev Agent — Frontend Prompts
 *
 * Prompts for RSC pages, Client Component forms, and table views.
 */

import type {
  ErpSpec,
  FeatureRequirement,
  DataEntity,
  RoleDefinition,
} from "../types.js";
import { buildSystemPrompt } from "./system.js";

function featureToRoute(feature: FeatureRequirement): string {
  return feature.name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Builds the prompt for a Server Component list/detail page.
 */
export function buildServerPagePrompt(
  spec: ErpSpec,
  feature: FeatureRequirement,
  entity: DataEntity | null
): string {
  const route = featureToRoute(feature);
  const layout = feature.ui_notes?.layout ?? "list";
  const displayFields = feature.ui_notes?.display_fields ?? [];

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/app/(app)/${route}/page.tsx

/**
 * ${feature.name} — Server Component Page
 * Implements: ${feature.feature_id}${entity ? ", " + entity.entity_id : ""}
 * Roles: ${feature.user_roles.join(", ")}
 */

FEATURE SPEC:
- Name: ${feature.name}
- Type: ${feature.type}
- Priority: ${feature.priority}
- Layout: ${layout}
- Primary action: ${feature.ui_notes?.primary_action ?? "none"}
- Display fields: ${displayFields.length ? displayFields.join(", ") : "all entity fields"}

ACCEPTANCE CRITERIA:
${feature.acceptance_criteria.map((ac) => `{/* ✓ Spec ${feature.feature_id}: ${ac} */}`).join("\n")}

${entity ? `ENTITY:\n${entity.name} (${entity.entity_id})\nFields: ${entity.fields.map((f) => f.field_id).join(", ")}` : ""}

REQUIREMENTS:
1. "use server" not needed — this is a Server Component by default in App Router
2. Call Drizzle directly in the component body (no fetch to own API)
3. Include the acceptance criteria as JSX comments at the top
4. Wrap in <RoleGuard roles={[${feature.user_roles.map((r) => `"${r}"`).join(", ")}]}>
5. ${layout === "list" ? "Render a cursor-paginated DataTable — import from @/components/tables/data-table" : layout === "detail" ? "Render a detail view with all entity fields" : layout === "dashboard" ? "Render dashboard cards/stats" : "Render appropriate layout"}
6. Link to the form page for create/edit (Client Component)
7. Export default async function ${feature.feature_id.replace("feat_", "Feat").replace(/_/g, "")}Page()`;
}

/**
 * Builds the prompt for a Client Component form.
 */
export function buildFormPrompt(
  spec: ErpSpec,
  feature: FeatureRequirement,
  entity: DataEntity | null
): string {
  const route = featureToRoute(feature);

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/app/(app)/${route}/new/page.tsx (and the form component it imports)

/**
 * ${feature.name} — Create Form
 * Implements: ${feature.feature_id}${entity ? ", " + entity.entity_id : ""}
 * Roles: ${feature.user_roles.join(", ")}
 */

FEATURE SPEC:
- Name: ${feature.name}
- Primary action: ${feature.ui_notes?.primary_action ?? "Create"}

${entity ? `ENTITY FIELDS:\n${entity.fields.filter((f) => !["uuid", "datetime"].includes(f.type) || f.field_id === "id" === false).map((f) => `- ${f.field_id} (${f.type}${f.required ? ", required" : ""}${f.enum_values ? `, options: [${f.enum_values.join(", ")}]` : ""})`).join("\n")}` : ""}

REQUIREMENTS:
1. "use client" directive — this is a Client Component
2. Use react-hook-form + zodResolver for form management
3. Derive Zod schema from entity fields (required/optional, enum values → z.enum)
4. Use shadcn/ui Form, FormField, FormItem, FormLabel, FormControl, FormMessage
5. On submit: POST to /api/v1/${entity ? entity.entity_id.replace("ent_", "").replace(/_/g, "-") : route}, then router.push back to list
6. Show loading state on submit button
7. Roles guard: check session.user.role is in [${feature.user_roles.map((r) => `"${r}"`).join(", ")}]`;
}

/**
 * Builds the prompt for the app layout (sidebar + role guard).
 */
export function buildAppLayoutPrompt(spec: ErpSpec): string {
  const p1Features = spec.feature_requirements.filter(
    (f) => f.priority === "P1" && f.type === "screen"
  );

  const navItems = p1Features
    .map((f) => {
      const route = featureToRoute(f);
      return `  { label: "${f.name}", href: "/${route}", roles: [${f.user_roles.map((r) => `"${r}"`).join(", ")}] }`;
    })
    .join(",\n");

  return `${buildSystemPrompt(spec.spec_version)}

Generate src/app/(app)/layout.tsx

/**
 * Authenticated App Shell
 * Implements: development_standards.roles, all screen features
 */

NAVIGATION ITEMS (P1 features):
[
${navItems}
]

ROLES: ${spec.development_standards.roles.map((r) => r.role_id).join(", ")}

REQUIREMENTS:
1. Server Component layout that checks auth session (better-auth getSession)
2. Redirect to /login if no session
3. Render sidebar with nav items filtered by current user's role
4. Include user info (name, role) in sidebar footer
5. Sidebar uses shadcn/ui components
6. Main content area renders {children}
7. RoleGuard component: export from components/layout/role-guard.tsx`;
}

/**
 * Builds the prompt for the login page.
 */
export function buildLoginPagePrompt(spec: ErpSpec): string {
  return `${buildSystemPrompt(spec.spec_version)}

Generate src/app/(auth)/login/page.tsx

/**
 * Login Page
 * Implements: development_standards (auth_mechanism: jwt_bearer)
 * Customer: ${spec.business_profile.company_name}
 */

REQUIREMENTS:
1. "use client" directive
2. Email + password form with react-hook-form + Zod validation
3. Call better-auth signIn.email() on submit
4. On success: router.push("/dashboard") or redirect to callbackUrl param
5. Show error message on failed login
6. Redirect to /dashboard if already authenticated
7. Minimal styling — centered card on full-height page (no sidebar)`;
}
