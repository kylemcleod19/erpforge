import type { ModuleDefinition } from "../types.js";

export const bomModule: ModuleDefinition = {
  id: "bom",
  name: "BOM & Product Structure",
  alwaysRun: true,
  triggerSignals: [],
  openingTemplate: (ctx) =>
    `Let's talk about your products in more detail. ${ctx} Can you walk me through what goes into building one unit — what are the main components or materials?`,
  questions: [
    {
      question:
        "Do those components themselves have sub-components, or is it all top-level parts?",
      captures: "Multi-level BOM depth",
    },
    {
      question:
        "How often does the recipe for a [product] change, and who manages those changes?",
      captures: "BOM revision frequency, change management process",
    },
    {
      question:
        "Do you ever build custom or configured variants — same base product but with different options per customer order?",
      captures: "Configurable BOM, engineer-to-order signal",
    },
    {
      question:
        "Where do your BOMs live right now — spreadsheet, paper, an old system?",
      captures: "Current BOM state, migration complexity",
    },
    {
      question:
        "If I asked you how much it costs to build one [product], how would you figure that out today?",
      captures: "Cost rollup method, standard vs. actual cost",
    },
    {
      question:
        "Are there any assemblies you build that are used only inside the final product — never stocked or sold on their own?",
      captures: "Phantom assemblies",
    },
    {
      question: "Roughly how many distinct parts or materials are in your catalog?",
      captures: "SKU count, data migration scale",
    },
  ],
  artifactPrompt:
    "If you have a BOM or parts list — even a messy spreadsheet — I'd love to see it. You can share a file path or paste the contents.",
  reviewFlagTriggers: [
    {
      condition: "SKU count mentioned is greater than 500",
      flagMessage: "Large parts catalog (>500 SKUs) — data migration tooling required",
      suggestedAction: "Plan a separate data import project before go-live",
    },
    {
      condition: "Customer mentions engineer-to-order or highly custom configured products",
      flagMessage: "Configurable BOM / engineer-to-order workflow mentioned",
      suggestedAction: "Confirm CPQ (configure-price-quote) scope before estimating",
    },
    {
      condition: "Customer describes BOM depth greater than 3 levels",
      flagMessage: "Deep multi-level BOM structure (>3 levels)",
      suggestedAction: "Confirm phantom assembly and cost rollup handling in detail",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" bill of materials requirements ERP`,
    `"${industry}" BOM revision control best practices manufacturing`,
  ],
  extractionFields: [
    "bom_levels",
    "bom_revision_process",
    "has_configurable_products",
    "current_bom_storage",
    "cost_rollup_method",
    "has_phantom_assemblies",
    "sku_count_estimate",
    "product_description",
  ],
};
