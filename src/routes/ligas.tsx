import { createFileRoute, Outlet } from "@tanstack/react-router";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/ligas")({
  head: () => ({
    meta: [
      { title: "Ligas · RALLY" },
      {
        name: "description",
        content: "Ligas de vóley activas con tablas, fixture y estadísticas.",
      },
      { property: "og:title", content: "Ligas · RALLY" },
      { property: "og:url", content: `${SITE_URL}/ligas` },
    ],
  }),
  component: () => <Outlet />,
});
