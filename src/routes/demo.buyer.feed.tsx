import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/DemoStage";
import { BuyerFeed } from "@/routes/buyer.index";

export const Route = createFileRoute("/demo/buyer/feed")({
  head: () => ({ meta: [{ title: "QA — Buyer feed" }] }),
  component: () => (
    <DemoStage stage="buyer-feed" label="QA Mode · Buyer Feed">
      <BuyerFeed />
    </DemoStage>
  ),
});
