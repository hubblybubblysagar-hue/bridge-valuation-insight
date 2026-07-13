import { useEffect, useState, type ReactNode } from "react";
import { QAModeBadge } from "./QAModeBadge";
import { seedDemoStage, type DemoStage as DemoStageId } from "@/lib/store";

export function DemoStage({
  stage,
  children,
  label,
}: {
  stage: DemoStageId;
  children: ReactNode;
  label?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    seedDemoStage(stage);
    setReady(true);
  }, [stage]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading QA demo state…
      </div>
    );
  }

  return (
    <>
      <QAModeBadge label={label} />
      {children}
    </>
  );
}
