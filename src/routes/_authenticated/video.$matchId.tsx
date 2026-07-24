import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/video/$matchId")({
  component: () => <Outlet />,
});
