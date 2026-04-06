import type { ModuleDefinition } from "../types.js";

export const shippingModule: ModuleDefinition = {
  id: "shipping",
  name: "Shipping & Fulfillment",
  alwaysRun: false,
  triggerSignals: [
    "ship",
    "shipping",
    "freight",
    "FedEx",
    "UPS",
    "delivery",
    "logistics",
    "dispatch",
    "carrier",
    "fulfillment",
  ],
  openingTemplate: (ctx) =>
    `Let's talk about getting products to customers. ${ctx} When a product is ready to go, walk me through how it leaves your building.`,
  questions: [
    {
      question:
        "Do you ship out to customers, or do most of them come in to pick up?",
      captures: "Shipping vs. will-call ratio",
    },
    {
      question: "Which carriers do you typically use?",
      captures: "Carrier integrations required (FedEx, UPS, LTL freight, etc.)",
    },
    {
      question:
        "Do you print shipping labels and capture tracking numbers in your current system?",
      captures: "Label printing automation need",
    },
    {
      question:
        "Do you ever ship part of an order and fulfill the rest later — partial shipments?",
      captures: "Partial shipment and backorder handling",
    },
    {
      question:
        "Do customers need packing lists or bills of lading with their orders?",
      captures: "Shipping document requirements",
    },
    {
      question:
        "Is there a final quality check or inspection before things ship?",
      captures: "Pre-shipment inspection, QC hold workflow",
    },
    {
      question:
        "Do you send customers automated notifications when something ships?",
      captures: "Outbound notification/communication workflow",
    },
  ],
  artifactPrompt: null,
  reviewFlagTriggers: [
    {
      condition: "Customer ships via LTL or truckload freight",
      flagMessage: "LTL/FTL freight shipping — may require freight broker integration",
      suggestedAction:
        "Confirm whether automated BOL generation or freight rating is needed",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" shipping fulfillment workflow ERP`,
    `"${industry}" shipping automation label printing manufacturing`,
  ],
  extractionFields: [
    "shipping_vs_will_call",
    "carriers_used",
    "automates_label_printing",
    "has_partial_shipments",
    "needs_shipping_documents",
    "has_pre_shipment_inspection",
    "sends_shipment_notifications",
  ],
};
