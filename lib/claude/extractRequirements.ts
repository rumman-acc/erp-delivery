import Anthropic from "@anthropic-ai/sdk";

// plan-agentic.md §5 step 4 — transcript in, candidate requirements out.
// The transcript text is never persisted; the caller holds it in memory for
// exactly this one call and discards it afterward (plan-agentic.md §6/§10 step 6).

export type ExtractedRequirement = {
  description: string;
  type: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  supportingQuote: string;
  confidence: "high" | "medium" | "low";
};

const SCHEMA = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "A single, concrete project requirement discussed in the meeting.",
          },
          type: {
            type: "string",
            enum: ["Functional", "Non-Functional", "Integration", "Reporting", "Data", "Other"],
          },
          priority: {
            type: "string",
            enum: ["Critical", "High", "Medium", "Low"],
            description: "Best guess based on how the speakers discussed urgency/importance.",
          },
          supporting_quote: {
            type: "string",
            description: "The exact transcript excerpt this requirement was derived from.",
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "How confident you are this is a real, actionable requirement (not small talk or a tangent).",
          },
        },
        required: ["description", "type", "priority", "supporting_quote", "confidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["requirements"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You extract candidate project requirements from ERP implementation meeting transcripts.

Only extract concrete, actionable requirements a business analyst would log against a project's Scope & BPM tracker — not decisions, action items, or general discussion. If a requirement is only vaguely implied, still extract it but mark confidence "low". A transcript with no real requirements should return an empty list — do not invent items to fill space.

Every extracted item's supporting_quote must be copied verbatim from the transcript.`;

export async function extractRequirements(transcript: string): Promise<ExtractedRequirement[]> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Meeting transcript (VTT format):\n\n${transcript}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: SCHEMA },
    },
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return [];

  const parsed = JSON.parse(block.text) as { requirements: Array<Record<string, string>> };
  return parsed.requirements.map((r) => ({
    description: r.description,
    type: r.type,
    priority: r.priority as ExtractedRequirement["priority"],
    supportingQuote: r.supporting_quote,
    confidence: r.confidence as ExtractedRequirement["confidence"],
  }));
}
