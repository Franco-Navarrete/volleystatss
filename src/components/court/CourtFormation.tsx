import { useMemo } from "react";
import type { Team } from "@/lib/volley-store";
import { ROLE_COLOR, ROLE_LABEL, type TacticalRole } from "@/lib/formations/types";
import type { ResolvedFormation } from "@/lib/formations/engine";

interface Props {
  team: Team;
  formation: ResolvedFormation | null;
  /** Compacto: oculta leyenda. */
  compact?: boolean;
  /** Marca la zona objetivo de armado. */
  showSetterTarget?: boolean;
}

/**
 * Visualización de cancha (media) con la formación de recepción.
 * Cada jugadora pintada con el color de su rol táctico.
 */
export function CourtFormation({ team, formation, compact, showSetterTarget = true }: Props) {
  const playerById = useMemo(() => new Map(team.players.map((p) => [p.id, p])), [team.players]);

  if (!formation) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Asigná las posiciones (armadora / central / punta / opuesta / líbero) a las jugadoras del equipo
        para ver la formación de recepción automática.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground uppercase tracking-wider font-semibold">
            Rotación
          </span>
          <span className="scoreboard-digit text-lg font-black text-primary">
            {formation.rotation}
          </span>
          <span className="text-muted-foreground">· Sistema 5-1</span>
        </div>
        <div className="text-muted-foreground">
          Ataque:{" "}
          <span className="font-semibold text-foreground">
            {formation.formation.attackers.length}
          </span>
        </div>
      </div>

      {/* Cancha */}
      <div
        className="relative aspect-[3/2] w-full rounded-xl border-2 border-foreground/30 overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(135deg, oklch(0.72 0.09 60) 0 6px, oklch(0.68 0.1 55) 6px 12px)",
        }}
      >
        {/* Red */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white shadow" />
        {/* Línea de ataque (3m) */}
        <div className="absolute top-1/3 left-0 right-0 border-t-2 border-dashed border-white/70" />

        {/* Etiquetas zonas */}
        {[
          { label: "4", x: 12, y: 8 },
          { label: "3", x: 50, y: 8 },
          { label: "2", x: 88, y: 8 },
          { label: "5", x: 12, y: 92 },
          { label: "6", x: 50, y: 92 },
          { label: "1", x: 88, y: 92 },
        ].map((z) => (
          <div
            key={z.label}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-white/50 font-black text-lg pointer-events-none"
            style={{ left: `${z.x}%`, top: `${z.y}%` }}
          >
            {z.label}
          </div>
        ))}

        {/* Target armadora */}
        {showSetterTarget && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-white animate-pulse"
            style={{
              left: `${formation.formation.setterTarget.x}%`,
              top: `${formation.formation.setterTarget.y}%`,
              width: 36,
              height: 36,
            }}
            title="Zona de armado"
          />
        )}

        {/* Jugadoras */}
        {formation.slots.map((slot) => {
          const player = slot.playerId && 
            !slot.playerId.startsWith("fallback-") && 
            !slot.playerId.startsWith("empty-") &&
            !slot.playerId.startsWith("emergency-slot-")
            ? playerById.get(slot.playerId) 
            : null;
          const color = ROLE_COLOR[slot.role];
          return (
            <div
              key={slot.role}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <div
                className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg border-2 ${slot.role === "setter" ? "border-white ring-2 ring-amber-500/50" : "border-white"}`}
                style={{ background: color }}
              >
                {player ? `#${player.number}` : "?"}
              </div>
              <div className="mt-1 px-1 py-0.5 rounded bg-black/60 text-white text-[8px] font-bold uppercase tracking-wide whitespace-nowrap">
                {ROLE_LABEL[slot.role]}
              </div>
              {player && (
                <div className="text-[9px] font-semibold text-white drop-shadow-md max-w-[70px] truncate text-center">
                  {player.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          {(Object.keys(ROLE_LABEL) as TacticalRole[]).map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full border border-white/60"
                style={{ background: ROLE_COLOR[r] }}
              />
              <span className="text-muted-foreground">{ROLE_LABEL[r]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
