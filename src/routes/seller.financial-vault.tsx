import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/seller/financial-vault")({
  component: () => <Outlet />,
});
