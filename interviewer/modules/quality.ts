import type { ModuleDefinition } from "../types.js";

export const qualityModule: ModuleDefinition = {
  id: "quality",
  name: "Quality & Compliance",
  alwaysRun: false,
  triggerSignals: [
    "ISO",
    "AS9100",
    "IATF",
    "FDA",
    "certification",
    "certified",
    "inspection",
    "defect",
    "scrap",
    "quality",
    "compliance",
    "traceability",
    "conformance",
    "aerospace",
    "medical",
    "automotive",
    "food",
  ],
  openingTemplate: (ctx) =>
    `You mentioned quality requirements or certifications. ${ctx} Tell me about how quality works in your operation — is there a formal quality process?`,
  questions: [
    {
      question:
        "Are there inspection steps built into your production process? At what points in the workflow?",
      captures: "In-process inspection points",
    },
    {
      question:
        "Do customers require certificates of conformance, test reports, or other quality documentation with their orders?",
      captures: "Quality documentation output requirements",
    },
    {
      question:
        "What certifications do you hold or are working toward — ISO 9001, AS9100, IATF 16949, FDA registration?",
      captures: "Certification requirements and compliance scope",
    },
    {
      question:
        "When a part fails inspection or gets scrapped, how do you record and handle that today?",
      captures: "NCR (non-conformance report), scrap tracking workflow",
    },
    {
      question:
        "Do you need to trace a finished product back to the specific batch or lot of raw material it was made from?",
      captures: "Material traceability, lot tracking requirement",
    },
    {
      question:
        "Do customers audit your facility or require you to be on their approved supplier list?",
      captures: "Customer audits, supplier qualification process",
    },
    {
      question:
        "Are there first-article inspections for new parts or new customer programs?",
      captures: "FAIR, PPAP, first article inspection workflow",
    },
  ],
  artifactPrompt:
    "If you have a current inspection checklist, NCR form, or certificate of conformance template, sharing it would be helpful.",
  reviewFlagTriggers: [
    {
      condition: "Customer has or is pursuing AS9100, IATF 16949, or FDA registration",
      flagMessage:
        "Certification-level quality system required (AS9100/IATF/FDA) — significant scope",
      suggestedAction:
        "Confirm full traceability, document control, and NCR workflow requirements before estimating",
    },
    {
      condition: "Customer mentions PPAP or FAIR (first article inspection report)",
      flagMessage: "PPAP / FAIR workflow required",
      suggestedAction: "First article inspection is a distinct module — confirm scope",
    },
    {
      condition: "Customer requires material traceability to supplier lot/heat numbers",
      flagMessage: "Full material traceability required",
      suggestedAction:
        "Lot tracking must be implemented end-to-end from receiving through shipping",
    },
  ],
  searchQueries: (industry, certifications) => {
    const queries = [
      `"${industry}" quality management system ERP requirements`,
      `"${industry}" quality control workflow manufacturing software`,
    ];
    if (certifications.length > 0) {
      queries.push(`${certifications[0]} ERP software requirements quality`);
    }
    return queries;
  },
  extractionFields: [
    "has_in_process_inspection",
    "requires_quality_documents",
    "certifications_held_or_pursuing",
    "has_ncr_workflow",
    "requires_material_traceability",
    "has_customer_audits",
    "requires_fair_ppap",
  ],
};
