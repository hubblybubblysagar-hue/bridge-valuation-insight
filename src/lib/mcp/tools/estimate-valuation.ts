import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { computeValuation, fmtCurrency, INDUSTRIES } from "@/lib/valuation";
import type { Financials, RiskAnswers } from "@/lib/store";

const industryEnum = z.enum(INDUSTRIES.map((i) => i.value) as [string, ...string[]]);

export default defineTool({
  name: "estimate_valuation",
  title: "Estimate business valuation",
  description:
    "Estimate a small business valuation range (low/base/high) from annual financials, industry, and qualitative risk answers. Returns the SDE, multiples used, confidence, value drivers, concerns, upside levers, and likely buyer types. Guidance only — not a formal appraisal.",
  inputSchema: {
    industry: industryEnum.describe("Industry code. Use list_industry_multiples to see options."),
    financials: z
      .object({
        revenue: z.number().describe("Trailing 12 months revenue in USD."),
        netIncome: z.number().describe("Net income in USD."),
        ownerCompensation: z.number().describe("Owner salary/compensation add-back."),
        oneTimeExpenses: z.number().describe("Non-recurring expenses add-back."),
        personalAddbacks: z.number().describe("Personal expenses run through the business."),
        otherAddbacks: z.number().describe("Other justifiable add-backs."),
      })
      .describe("Annual financials in USD."),
    risk: z
      .object({
        revenueType: z.enum(["recurring", "repeat", "one-time", "mixed"]),
        customerConcentration: z
          .string()
          .describe("Top customer as % of revenue, e.g. '18'."),
        ownerRelationships: z.enum(["yes", "no"]),
        transitionSupport: z.enum(["yes", "no"]),
        keyEmployees: z.enum(["yes", "no", "unsure"]),
        bookQuality: z.enum(["very-clean", "clean", "somewhat-messy", "not-sure"]),
      })
      .describe("Qualitative risk answers."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ industry, financials, risk }) => {
    const v = computeValuation(
      industry,
      financials as Financials,
      risk as RiskAnswers,
    );
    const summary =
      `Valuation range: ${fmtCurrency(v.low)} – ${fmtCurrency(v.high)} ` +
      `(base ${fmtCurrency(v.base)}). SDE ${fmtCurrency(v.sde)} × ${v.multipleLow}–${v.multipleHigh}x. ` +
      `Confidence: ${v.confidence}.`;
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: v as unknown as Record<string, unknown>,
    };
  },
});
