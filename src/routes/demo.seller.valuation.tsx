import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/DemoStage";
import { ValuationPage } from "@/routes/seller.valuation";

export const Route = createFileRoute("/demo/seller/valuation")({
  head: () => ({ meta: [{ title: "QA — Valuation" }] }),
  component: () => (
    <DemoStage stage="seller-valuation" label="QA Mode · Valuation">
      <ValuationPage />
    </DemoStage>
  ),
});
