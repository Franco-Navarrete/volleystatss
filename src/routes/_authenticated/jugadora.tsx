import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta anterior del panel de jugadora: se mantiene para enlaces viejos.
export const Route = createFileRoute("/_authenticated/jugadora")({
  validateSearch: (s: Record<string, unknown>): { denied?: 1 } => (s.denied ? { denied: 1 } : {}),
  beforeLoad: ({ search }) => { throw redirect({ to: "/player/dashboard", search, replace: true }); },
});
