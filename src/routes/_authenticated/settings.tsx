import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CloudDownload, Loader2, Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-auth";
import { forceReloadFromCloud } from "@/lib/cloud-sync";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Ajustes · RALLY" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useIsAdmin();
  const [loading, setLoading] = useState(false);

  const handleReload = async () => {
    if (!user) {
      toast.error("No hay sesión activa");
      return;
    }
    if (
      !confirm(
        "Esto descarta los datos locales y los reemplaza con los de la nube. ¿Continuar?",
      )
    )
      return;
    setLoading(true);
    try {
      const r = await forceReloadFromCloud(user.id);
      if (!r.ok) {
        toast.error("No hay datos en la nube todavía.");
        return;
      }
      toast.success(
        `Recargado: ${r.matches} partidos, ${r.teams} equipos, ${r.totalEvents} acciones.`,
      );
    } catch (e) {
      toast.error((e as Error).message ?? "Error al recargar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-6">
        <SettingsIcon className="size-5 text-primary" />
        <h1 className="text-xl font-bold tracking-tight">Ajustes</h1>
      </div>

      <div className="max-w-xl space-y-4">
        <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <CloudDownload className="size-4 text-primary" />
              Sincronización
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Si en este dispositivo no ves acciones que cargaste en otro lado
              (o se "borraron" al recargar), forzá la descarga desde la nube.
              Esto sobrescribe los datos locales con los del servidor.
            </p>
          </div>
          <Button
            onClick={() => void handleReload()}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudDownload className="size-4" />
            )}
            Forzar recarga desde la nube
          </Button>
        </section>

        {user?.email && (
          <p className="text-xs text-muted-foreground">
            Sesión: <span className="text-foreground">{user.email}</span>
          </p>
        )}
      </div>
    </AppShell>
  );
}
