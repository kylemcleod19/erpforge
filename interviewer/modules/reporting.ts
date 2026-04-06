import type { ModuleDefinition } from "../types.js";

export const reportingModule: ModuleDefinition = {
  id: "reporting",
  name: "Reporting & Analytics",
  alwaysRun: false,
  triggerSignals: [
    "no visibility",
    "can't see",
    "don't know",
    "spreadsheets everywhere",
    "reports",
    "dashboard",
    "data",
    "analytics",
    "visibility",
    "tracking",
    "KPI",
    "metrics",
  ],
  openingTemplate: (ctx) =>
    `You mentioned having trouble getting a clear picture of the business. ${ctx} What information do you wish you had at your fingertips that's hard to get today?`,
  questions: [
    {
      question:
        "What's the single most important number you check to know how the business is doing?",
      captures: "Primary KPI",
    },
    {
      question:
        "Who else in the company needs to see operational data — owners, managers, supervisors, or even customers?",
      captures: "Reporting audiences and role-based access",
    },
    {
      question:
        "Are there any reports you have to produce on a schedule — weekly summaries, monthly financials, anything like that?",
      captures: "Scheduled reporting requirements",
    },
    {
      question:
        "If you had a single dashboard you could look at each morning, what would be on it?",
      captures: "Dashboard design priorities",
    },
    {
      question:
        "Where does data live today that you wish was connected to everything else?",
      captures: "Data silos to integrate",
    },
    {
      question:
        "Are there decisions you're making on gut feel today that you'd prefer to make with actual data?",
      captures: "Analytics opportunities, decision-support needs",
    },
  ],
  artifactPrompt: null,
  reviewFlagTriggers: [
    {
      condition: "Customer needs to share reports externally with customers or a board",
      flagMessage: "External reporting or customer portal access may be required",
      suggestedAction:
        "Confirm whether reports are internal-only or need to be accessible to customers/stakeholders",
    },
  ],
  searchQueries: (industry) => [
    `"${industry}" manufacturing KPIs small business`,
    `"${industry}" ERP reporting requirements analytics`,
  ],
  extractionFields: [
    "primary_kpi",
    "reporting_audiences",
    "has_scheduled_reports",
    "dashboard_priorities",
    "data_silos",
    "decision_support_needs",
  ],
};
