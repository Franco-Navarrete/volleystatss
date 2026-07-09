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

/**
 * Las plantillas de recepción/ataque están indexadas internamente por la
 * posición de cancha del armador (1..6). El label de "rotación" que ve el
 * usuario sigue otra convención: armador en P2 → Rot 1, P1 → Rot 2,
 * P6 → Rot 3, P5 → Rot 4, P4 → Rot 5, P3 → Rot 6.
 */
function rotationToSetterPos(rotation: Rotation): Rotation {
  return (((8 - rotation) % 6) + 1) as Rotation;
}

export function getFormation(
  system: TacticalSystem,
  rotation: Rotation,
  phase: FormationPhase = "attack",
): ReceptionFormation {
  const key = rotationToSetterPos(rotation);
  if (phase === "reception") return FORMATIONS_5_1_RECEPTION[key];
  return FORMATIONS_5_1[key];
}

/**
 * Deriva el lineup automáticamente desde los `Player.position`.
 * Si el equipo no tiene roles definidos cae en fallback razonable.
 */
export function inferLineupFromPlayers(
  players: Player[],
  onCourt: string[],
  designatedLiberoIds: string[] = [],
): TeamLineup {
  const inCourt = onCourt.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const designated = new Set(designatedLiberoIds);
  const libero =
    inCourt.find((p) => designated.has(p.id)) ??
    (designated.size === 0 ? inCourt.find((p) => p.position === "libero") : undefined);
  const tacticalPlayers = libero ? inCourt.filter((p) => p.id !== libero.id) : inCourt;

  const setter = tacticalPlayers.find((p) => p.position === "armador");
  const opposite = tacticalPlayers.find((p) => p.position === "opuesto");
  const middles = tacticalPlayers.filter((p) => p.position === "central");
  const outsides = tacticalPlayers.filter((p) => p.position === "punta");

  const lineup: TeamLineup = {
    setter: setter?.id,
    opposite: opposite?.id,
    middle1: middles[0]?.id,
    middle2: middles[1]?.id,
    outside1: outsides[0]?.id,
    outside2: outsides[1]?.id,
    libero: libero?.id,
    liberoReplaces: "middle2",
  };

  // Fallback: si el equipo no tiene todas las posiciones tácticas asignadas
  // (o duplica algunas), rellenamos los roles vacíos con las jugadoras que
  // están en cancha pero aún sin rol. Así siempre se dibujan las 6 en cancha.
  const assigned = new Set(
    [
      lineup.setter,
      lineup.opposite,
      lineup.middle1,
      lineup.middle2,
      lineup.outside1,
      lineup.outside2,
    ].filter(Boolean) as string[],
  );
  const remaining = tacticalPlayers.filter((p) => !assigned.has(p.id));
  const roleKeys: Array<
    "setter" | "opposite" | "outside1" | "outside2" | "middle1" | "middle2"
  > = ["setter", "opposite", "outside1", "outside2", "middle1", "middle2"];
  for (const k of roleKeys) {
    if (!lineup[k] && remaining.length > 0) {
      lineup[k] = remaining.shift()!.id;
    }
  }

  return lineup;
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
  // onCourt: idx 0 = P1, idx 1 = P2, ... idx 5 = P6.
  // Convención: armador en P2 → Rot 1, P1 → Rot 2, P6 → Rot 3, P5 → Rot 4,
  // P4 → Rot 5, P3 → Rot 6.
  const setterPos = idx + 1;
  const rotation = ((2 - setterPos + 6) % 6) + 1;
  return rotation as Rotation;
}

/**
 * Posiciones oficiales de rotación de la cancha:
 *   Red
 *     4 | 3 | 2
 *     5 | 6 | 1
 *   Fondo
 * Delanteras = {2, 3, 4}. Zagueras = {1, 5, 6}.
 */
export type RotationPosition = 1 | 2 | 3 | 4 | 5 | 6;

const FRONT_ROW_POSITIONS: ReadonlySet<RotationPosition> = new Set([2, 3, 4]);

export function isFrontRowPosition(pos: RotationPosition): boolean {
  return FRONT_ROW_POSITIONS.has(pos);
}

/**
 * Devuelve la posición oficial de rotación (1..6) de una jugadora en cancha.
 * `onCourt` se indexa así: index 0 = pos 1 (zaguera derecha, sacadora actual).
 */
export function getRotationPosition(onCourt: string[], playerId: string): RotationPosition | null {
  const idx = onCourt.indexOf(playerId);
  if (idx < 0) return null;
  return ((idx + 1) as RotationPosition);
}

export interface PlayerRotationInfo {
  rotationPosition: RotationPosition;
  isFrontRow: boolean;
  isBackRow: boolean;
}

/**
 * Devuelve `{ rotationPosition, isFrontRow, isBackRow }` de una jugadora dada
 * la disposición actual en cancha.
 */
export function getPlayerRotationInfo(onCourt: string[], playerId: string): PlayerRotationInfo | null {
  const pos = getRotationPosition(onCourt, playerId);
  if (!pos) return null;
  const front = isFrontRowPosition(pos);
  return { rotationPosition: pos, isFrontRow: front, isBackRow: !front };
}

/**
 * Resuelve la formación para un equipo: combina la plantilla del sistema
 * con el lineup, devolviendo cada slot con la jugadora real asignada y los
 * flags oficiales de rotación (`rotationPosition` / `isFrontRow` / `isBackRow`).
 *
 * `customs` permite overrides por (rotación → role → {x,y}).
 */
export interface ResolvedSlot extends FormationSlot {
  role: TacticalRole;
  playerId: string | null;
  /** Posición oficial de rotación (1..6) o null si la jugadora no está en cancha. */
  rotationPosition: RotationPosition | null;
  /** True si la jugadora está en zonas 2/3/4 (puede bloquear y atacar de cualquier punto). */
  isFrontRow: boolean;
  /** True si la jugadora está en zonas 1/5/6 (no puede bloquear ni atacar por delante de 3m). */
  isBackRow: boolean;
}

export interface ResolvedFormation {
  formation: ReceptionFormation;
  rotation: Rotation;
  slots: ResolvedSlot[];
  /** Jugadoras delanteras (en zonas 2/3/4) — pueden bloquear y atacar de cualquier punto. */
  frontRow: ResolvedSlot[];
  /** Jugadoras zagueras (en zonas 1/5/6) — sólo ataque desde detrás de 3m (pipe). */
  backRow: ResolvedSlot[];
}

export function resolveFormation(opts: {
  system: TacticalSystem;
  rotation: Rotation;
  lineup: TeamLineup;
  /** Necesario para calcular `rotationPosition` / `isFrontRow` / `isBackRow`. */
  onCourt?: string[];
  phase?: FormationPhase;
  customs?: Partial<Record<Rotation, Partial<Record<TacticalRole, { x: number; y: number }>>>>;
  /** Si el líbero está en cancha reemplazando a una central, swap. */
  liberoOnCourt?: boolean;
}): ResolvedFormation {
  const { system, rotation, lineup, customs, liberoOnCourt = true, phase = "attack", onCourt = [] } = opts;
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

  // Si no hay líbero activo/asignado, el slot zaguero lo ocupa la central y se
  // dibujan 6 jugadoras siguiendo la rotación normal.
  const backMiddle = lineup.liberoReplaces === "middle1" ? lineup.middle1 : lineup.middle2;
  roleToPlayer.libero = liberoOnCourt && lineup.libero ? lineup.libero : backMiddle;
  if (liberoOnCourt && lineup.libero) roleToPlayer.middle_back = lineup.libero;

  const slots: ResolvedSlot[] = formation.slots.map((s) => {
    const o = override[s.role];
    const playerId = roleToPlayer[s.role] ?? null;
    const rotationPosition = playerId ? getRotationPosition(onCourt, playerId) : null;
    const isFrontRow = rotationPosition ? isFrontRowPosition(rotationPosition) : false;
    return {
      ...s,
      x: o?.x ?? s.x,
      y: o?.y ?? s.y,
      playerId,
      rotationPosition,
      isFrontRow,
      isBackRow: rotationPosition ? !isFrontRow : false,
    };
  });

  const frontRow = slots.filter((s) => s.isFrontRow);
  const backRow = slots.filter((s) => s.isBackRow);

  return { formation, rotation, slots, frontRow, backRow };
}
