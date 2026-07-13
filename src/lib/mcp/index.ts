import { defineMcp } from "@lovable.dev/mcp-js";
import estimateValuation from "./tools/estimate-valuation";
import listIndustryMultiples from "./tools/list-industry-multiples";
import generateTeaser from "./tools/generate-teaser";

export default defineMcp({
  name: "exitbridge-mcp",
  title: "ExitBridge MCP",
  version: "0.1.0",
  instructions:
    "ExitBridge tools for small business owners exploring an exit. Use list_industry_multiples to see supported industries, estimate_valuation to compute an indicative valuation range from financials and risk answers, and generate_teaser to draft an anonymous buyer-ready teaser. Guidance only — not a formal appraisal, legal, or brokerage advice.",
  tools: [estimateValuation, listIndustryMultiples, generateTeaser],
});
