import { createFileRoute } from "@tanstack/react-router";
import { PreparationView } from "@/components/session/PreparationView";

export const Route = createFileRoute("/_authenticated/session/new")({
  head: () => ({ meta: [{ title: "Nueva sesión · RALLY" }] }),
  component: PreparationView,
});
