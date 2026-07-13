import { defineTool } from "@lovable.dev/mcp-js";
import { INDUSTRIES } from "@/lib/valuation";

export default defineTool({
  name: "list_industry_multiples",
  title: "List industry multiples",
  description:
    "List the industry codes ExitBridge supports along with their baseline SDE multiples. Use this to pick a valid `industry` value for estimate_valuation.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: INDUSTRIES.map((i) => `${i.value} — ${i.label} (baseline ${i.multiple}x SDE)`).join("\n"),
      },
    ],
    structuredContent: { industries: INDUSTRIES },
  }),
});
