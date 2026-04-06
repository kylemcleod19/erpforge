import Anthropic from "@anthropic-ai/sdk";
import type {
  InterviewSession,
  ResearchResult,
  GapAnalysisResult,
  Message,
} from "../types.js";
import { saveSession } from "../session.js";
import { getModule } from "../modules/index.js";
import { RESEARCH_SYSTEM } from "../prompts/system.js";

/**
 * Research cache key for a module × industry combination.
 */
function cacheKey(moduleId: string, industry: string): string {
  return `${moduleId}:${industry}`;
}

/**
 * Phase 3a: Research Gate.
 * Checks the cache for (module_id, industry). If not present, runs web searches
 * and synthesises findings. Returns the ResearchResult, updating the session cache.
 */
export async function runResearchGate(
  session: InterviewSession,
  moduleId: string,
  client: Anthropic,
  onStatusMessage: (msg: string) => void
): Promise<ResearchResult> {
  const industry = session.intake!.industry;
  const certifications = session.intake!.certifications;
  const key = cacheKey(moduleId, industry);

  if (session.research_cache[key]) {
    return session.research_cache[key];
  }

  const mod = getModule(moduleId);
  const queries = mod.searchQueries(industry, certifications);

  onStatusMessage(
    `Let me look up a few things about ${industry} ${mod.name.toLowerCase()} practices before we continue...`
  );

  // Collect search results by running a Claude call with web_search tool
  let searchContent = "";
  try {
    searchContent = await performWebSearch(queries, client);
  } catch {
    // If web search fails, proceed with empty findings
    searchContent = `No search results available for ${industry} ${mod.name}.`;
  }

  // Synthesise findings
  const synthesisPrompt = `You researched ERP requirements for "${industry}" manufacturers, specifically for the "${mod.name}" module.

Search results:
${searchContent}

Extract and structure the findings as a JSON object with these fields:
- findings_summary: string (1-2 paragraph synthesis of what you found)
- industry_specific_requirements: string[] (list of requirements that are standard/common for this industry)
- industry_specific_questions: string[] (2-3 extra questions to add to the standard module interview, specific to this industry)
- gaps_vs_standard_questions: string[] (things the standard questions might miss for this industry)

Output ONLY valid JSON.`;

  const synthesisResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: RESEARCH_SYSTEM,
    messages: [{ role: "user", content: synthesisPrompt }],
  });

  const text =
    synthesisResponse.content[0]?.type === "text"
      ? synthesisResponse.content[0].text
      : "{}";

  let findings: Partial<ResearchResult> = {};
  try {
    findings = JSON.parse(text) as Partial<ResearchResult>;
  } catch {
    findings = {
      findings_summary: searchContent.slice(0, 500),
      industry_specific_requirements: [],
      industry_specific_questions: [],
      gaps_vs_standard_questions: [],
    };
  }

  const result: ResearchResult = {
    module_id: moduleId,
    industry,
    run_at: new Date().toISOString(),
    search_queries: queries,
    findings_summary: findings.findings_summary ?? "",
    industry_specific_requirements: findings.industry_specific_requirements ?? [],
    industry_specific_questions: findings.industry_specific_questions ?? [],
    gaps_vs_standard_questions: findings.gaps_vs_standard_questions ?? [],
  };

  session.research_cache[key] = result;
  saveSession(session);
  return result;
}

/**
 * Phase 4: Cross-Cutting Gap Analysis.
 * Reviews all module responses and research results together to find gaps.
 * Asks the customer gap questions and records answers.
 */
export async function runGapAnalysis(
  session: InterviewSession,
  client: Anthropic,
  onMessage: (role: "assistant" | "user", content: string) => Promise<string>
): Promise<InterviewSession> {
  const intake = session.intake!;
  const moduleResponseSummary = Object.entries(session.module_responses)
    .map(([id, r]) => `Module ${id}: ${JSON.stringify(r.extracted_data)}`)
    .join("\n");

  const researchSummary = Object.values(session.research_cache)
    .map(
      (r) =>
        `Module ${r.module_id} (${r.industry}): ${r.industry_specific_requirements.join(", ")}`
    )
    .join("\n");

  const gapPrompt = `You have just finished interviewing ${intake.company_name}, a ${intake.industry_display} manufacturer.

Full session summary:
${JSON.stringify(intake, null, 2)}

Module responses collected:
${moduleResponseSummary}

Industry research findings:
${researchSummary}

Based on everything collected: identify any important workflows, data entities, or features that are standard for ${intake.industry_display} manufacturers of this type but were NOT captured in any module.

Generate 2-5 targeted gap questions. These should only cover genuinely missing areas — do not re-ask things already covered.

Return as JSON:
{
  "gap_questions": ["Question 1?", "Question 2?", ...]
}

Output ONLY valid JSON.`;

  const gapResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: RESEARCH_SYSTEM,
    messages: [{ role: "user", content: gapPrompt }],
  });

  const gapText =
    gapResponse.content[0]?.type === "text" ? gapResponse.content[0].text : "{}";

  let gapQuestions: string[] = [];
  try {
    const parsed = JSON.parse(gapText) as { gap_questions: string[] };
    gapQuestions = parsed.gap_questions ?? [];
  } catch {
    gapQuestions = [];
  }

  const gapResponses: Array<{ question: string; answer: string }> = [];

  if (gapQuestions.length > 0) {
    const bridge = await onMessage(
      "assistant",
      `I have a few more questions based on what we've covered — just want to make sure we haven't missed anything important for ${intake.company_name}.`
    );
    session.messages.push({
      role: "assistant",
      content: `I have a few more questions based on what we've covered — just want to make sure we haven't missed anything important for ${intake.company_name}.`,
    });
    session.messages.push({ role: "user", content: bridge });

    for (const question of gapQuestions) {
      const answer = await onMessage("assistant", question);
      session.messages.push({ role: "assistant", content: question });
      session.messages.push({ role: "user", content: answer });
      gapResponses.push({ question, answer });
      saveSession(session);
    }
  }

  session.gap_analysis = {
    run_at: new Date().toISOString(),
    gap_questions: gapQuestions,
    gap_responses: gapResponses,
  };

  session.current_phase = "review";
  saveSession(session);
  return session;
}

/**
 * Runs web searches using Claude's built-in web_search tool.
 * Returns concatenated search result text.
 */
async function performWebSearch(
  queries: string[],
  client: Anthropic
): Promise<string> {
  const results: string[] = [];

  for (const query of queries.slice(0, 3)) {
    // cap at 3 searches per module
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        tools: [{ type: "web_search_20250305" as "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Search for: ${query}. Summarize the key findings relevant to ERP software requirements for manufacturers.`,
          },
        ],
      });

      // Handle tool_use loop
      let currentResponse = response;
      const searchMessages: Message[] = [
        {
          role: "user",
          content: `Search for: ${query}. Summarize the key findings relevant to ERP software requirements for manufacturers.`,
        },
      ];

      while (currentResponse.stop_reason === "tool_use") {
        const toolUseBlocks = currentResponse.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        // For built-in web_search tool, Claude handles execution internally.
        // We just need to continue the conversation with a tool_result placeholder.
        searchMessages.push({
          role: "assistant",
          content: currentResponse.content,
        } as Message);

        const toolResults = toolUseBlocks.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: "Search executed by the API.",
        }));

        searchMessages.push({
          role: "user",
          content: toolResults,
        } as Message);

        currentResponse = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          tools: [{ type: "web_search_20250305" as "web_search_20250305", name: "web_search" }],
          messages: searchMessages as Anthropic.MessageParam[],
        });
      }

      // Extract text from final response
      const text = currentResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      if (text) results.push(`Query: ${query}\n${text}`);
    } catch {
      // Search failed for this query — skip it
    }
  }

  return results.join("\n\n---\n\n");
}
