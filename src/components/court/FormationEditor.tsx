import { useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVolley } from "@/lib/volley-store";
import type { Team } from "@/lib/volley-store";
import {
  inferLineupFromPlayers,
  resolveFormation,
  type ResolvedSlot,
} from "@/lib/formations/engine";
import {
  ROLE_COLOR,
  ROLE_LABEL,
  type Rotation,
  type TacticalRole,
} from "@/lib/formations/types";

/**
 * Editor global de formaciones de recepción (por rotación 1..6).
 * Los slots se pueden arrastrar dentro de la cancha; al soltar se guardan
 * en el store (persistido + sincronizado a la nube) y se aplican a TODOS los
 * partidos/equipos.
 */
export function FormationEditor({ previewTeam }: { previewTeam?: Team | null }) {
  const customs = useVolley((s) => s.customReceptionFormations);
  const setSlot = useVolley((s) => s.setReceptionSlot);
  const resetRot = useVolley((s) => s.resetReceptionRotation);
  const resetAll = useVolley((s) => s.resetAllReceptionFormations);
  const [rotation, setRotation] = useState<Rotation>(1);
  const courtRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<TacticalRole | null>(null);

  const { slots } = useMemo(() => {
    // Lineup dummy con IDs sintéticos para que se dibujen las 6 posiciones.
    const dummyLineup = {
      setter: "A",
      opposite: "O",
      middle1: "M1",
      middle2: "M2",
      outside1: "P1",
      outside2: "P2",
      libero: "L",
      liberoReplaces: "middle2" as const,
    };
    const onCourt = ["A", "P1", "M1", "O", "P2", "M2"];
    const resolved = resolveFormation({
      system: "5-1",
      rotation,
      lineup: dummyLineup,
      phase: "reception",
      customs,
      liberoOnCourt: true,
      onCourt,
    });
    return { slots: resolved.slots };
  }, [rotation, customs]);

  const previewPlayers = useMemo(() => {
    if (!previewTeam) return {} as Partial<Record<TacticalRole, string>>;
    const setter = previewTeam.players.find((p) => p.position === "armador");
    const opposite = previewTeam.players.find((p) => p.position === "opuesto");
    const middles = previewTeam.players.filter((p) => p.position === "central");
    const outsides = previewTeam.players.filter((p) => p.position === "punta");
    const libero = previewTeam.players.find((p) => p.position === "libero");
    return {
      setter: setter ? `#${setter.number}` : undefined,
      opposite: opposite ? `#${opposite.number}` : undefined,
      middle_front: middles[0] ? `#${middles[0].number}` : undefined,
      middle_back: middles[1] ? `#${middles[1].number}` : undefined,
      outside_front: outsides[0] ? `#${outsides[0].number}` : undefined,
      outside_back: outsides[1] ? `#${outsides[1].number}` : undefined,
      libero: libero ? `#${libero.number}` : undefined,
    } as Partial<Record<TacticalRole, string>>;
  }, [previewTeam]);

  const beginDrag = (role: TacticalRole) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(role);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!dragging || !courtRef.current) return;
    const rect = courtRef.current.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
    setSlot(rotation, dragging, { x, y });
  };

  const endDrag = () => setDragging(null);

  const hasOverride = !!customs?.[rotation] && Object.keys(customs[rotation]!).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setRotation((r) => ((r === 1 ? 6 : r - 1) as Rotation))}
            aria-label="Rotación anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-sm font-semibold">Rotación</div>
          <div className="scoreboard-digit text-2xl font-black text-primary tabular-nums w-8 text-center">
            {rotation}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setRotation((r) => ((r === 6 ? 1 : r + 1) as Rotation))}
            aria-label="Rotación siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => resetRot(rotation)}
            disabled={!hasOverride}
            title="Restaurar esta rotación"
          >
            <RotateCcw className="size-3.5 mr-1" />
            <span className="text-xs">Rotación</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("¿Restaurar TODAS las rotaciones a la formación por defecto?")) {
                resetAll();
              }
            }}
            title="Restaurar todas"
          >
            <Trash2 className="size-3.5 mr-1" />
            <span className="text-xs">Todas</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {([1, 2, 3, 4, 5, 6] as Rotation[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRotation(r)}
            className={
              "text-xs font-bold px-2.5 py-1 rounded border transition-colors " +
              (r === rotation
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border/60 hover:border-primary/60") +
              (customs?.[r] ? " ring-2 ring-primary/40" : "")
            }
          >
            {r}
          </button>
        ))}
      </div>

      <div
        ref={courtRef}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative aspect-[3/2] w-full rounded-xl border-2 border-foreground/30 overflow-hidden touch-none select-none"
        style={{
          background:
            "repeating-linear-gradient(135deg, oklch(0.72 0.09 60) 0 12px, oklch(0.68 0.1 55) 12px 24px)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white shadow" />
        <div className="absolute top-1/3 left-0 right-0 border-t-2 border-dashed border-white/70" />

        {slots.map((slot: ResolvedSlot) => {
          const color = ROLE_COLOR[slot.role];
          const label = previewPlayers[slot.role] ?? "?";
          const active = dragging === slot.role;
          return (
            <div
              key={slot.role}
              onPointerDown={beginDrag(slot.role)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                zIndex: active ? 30 : 10,
              }}
            >
              <div
                className={
                  "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-black text-sm shadow-lg border-2 border-white " +
                  (active ? "scale-110 ring-4 ring-white/60" : "")
                }
                style={{ background: color }}
              >
                {label}
              </div>
              <div className="mt-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                {ROLE_LABEL[slot.role]}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-tight">
        Arrastrá cada jugadora a la zona deseada. Los cambios se guardan
        automáticamente y se aplican a todos los equipos y partidos. Las
        rotaciones con posiciones personalizadas quedan marcadas con un anillo.
      </p>
    </div>
  );
}
