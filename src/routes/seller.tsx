import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/seller")({
  component: () => <Outlet />,
});
