import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/DemoStage";
import { BuyerInterestPage } from "@/routes/seller.buyer-interest";

export const Route = createFileRoute("/demo/seller/buyer-interest")({
  head: () => ({ meta: [{ title: "QA — Buyer interest" }] }),
  component: () => (
    <DemoStage stage="seller-buyer-interest" label="QA Mode · Buyer Interest">
      <BuyerInterestPage />
    </DemoStage>
  ),
});
