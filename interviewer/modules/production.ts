import type { ModuleDefinition } from "../types.js";

export const productionModule: ModuleDefinition = {
  id: "production",
  name: "Production & Shop Floor",
  alwaysRun: false,
  triggerSignals: [
    "production",
    "shop floor",
    "manufacturing",
    "machine",
    "work center",
    "routing",
    "operator",
    "job order",
    "work order",
    "fabrication",
    "assembly",
  ],
  openingTemplate: (ctx) =>
    `Let's walk through what actually happens on the shop floor. ${ctx} Once a job is released to production, what happens first?`,
  questions: [
    {
      question:
        "Are there defined steps for producing a [product] — like a routing or process sheet that lists the operations in order?",
      captures: "Routings, work center operations sequence",
    },
    {
      question:
        "Do you have specific machines or work centers that jobs run through? Do any of those have capacity limits?",
      captures: "Work centers, capacity constraints",
    },
    {
      question:
        "How do you assign work to people or machines — is there a schedule, or does the supervisor direct people each morning?",
      captures: "Scheduling method, labor assignment process",
    },
    {
      question:
        "Do you track how long each job actually takes, or how long each person works on a job?",
      captures: "Labor tracking, job costing, time capture",
    },
    {
      question:
        "What does 'job complete' mean on your floor — is there a sign-off, an inspection, a count?",
      captures: "Job completion criteria and workflow",
    },
    {
      question:
        "Do you ever send work out to a subcontractor — things like plating, heat treat, or laser cutting?",
      captures: "Outside operations, subcontracting workflow",
    },
    {
      question:
        "If a machine breaks down, what happens to the jobs that were scheduled on it?",
      captures: "Downtime handling, rescheduling process",
    },
  ],
  artifactPrompt:
    "If you have a routing sheet, process card, or traveler document for any product, sharing it would help me understand your floor workflow.",
  reviewFlagTriggers: [
    {
      condition: "Customer describes subcontracting or outside operations",
      flagMessage: "Outside operations / subcontracting workflow required",
      suggestedAction:
        "Outside operations add procurement and routing complexity — confirm whether PO-linked subcontracting is needed",
    },
    {
      condition: "Customer describes complex capacity constraints or scheduling needs",
      flagMessage: "Complex capacity planning or scheduling mentioned",
      suggestedAction:
        "Evaluate whether a dedicated scheduling / finite capacity planning module is needed",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" shop floor management ERP requirements`,
    `"${industry}" production scheduling work order best practices`,
  ],
  extractionFields: [
    "has_defined_routings",
    "has_work_centers",
    "has_capacity_constraints",
    "scheduling_method",
    "tracks_labor_time",
    "job_completion_criteria",
    "uses_subcontracting",
    "downtime_impact",
  ],
};
