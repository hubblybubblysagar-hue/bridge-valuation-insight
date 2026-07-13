import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/DemoStage";
import { TeaserPage } from "@/routes/seller.teaser";

export const Route = createFileRoute("/demo/seller/teaser")({
  head: () => ({ meta: [{ title: "QA — Teaser" }] }),
  component: () => (
    <DemoStage stage="seller-teaser" label="QA Mode · Anonymous Teaser">
      <TeaserPage />
    </DemoStage>
  ),
});
