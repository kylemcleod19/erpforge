import type { ModuleDefinition } from "../types.js";

export const financeModule: ModuleDefinition = {
  id: "finance",
  name: "Finance & Invoicing",
  alwaysRun: false,
  triggerSignals: [
    "invoic",
    "billing",
    "QuickBooks",
    "Sage",
    "accounting",
    "cash flow",
    "payment",
    "invoice",
    "bill",
    "accounts receivable",
    "AR",
  ],
  openingTemplate: (ctx) =>
    `Let's talk about the billing side of the business. ${ctx} After a shipment goes out, what's the process for getting paid?`,
  questions: [
    {
      question:
        "What accounting software are you using — QuickBooks, Sage, something else, or nothing?",
      captures: "Accounting integration target",
    },
    {
      question:
        "How long after a shipment does an invoice typically go out today?",
      captures: "Invoicing lag — key pain indicator",
    },
    {
      question:
        "Is it always bill-on-shipment, or do you ever do progress billing — invoicing at milestones on a larger job?",
      captures: "Progress billing, milestone billing",
    },
    {
      question: "What are your standard payment terms?",
      captures: "Net days, payment terms",
    },
    {
      question:
        "Do you have issues with customers paying late? How do you track open balances today?",
      captures: "AR management, collections workflow",
    },
    {
      question:
        "Are there any jobs where pricing is unusual — time and materials, cost-plus, or government-contract pricing?",
      captures: "Complex pricing models flag",
    },
    {
      question:
        "Do you generate reports on job profitability or cost variance?",
      captures: "Job costing reporting needs",
    },
  ],
  artifactPrompt: null,
  reviewFlagTriggers: [
    {
      condition: "Customer describes time-and-materials or cost-plus pricing",
      flagMessage: "T&M or cost-plus pricing model mentioned",
      suggestedAction:
        "Standard invoice-on-shipment flow won't cover this — confirm billing module scope",
    },
    {
      condition: "Customer uses Sage, NetSuite, or accounting software other than QuickBooks",
      flagMessage: "Non-QuickBooks accounting integration required",
      suggestedAction:
        "Verify integration availability and API access for their specific accounting platform",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" invoicing workflow ERP small manufacturer`,
    `"${industry}" job costing accounting integration manufacturing`,
  ],
  extractionFields: [
    "accounting_software",
    "invoice_lag_days",
    "uses_progress_billing",
    "payment_terms",
    "has_ar_management_pain",
    "has_complex_pricing",
    "needs_job_cost_reporting",
  ],
};
