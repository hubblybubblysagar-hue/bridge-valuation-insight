import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/DemoStage";
import { ConnectPage } from "@/routes/seller.connect";

export const Route = createFileRoute("/demo/seller/quickbooks-connected")({
  head: () => ({ meta: [{ title: "QA — QuickBooks connected" }] }),
  component: () => (
    <DemoStage stage="seller-qb-connected" label="QA Mode · QuickBooks Connected">
      <ConnectPage />
    </DemoStage>
  ),
});
