import type { ModuleDefinition } from "../types.js";

export const purchasingModule: ModuleDefinition = {
  id: "purchasing",
  name: "Purchasing & Vendor Management",
  alwaysRun: false,
  triggerSignals: [
    "suppliers",
    "vendors",
    "raw materials",
    "we buy",
    "procurement",
    "purchase order",
    "purchasing",
    "sourcing",
  ],
  openingTemplate: (ctx) =>
    `You mentioned sourcing materials from suppliers. ${ctx} Walk me through how purchasing works — when does someone decide to place a purchase order?`,
  questions: [
    {
      question: "How many active suppliers do you buy from on a regular basis?",
      captures: "Vendor count",
    },
    {
      question:
        "Is purchasing triggered by production needs — like when a job is released — or do you buy on a schedule regardless?",
      captures: "MRP-driven vs. reorder point vs. manual purchasing",
    },
    {
      question:
        "Do you use blanket purchase orders — agreements for ongoing supply over time — or do you place individual POs each time?",
      captures: "PO types: blanket vs. spot",
    },
    {
      question:
        "What's your typical lead time from placing a PO to having the materials in hand?",
      captures: "Supplier lead time data",
    },
    {
      question:
        "Have you had issues with late deliveries or quality problems from suppliers? How do you track that now?",
      captures: "Vendor performance tracking, approved vendor list need",
    },
    {
      question:
        "Do you maintain an approved supplier list or track certifications for your vendors?",
      captures: "AVL, supplier qualification, quality system requirements",
    },
    {
      question:
        "Who in your company can approve a purchase order? Is there a dollar amount that requires a sign-off?",
      captures: "PO approval workflow",
    },
    {
      question:
        "Do any suppliers send invoices or PO acknowledgements electronically, or is it all paper and email?",
      captures: "EDI, supplier portal signal",
    },
  ],
  artifactPrompt:
    "If you have a vendor list or an example PO you've sent to a supplier, that would be useful context.",
  reviewFlagTriggers: [
    {
      condition: "Customer mentions EDI or electronic invoicing with suppliers",
      flagMessage: "EDI or supplier portal integration may be required",
      suggestedAction: "Clarify which suppliers and what transaction types — EDI scoping can be significant",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" purchasing workflow ERP small manufacturer`,
    `"${industry}" vendor management best practices manufacturing`,
  ],
  extractionFields: [
    "vendor_count_estimate",
    "purchasing_trigger_method",
    "uses_blanket_pos",
    "typical_supplier_lead_time",
    "has_vendor_performance_tracking",
    "uses_approved_vendor_list",
    "po_approval_workflow",
    "uses_edi_or_electronic_invoicing",
  ],
};
