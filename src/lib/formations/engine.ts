import type { Player } from "@/lib/volley-store";
import { FORMATIONS_5_1 } from "./5-1";
import { FORMATIONS_5_1_RECEPTION } from "./5-1-reception";
import type {
  FormationSlot,
  ReceptionFormation,
  Rotation,
  TacticalRole,
  TacticalSystem,
  TeamLineup,
} from "./types";

export type FormationPhase = "reception" | "attack";

export function getFormation(
  system: TacticalSystem,
  rotation: Rotation,
  phase: FormationPhase = "attack",
): ReceptionFormation {
  if (phase === "reception") return FORMATIONS_5_1_RECEPTION[rotation];
  return FORMATIONS_5_1[rotation];
}

/**
 * Deriva el lineup automáticamente desde los `Player.position`.
 * Si el equipo no tiene roles definidos cae en fallback razonable.
 */
export function inferLineupFromPlayers(players: Player[], onCourt: string[]): TeamLineup {
  const inCourt = onCourt.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];

  const setter = inCourt.find((p) => p.position === "armador");
  const opposite = inCourt.find((p) => p.position === "opuesto");
  const middles = inCourt.filter((p) => p.position === "central");
  const outsides = inCourt.filter((p) => p.position === "punta");
  const libero = inCourt.find((p) => p.position === "libero") ?? players.find((p) => p.position === "libero");

  return {
    setter: setter?.id,
    opposite: opposite?.id,
    middle1: middles[0]?.id,
    middle2: middles[1]?.id,
    outside1: outsides[0]?.id,
    outside2: outsides[1]?.id,
    libero: libero?.id,
    liberoReplaces: "middle2",
  };
}

/**
 * Calcula la rotación actual del 5-1: 1..6 según en qué posición de cancha
 * está parada la armadora.
 *
 * `onCourt` se indexa así: index 0 = pos 1 (zaguero derecho, server).
 * Rotación = posición de la armadora (no del primer servidor).
 */
export function getRotationFromCourt(onCourt: string[], setterId: string | undefined): Rotation | null {
  if (!setterId) return null;
  const idx = onCourt.indexOf(setterId);
  if (idx < 0) return null;
  return ((idx + 1) as Rotation);
}

/**
 * Resuelve la formación para un equipo: combina la plantilla del sistema
 * con el lineup, devolviendo cada slot con la jugadora real asignada.
 *
 * `customs` permite overrides por (rotación → role → {x,y}).
 */
export interface ResolvedSlot extends FormationSlot {
  role: TacticalRole;
  playerId: string | null;
}

export interface ResolvedFormation {
  formation: ReceptionFormation;
  rotation: Rotation;
  slots: ResolvedSlot[];
}

export function resolveFormation(opts: {
  system: TacticalSystem;
  rotation: Rotation;
  lineup: TeamLineup;
  phase?: FormationPhase;
  customs?: Partial<Record<Rotation, Partial<Record<TacticalRole, { x: number; y: number }>>>>;
  /** Si el líbero está en cancha reemplazando a una central, swap. */
  liberoOnCourt?: boolean;
}): ResolvedFormation {
  const { system, rotation, lineup, customs, liberoOnCourt = true, phase = "attack" } = opts;
  const formation = getFormation(system, rotation, phase);
  const override = customs?.[rotation] ?? {};

  // Mapeo rol → playerId.
  const roleToPlayer: Partial<Record<TacticalRole, string | undefined>> = {
    setter: lineup.setter,
    opposite: lineup.opposite,
    middle_front: lineup.middle1,
    middle_back: lineup.middle2,
    outside_front: lineup.outside1,
    outside_back: lineup.outside2,
    libero: lineup.libero,
  };

  // Si el líbero juega, reemplaza a la central correspondiente en el rol zaguero.
  if (liberoOnCourt && lineup.libero) {
    // Asumimos que el líbero reemplaza a middle_back en formación de recepción.
    roleToPlayer.middle_back = lineup.libero;
  }

  const slots: ResolvedSlot[] = formation.slots.map((s) => {
    const o = override[s.role];
    return {
      ...s,
      x: o?.x ?? s.x,
      y: o?.y ?? s.y,
      playerId: roleToPlayer[s.role] ?? null,
    };
  });

  return { formation, rotation, slots };
}
