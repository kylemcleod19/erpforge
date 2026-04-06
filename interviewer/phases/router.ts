import Anthropic from "@anthropic-ai/sdk";
import type { InterviewSession } from "../types.js";
import { saveSession } from "../session.js";
import { ALL_MODULES } from "../modules/index.js";
import { ROUTING_SYSTEM } from "../prompts/system.js";

interface RoutingOutput {
  selected_modules: Array<{
    module_id: string;
    priority: "P1" | "P2";
    reason: string;
  }>;
}

export async function routeModules(
  session: InterviewSession,
  client: Anthropic
): Promise<InterviewSession> {
  const intake = session.intake!;

  const moduleDescriptions = ALL_MODULES.map((m) => ({
    id: m.id,
    name: m.name,
    alwaysRun: m.alwaysRun,
    triggerSignals: m.triggerSignals,
  }));

  const prompt = `Given this manufacturing customer's intake data, decide which ERP interview modules to run.

Customer intake data:
${JSON.stringify(intake, null, 2)}

Available modules:
${JSON.stringify(moduleDescriptions, null, 2)}

Rules:
- Modules with alwaysRun=true must always be included (P1)
- For other modules, check if the customer's routing_signals or their answers contain the module's trigger signals
- Priority P1 = essential for MVP spec, P2 = important but can be asked in a follow-up session
- Order modules so that always-run modules come first, then ordered by relevance

Return a JSON object with this shape:
{
  "selected_modules": [
    { "module_id": "bom", "priority": "P1", "reason": "Always run" },
    ...
  ]
}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: ROUTING_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";

  let routing: RoutingOutput;
  try {
    routing = JSON.parse(text) as RoutingOutput;
  } catch {
    // Fallback: always-run modules only
    routing = {
      selected_modules: ALL_MODULES.filter((m) => m.alwaysRun).map((m) => ({
        module_id: m.id,
        priority: "P1" as const,
        reason: "Always run",
      })),
    };
  }

  session.selected_modules = routing.selected_modules.map((m) => ({
    module_id: m.module_id,
    priority: m.priority,
  }));

  session.current_phase = "modules";
  saveSession(session);
  return session;
}
