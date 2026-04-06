import type { ModuleDefinition } from "../types.js";

export const customerOrdersModule: ModuleDefinition = {
  id: "customer-orders",
  name: "Customer Orders & Quoting",
  alwaysRun: true,
  triggerSignals: [],
  openingTemplate: (ctx) =>
    `Let's dig into how orders come in. ${ctx} Is that typically how orders arrive, or does it vary?`,
  questions: [
    {
      question:
        "Do customers send formal purchase orders, or is it more informal — email, phone, verbal agreement?",
      captures: "PO formality, order intake channel",
    },
    {
      question: "Before you accept an order, do you send a quote first?",
      captures: "Quoting workflow existence",
    },
    {
      question:
        "What goes into a quote — how do you figure out the price?",
      captures: "Quote components: BOM cost, labor, margin, lead time",
    },
    {
      question:
        "How long does it take to build a quote today? What's the slowest part of the process?",
      captures: "Quote cycle time, pain depth",
    },
    {
      question:
        "Do quotes expire? What happens when a customer comes back on an old quote months later?",
      captures: "Quote lifecycle, version control",
    },
    {
      question:
        "Do you have customers on special pricing — contracts or volume discounts?",
      captures: "Price lists, customer-specific pricing",
    },
    {
      question:
        "What information absolutely has to be on an order before you'll start production?",
      captures: "Required PO fields",
    },
    {
      question:
        "How do you keep customers updated on where their order stands?",
      captures: "Order status communication, customer portal signal",
    },
    {
      question:
        "Do customers change their orders after you've started production? How do you handle that today?",
      captures: "Change orders, engineering change order process",
    },
    {
      question: "How many orders are typically open at any one time?",
      captures: "Volume and scale signal",
    },
  ],
  artifactPrompt:
    "A blank quote form or order confirmation you've sent to a customer would be very helpful. Feel free to share a file path or paste it.",
  reviewFlagTriggers: [
    {
      condition: "Customer mentions time-and-materials or cost-plus pricing",
      flagMessage: "Complex billing model (T&M or cost-plus) mentioned",
      suggestedAction: "Confirm billing module scope — standard invoice workflow may not be sufficient",
    },
    {
      condition: "Customer mentions government, defense, or military contracts",
      flagMessage: "Government/defense contracts — DFARS or ITAR may apply",
      suggestedAction: "Escalate to compliance review before scoping",
    },
    {
      condition: "Customer describes more than 100 concurrent open orders",
      flagMessage: "High-volume order management (>100 concurrent orders)",
      suggestedAction: "Evaluate scheduling and capacity planning module scope",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" order management workflow ERP small manufacturer`,
    `"${industry}" quoting process manufacturing software`,
  ],
  extractionFields: [
    "po_formality",
    "uses_quoting",
    "quote_components",
    "quote_cycle_time",
    "has_quote_expiry",
    "has_customer_specific_pricing",
    "required_order_fields",
    "order_status_communication_method",
    "has_change_orders",
    "concurrent_open_orders_estimate",
  ],
};
