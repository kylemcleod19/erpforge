import type { ModuleDefinition } from "../types.js";

export const inventoryModule: ModuleDefinition = {
  id: "inventory",
  name: "Inventory Management",
  alwaysRun: true,
  triggerSignals: [],
  openingTemplate: (ctx) =>
    `Let's talk about inventory. ${ctx} When production needs materials to build an order, how do they know what's available?`,
  questions: [
    {
      question:
        "Do you track where things are physically — by bin, shelf, or warehouse zone?",
      captures: "Location-based inventory tracking",
    },
    {
      question:
        "How many different materials or components do you need to track in the system?",
      captures: "Item count, data scope",
    },
    {
      question:
        "Do you do physical inventory counts? How often, and how do you run them today?",
      captures: "Cycle counting, physical inventory workflow",
    },
    {
      question:
        "Has it ever happened that you promised a delivery date and then discovered you were short on materials?",
      captures: "Inventory visibility pain depth",
    },
    {
      question:
        "Do you have minimum stock levels you try to maintain? How do you know when to reorder today?",
      captures: "Reorder points, MRP-lite trigger logic",
    },
    {
      question:
        "Do any materials need special tracking — lot numbers, serial numbers, or expiry dates?",
      captures: "Lot/serial tracking, regulatory/compliance signal",
    },
    {
      question:
        "When materials arrive from a supplier, is there a receiving process — counting, inspecting, putting away?",
      captures: "Receiving workflow",
    },
    {
      question:
        "Do you ever have consignment stock — materials that belong to a customer or vendor until you use them?",
      captures: "Consignment inventory",
    },
  ],
  artifactPrompt: null,
  reviewFlagTriggers: [
    {
      condition: "Customer mentions lot or serial number tracking is required",
      flagMessage: "Lot/serial number tracking required",
      suggestedAction: "Confirm traceability depth — especially if combined with regulated industry or certifications",
    },
    {
      condition: "Customer has multiple warehouse locations or storage sites",
      flagMessage: "Multi-location inventory tracking needed",
      suggestedAction: "Confirm which locations are in scope for phase 1",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" inventory management ERP requirements small manufacturer`,
    `"${industry}" warehouse management best practices`,
  ],
  extractionFields: [
    "uses_location_tracking",
    "item_count_estimate",
    "cycle_count_frequency",
    "has_inventory_visibility_pain",
    "uses_reorder_points",
    "requires_lot_serial_tracking",
    "has_receiving_workflow",
    "has_consignment_inventory",
  ],
};
