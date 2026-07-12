// Deterministic defense-in-depth for the extraction pipeline. The system
// prompt in extractSuggestions.ts already instructs Claude not to surface
// secrets/credentials/PII, but instruction-following isn't a guarantee —
// this scrubs common high-confidence patterns from every string field
// before a suggestion ever reaches the database or a reviewer's screen.
// Not a full DLP system, just a basic net for the clearest cases.

const PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g, // Anthropic API key
  /sk-[A-Za-z0-9]{20,}/g, // generic OpenAI-style key
  /AKIA[0-9A-Z]{16}/g, // AWS access key id
  /\b(?:password|pwd|secret|api[\s_-]?key|access[\s_-]?token)\s*(?:is|:|=)\s*\S+/gi, // "password is X" style phrases
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like
  /\b(?:\d[ -]?){13,19}\d\b/g, // credit-card-like digit runs
];

export function redactText(text: string): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, () => {
      count++;
      return "[redacted]";
    });
  }
  return { text: out, count };
}

// Redacts every string-valued field on an extracted suggestion (payload
// shape varies by suggestion type — see lib/claude/extractSuggestions.ts —
// so this stays generic rather than enumerating each type's fields).
export function redactSuggestion<T extends Record<string, unknown>>(suggestion: T): { suggestion: T; count: number } {
  let total = 0;
  const out: Record<string, unknown> = { ...suggestion };
  for (const [key, value] of Object.entries(suggestion)) {
    if (typeof value === "string") {
      const { text, count } = redactText(value);
      out[key] = text;
      total += count;
    }
  }
  return { suggestion: out as T, count: total };
}
