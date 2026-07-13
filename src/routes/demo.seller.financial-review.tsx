import { createFileRoute } from "@tanstack/react-router";
import { DemoStage } from "@/components/DemoStage";
import { ReviewPage } from "@/routes/seller.financial-review";

export const Route = createFileRoute("/demo/seller/financial-review")({
  head: () => ({ meta: [{ title: "QA — Financial review" }] }),
  component: () => (
    <DemoStage stage="seller-financial-review" label="QA Mode · Financial Review">
      <ReviewPage />
    </DemoStage>
  ),
});
