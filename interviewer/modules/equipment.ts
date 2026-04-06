import type { ModuleDefinition } from "../types.js";

export const equipmentModule: ModuleDefinition = {
  id: "equipment",
  name: "Equipment & Maintenance",
  alwaysRun: false,
  triggerSignals: [
    "machine",
    "equipment",
    "downtime",
    "maintenance",
    "breakdown",
    "CNC",
    "press",
    "lathe",
    "mill",
    "equipment failure",
    "preventive maintenance",
    "PM",
    "calibration",
  ],
  openingTemplate: (ctx) =>
    `You mentioned equipment or machines. ${ctx} How central is equipment availability to your production — what happens if a key machine goes down?`,
  questions: [
    {
      question:
        "Do you have a list of the machines or equipment that jobs run on? Does each product or operation need specific equipment?",
      captures: "Equipment catalog, routing to specific equipment",
    },
    {
      question:
        "Do you have a scheduled maintenance program — like PMs or calibrations on a set schedule?",
      captures: "Preventive maintenance workflow",
    },
    {
      question:
        "Has equipment downtime ever caused you to miss a customer delivery commitment?",
      captures: "Downtime impact, urgency level",
    },
    {
      question:
        "When a machine needs service, how do you track that work today?",
      captures: "Maintenance order/work order tracking",
    },
    {
      question:
        "Do you need to know which specific machine produced a given part — for traceability or quality records?",
      captures: "Machine-level traceability requirement",
    },
    {
      question:
        "Are any of your machines connected to a network or generating data — like cycle counts, alarms, or OEE data?",
      captures: "IoT / machine data integration signal",
    },
  ],
  artifactPrompt: null,
  reviewFlagTriggers: [
    {
      condition: "Customer has IoT-connected machines or machine data collection",
      flagMessage: "IoT machine data integration mentioned",
      suggestedAction:
        "Note as phase 2 scope — machine data integration is significant and should not be in MVP",
    },
    {
      condition: "Customer requires knowing which machine produced each part",
      flagMessage: "Machine-level traceability required",
      suggestedAction:
        "Confirm traceability requirement — may require specialized quality module",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" equipment maintenance ERP requirements manufacturing`,
    `"${industry}" machine capacity planning production scheduling`,
  ],
  extractionFields: [
    "has_equipment_catalog",
    "routing_uses_specific_equipment",
    "has_preventive_maintenance",
    "downtime_causes_missed_deliveries",
    "tracks_maintenance_orders",
    "requires_machine_traceability",
    "has_iot_machines",
  ],
};
