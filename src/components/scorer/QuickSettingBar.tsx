import { useMemo, useState } from "react";
import {
  type Team,
  type Player,
  type SettingQuality,
  type SettingAttackZone,
  SETTING_QUALITIES,
  SETTING_QUALITY_LABEL,
  SETTING_ATTACK_ZONES,
  SETTING_ATTACK_ZONE_LABEL,
} from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { ChevronDown, X } from "lucide-react";

interface Props {
  team: Team;
  /** Ids de las 6 jugadoras en cancha (orden de rotación). */
  onCourt: string[];
  /** Si la última recepción se cargó, su calidad llega acá para enlazarla al evento. */
  receptionQuality?: SettingQuality;
  onSubmit: (payload: {
    setterId: string;
    quality: SettingQuality;
    attackZone: SettingAttackZone;
    receptionQuality?: SettingQuality;
  }) => void;
  onSkip: () => void;
}

/**
 * Barra rápida de scouting (modo Entrenador) optimizada para tablet.
 * Flujo: armadora pre-cargada (titular) → zona en cancha → calidad → submit auto.
 * Sin modales encadenados. Máx 2 toques tras la recepción.
 */
export function QuickSettingBar({ team, onCourt, receptionQuality, onSubmit, onSkip }: Props) {
  const playersOnCourt: Player[] = useMemo(
    () =>
      onCourt
        .map((id) => team.players.find((p) => p.id === id))
        .filter((p): p is Player => !!p),
    [onCourt, team.players]
  );

  // Default: jugadora con posición "armador" en cancha.
  const defaultSetter = useMemo(
    () => playersOnCourt.find((p) => p.position === "armador") ?? playersOnCourt[0],
    [playersOnCourt]
  );

  const [setterId, setSetterId] = useState<string>(defaultSetter?.id ?? "");
  const [zone, setZone] = useState<SettingAttackZone | null>(null);
  const [pickingSetter, setPickingSetter] = useState(false);

  const setter = playersOnCourt.find((p) => p.id === setterId) ?? defaultSetter;

  const handleConfirm = () => {
    if (!setterId || !zone) return;
    // Calidad del armado desactivada — se envía neutro por defecto.
    onSubmit({ setterId, quality: "!", attackZone: zone, receptionQuality });
  };


  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card/95 backdrop-blur shadow-xl p-3 md:p-4 space-y-3">
      {/* Header: armadora + skip */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setPickingSetter((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-muted/50 hover:bg-muted px-3 py-1.5 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Armó</span>
          <span
            className="scoreboard-digit text-lg font-black px-2 rounded text-white"
            style={{ background: team.color }}
          >
            #{setter?.number ?? "?"}
          </span>
          <span className="text-sm font-semibold truncate max-w-[100px]">{setter?.name ?? "—"}</span>
          <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${pickingSetter ? "rotate-180" : ""}`} />
        </button>
        <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs gap-1">
          <X className="size-3.5" /> Saltar armado
        </Button>
      </div>

      {/* Picker armadora (colapsado por default) */}
      {pickingSetter && (
        <div className="grid grid-cols-6 gap-1.5">
          {playersOnCourt.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSetterId(p.id);
                setPickingSetter(false);
              }}
              className={`flex flex-col items-center justify-center rounded-lg border-2 py-2 transition-all ${
                p.id === setterId ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="scoreboard-digit text-base font-black">#{p.number}</span>
              <span className="text-[9px] text-muted-foreground truncate max-w-full px-1">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Zonas */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
          Zona del armado
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {SETTING_ATTACK_ZONES.map((z) => (
            <button
              key={z}
              onClick={() => setZone(z)}
              className={`h-12 md:h-14 rounded-lg border-2 font-bold text-sm transition-all ${
                zone === z
                  ? "border-primary bg-primary text-primary-foreground scale-[1.02]"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {SETTING_ATTACK_ZONE_LABEL[z]}
            </button>
          ))}
        </div>
      </div>

      {/* Calidad */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
          Calidad del armado {!zone && <span className="text-destructive">— elegí zona primero</span>}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {SETTING_QUALITIES.map((q) => {
            const tone =
              q === "++" || q === "+"
                ? "border-success/60 hover:bg-success/10 text-success"
                : q === "!"
                ? "border-border hover:bg-muted"
                : "border-destructive/60 hover:bg-destructive/10 text-destructive";
            return (
              <button
                key={q}
                onClick={() => handleQuality(q)}
                disabled={!zone}
                className={`h-14 md:h-16 rounded-lg border-2 bg-card transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${tone}`}
              >
                <span className="scoreboard-digit text-2xl font-black leading-none">{q}</span>
                <span className="text-[9px] font-semibold leading-none opacity-80">
                  {SETTING_QUALITY_LABEL[q]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
