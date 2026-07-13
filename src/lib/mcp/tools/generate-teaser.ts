import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fmtCurrency } from "@/lib/valuation";

export default defineTool({
  name: "generate_teaser",
  title: "Generate anonymous buyer teaser",
  description:
    "Draft an anonymous, buyer-ready teaser for a small business. No identifying details (name, address, brand) are included — output uses generalized region and industry only. Returns markdown suitable for private buyer outreach.",
  inputSchema: {
    industryLabel: z.string().describe("Human-readable industry (e.g. 'HVAC')."),
    region: z.string().describe("Generalized region (e.g. 'Southeast US')."),
    yearsInBusiness: z.number().int().nonnegative(),
    revenue: z.number().describe("Annual revenue in USD."),
    sde: z.number().describe("Seller's Discretionary Earnings in USD."),
    valuationLow: z.number(),
    valuationHigh: z.number(),
    highlights: z
      .array(z.string())
      .describe("3–6 short bullet highlights (recurring revenue, team, contracts, etc.)."),
    reasonForSale: z.string().describe("Anonymous rationale (e.g. 'Owner retirement')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const md =
      `# Confidential Business Opportunity\n\n` +
      `**Industry:** ${input.industryLabel}\n` +
      `**Region:** ${input.region}\n` +
      `**Established:** ${input.yearsInBusiness}+ years in operation\n\n` +
      `## Financial Snapshot\n` +
      `- Annual Revenue: ${fmtCurrency(input.revenue)}\n` +
      `- Adjusted Earnings (SDE): ${fmtCurrency(input.sde)}\n` +
      `- Indicative Valuation: ${fmtCurrency(input.valuationLow)} – ${fmtCurrency(input.valuationHigh)}\n\n` +
      `## Highlights\n` +
      input.highlights.map((h) => `- ${h}`).join("\n") +
      `\n\n## Reason for Sale\n${input.reasonForSale}\n\n` +
      `## Next Steps\nQualified buyers can request additional information under NDA through ExitBridge. ` +
      `Identifying details are withheld to protect confidentiality.\n`;
    return {
      content: [{ type: "text", text: md }],
      structuredContent: { teaserMarkdown: md },
    };
  },
});
