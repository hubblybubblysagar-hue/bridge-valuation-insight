import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/DemoStage";
import { SellerHome } from "@/routes/seller.index";

export const Route = createFileRoute("/demo/seller/start")({
  head: () => ({ meta: [{ title: "QA — Seller start" }] }),
  component: () => (
    <DemoStage stage="seller-start" label="QA Mode · Seller Start">
      <SellerHome />
    </DemoStage>
  ),
});
