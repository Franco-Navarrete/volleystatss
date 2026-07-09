import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  CloudDownload,
  Loader2,
  Monitor,
  Settings as SettingsIcon,
  Smartphone,
  Tablet,
  Wand2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-auth";
import { forceReloadFromCloud } from "@/lib/cloud-sync";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import { cn } from "@/lib/utils";
import { FormationEditor } from "@/components/court/FormationEditor";


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Ajustes · RALLY" }] }),
  component: SettingsPage,
});

const DEVICE_OPTIONS: {
  value: DeviceMode;
  label: string;
  desc: string;
  Icon: typeof Monitor;
}[] = [
  { value: "auto", label: "Automático", desc: "Detectar según el dispositivo", Icon: Wand2 },
  { value: "mobile", label: "Móvil", desc: "Layout compacto para teléfonos", Icon: Smartphone },
  { value: "tablet", label: "Tablet", desc: "Optimizado para 1920×1200", Icon: Tablet },
  { value: "desktop", label: "Escritorio", desc: "Layout ancho para PC", Icon: Monitor },
];

function SettingsPage() {
  const { user } = useIsAdmin();
  const [loading, setLoading] = useState(false);
  const { mode, setMode } = useDeviceMode();

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

  const handleDeviceChange = (m: DeviceMode) => {
    setMode(m);
    toast.success(
      m === "auto"
        ? "Detección automática activada"
        : `Vista fijada en ${DEVICE_OPTIONS.find((o) => o.value === m)?.label}`,
    );
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
              <Monitor className="size-4 text-primary" />
              Dispositivo
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Elegí cómo se adapta la interfaz. En <b>Automático</b> se detecta
              según tu pantalla; en modo manual se fuerza el layout del
              dispositivo elegido.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEVICE_OPTIONS.map(({ value, label, desc, Icon }) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleDeviceChange(value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/40 hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {desc}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

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

        <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-sm">Formación de recepción</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Ajustá manualmente la posición de cada jugadora por rotación. Se
              aplica a todos los equipos y partidos.
            </p>
          </div>
          <FormationEditor />
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
