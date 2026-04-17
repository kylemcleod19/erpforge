import Anthropic from "@anthropic-ai/sdk";
import type { InterviewSession, IntakeData, Message } from "../types.js";
import { saveSession } from "../session.js";
import { BASE_PERSONA, EXTRACTION_SYSTEM } from "../prompts/system.js";

const INTAKE_SYSTEM = `${BASE_PERSONA}

You are in the GENERAL INTAKE phase. Your goal is to understand the business at a high level.

Cover these topics — in a natural order based on the conversation flow:
1. What they make or provide
2. A walkthrough of a typical order (start to finish)
3. How many employees and how they're organized
4. Approximate annual revenue band
5. What software they currently rely on
6. Their single biggest pain point
7. Other regular headaches
8. Whether they make to order, stock, or both
9. Any compliance or certifications that affect operations
10. What success looks like in 12 months
11. Number of locations/sites
12. Optional artifact offer (order forms, quote templates)

When you have covered all topics sufficiently, call the complete_intake tool.
Do NOT call complete_intake until you have asked about at least topics 1, 2, 3, 5, 6, and 10.`;

const COMPLETE_INTAKE_TOOL: Anthropic.Tool = {
  name: "complete_intake",
  description:
    "Call this when you have gathered sufficient information about the business to proceed to detailed module interviews. Do not call until you have covered the core intake topics.",
  input_schema: {
    type: "object" as const,
    properties: {
      ready: {
        type: "boolean",
        description: "Set to true when ready to proceed",
      },
      summary: {
        type: "string",
        description: "One-paragraph summary of what you learned about this business",
      },
    },
    required: ["ready", "summary"],
  },
};

/**
 * Runs the intake phase. Returns when the agent calls complete_intake.
 * Updates session.messages in place.
 */
export async function runIntake(
  session: InterviewSession,
  client: Anthropic,
  onMessage: (role: "assistant" | "user", content: string) => Promise<string>
): Promise<InterviewSession> {
  const openingLine =
    "I'll be asking about your operations, workflows, and current systems — this feeds directly into your ERP spec. Start with your product line: what do you manufacture?";

  // Deliver opening line and get first user response
  const firstUserResponse = await onMessage("assistant", openingLine);
  session.messages.push({ role: "assistant", content: openingLine });
  session.messages.push({ role: "user", content: firstUserResponse });
  saveSession(session);

  let intakeDone = false;

  while (!intakeDone) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: INTAKE_SYSTEM,
      tools: [COMPLETE_INTAKE_TOOL],
      messages: session.messages as Anthropic.MessageParam[],
    });

    for (const block of response.content) {
      if (block.type === "text") {
        const assistantText = block.text;
        const userResponse = await onMessage("assistant", assistantText);
        session.messages.push({ role: "assistant", content: assistantText });
        session.messages.push({ role: "user", content: userResponse });
        saveSession(session);
      } else if (block.type === "tool_use" && block.name === "complete_intake") {
        // Intake is done — extract structured data
        intakeDone = true;

        // Acknowledge the tool call so Claude doesn't stall
        session.messages.push({
          role: "assistant",
          content: response.content,
        } as Message);
        session.messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: block.id,
              content: "Intake complete. Proceeding to extract structured data.",
            },
          ],
        } as Message);

        // Run extraction
        session.intake = await extractIntakeData(session.messages, client);
        saveSession(session);
        break;
      }
    }

    if (response.stop_reason === "end_turn" && !intakeDone) {
      // Claude responded without calling the tool — keep going
      continue;
    }
  }

  session.current_phase = "routing";
  saveSession(session);
  return session;
}

async function extractIntakeData(
  messages: Message[],
  client: Anthropic
): Promise<IntakeData> {
  const transcript = messages
    .filter((m) => typeof m.content === "string")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract the following fields from this intake interview transcript. Use null for anything not mentioned.

Fields to extract:
- company_name (string)
- industry (string: one of contract_manufacturing, discrete_manufacturing, process_manufacturing, job_shop, assembly, fabrication, food_and_beverage, electronics, aerospace, automotive, medical_devices, or "other")
- industry_display (string: human-readable industry description)
- employees (number or null)
- revenue_band (string: one of under_1M, 1M_10M, 10M_50M, 50M_plus, or null)
- revenue_model (array of strings: job_shop, blanket_orders, make_to_stock, make_to_order, engineer_to_order, configure_to_order, contract_manufacturing, distribution, repair_and_overhaul, subscription, other)
- manufacturing_sites (number, default 1)
- current_software (array of strings)
- pain_points (array of objects: {description: string, severity: "low"|"medium"|"high"|"critical"})
- success_metrics (array of strings)
- certifications (array of strings, e.g. ["ISO 9001", "AS9100"])
- has_compliance_requirements (boolean)
- workflow_summary (string: one paragraph describing their typical order-to-shipment flow)
- routing_signals (array of strings: keywords that indicate which interview modules are needed)

Transcript:
${transcript}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";

  try {
    return JSON.parse(text) as IntakeData;
  } catch {
    // Fallback: return minimal valid intake
    return {
      company_name: "Unknown",
      industry: "other",
      industry_display: "Manufacturing",
      employees: 0,
      revenue_band: "1M_10M",
      revenue_model: ["make_to_order"],
      manufacturing_sites: 1,
      current_software: [],
      pain_points: [],
      success_metrics: [],
      certifications: [],
      has_compliance_requirements: false,
      workflow_summary: "Details gathered via interview.",
      routing_signals: [],
    };
  }
}
