import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  CloudDownload,
  Loader2,
  Monitor,
  Plus,
  Settings as SettingsIcon,
  Smartphone,
  Tablet,
  Trash2,
  Wand2,
  Users,
  Tag,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-auth";
import { forceReloadFromCloud } from "@/lib/cloud-sync";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import { cn } from "@/lib/utils";
import { FormationEditor } from "@/components/court/FormationEditor";
import { CoachModeSettings } from "@/components/coach/CoachModeSettings";
import { useCoachAccess } from "@/hooks/use-coach-access";
import { useVolley } from "@/lib/volley-store";


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
  const { hasAccess: coachAccess } = useCoachAccess();
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

        {coachAccess && <CoachModeSettings />}

        <OfficialListsSection />






        {user?.email && (
          <p className="text-xs text-muted-foreground">
            Sesión: <span className="text-foreground">{user.email}</span>
          </p>
        )}
      </div>
    </AppShell>
  );
}

function OfficialListsSection() {
  const matchCategories = useVolley((s) => s.matchCategories);
  const referees = useVolley((s) => s.referees);
  const scorekeepers = useVolley((s) => s.scorekeepers);
  const addMatchCategory = useVolley((s) => s.addMatchCategory);
  const removeMatchCategory = useVolley((s) => s.removeMatchCategory);
  const addReferee = useVolley((s) => s.addReferee);
  const removeReferee = useVolley((s) => s.removeReferee);
  const addScorekeeper = useVolley((s) => s.addScorekeeper);
  const removeScorekeeper = useVolley((s) => s.removeScorekeeper);

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Tag className="size-4 text-primary" />
          Información oficial del partido
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Categorías, árbitros y planilleros disponibles al crear un partido.
          También se agregan automáticamente cuando se escribe un nombre nuevo.
        </p>
      </div>
      <ListEditor
        title="Categorías"
        icon={<Tag className="size-3.5" />}
        items={matchCategories}
        onAdd={addMatchCategory}
        onRemove={removeMatchCategory}
        placeholder="Ej: Sub 18 · Femenino"
      />
      <ListEditor
        title="Árbitros"
        icon={<Users className="size-3.5" />}
        items={referees}
        onAdd={addReferee}
        onRemove={removeReferee}
        placeholder="Nombre y apellido"
      />
      <ListEditor
        title="Planilleros"
        icon={<Users className="size-3.5" />}
        items={scorekeepers}
        onAdd={addScorekeeper}
        onRemove={removeScorekeeper}
        placeholder="Nombre y apellido"
      />
    </section>
  );
}

function ListEditor({
  title, icon, items, onAdd, onRemove, placeholder,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground font-bold">
        {icon}
        {title}
        <span className="text-muted-foreground/60 normal-case tracking-normal font-normal">({items.length})</span>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder}
          className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm"
        />
        <Button type="button" size="sm" variant="secondary" onClick={submit}>
          <Plus className="size-3.5" /> Agregar
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin registros.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <li
              key={it}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 border border-border/60 pl-2 pr-1 py-1 text-xs"
            >
              <span>{it}</span>
              <button
                type="button"
                onClick={() => onRemove(it)}
                className="text-muted-foreground hover:text-destructive p-0.5 rounded"
                title={`Quitar ${it}`}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

