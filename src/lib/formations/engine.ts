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
 * Deriva la plantilla de formación según sistema, rotación y fase del rally.
 */
export function getFormation(
  system: TacticalSystem,
  rotation: Rotation,
  phase: FormationPhase = "attack",
): ReceptionFormation {
  // En fase de ataque (o cuando el equipo saca), usamos la plantilla base de posiciones tácticas.
  // En fase de recepción (esperando el saque rival), usamos la plantilla de W/recepción.
  if (phase === "reception") return FORMATIONS_5_1_RECEPTION[rotation];
  return FORMATIONS_5_1[rotation];
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
  const inCourt = onCourt
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as Player[];
  const designated = new Set(designatedLiberoIds);
  const libero =
    inCourt.find((p) => designated.has(p.id)) ??
    (designated.size === 0 ? inCourt.find((p) => p.position === "libero") : undefined);
  
  // tacticalPlayers son los 6 en cancha. 
  // No filtramos al líbero porque el motor 5-1 necesita 6 slots físicos.
  const tacticalPlayers = inCourt;


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
    liberoReplaces: designated.size > 0 || inCourt.some(p => p.position === "libero") ? "middle2" : "none",
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
  // Convención Vstats:
  // idx 0 (P1) -> Rotación 1
  // idx 5 (P6) -> Rotación 2
  // idx 4 (P5) -> Rotación 3
  // idx 3 (P4) -> Rotación 4
  // idx 2 (P3) -> Rotación 5
  // idx 1 (P2) -> Rotación 6
  const map: Record<number, Rotation> = {
    0: 1, // P1
    5: 2, // P6
    4: 3, // P5
    3: 4, // P4
    2: 5, // P3
    1: 6, // P2
  };
  return map[idx] ?? null;
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
  
  if (onCourt.length !== 6) {
    // Si llegamos aquí con != 6, forzamos un array de 6 para evitar errores de renderizado.
    const validPlayers = onCourt.filter(id => id && id.trim() !== "");
    const repaired = [...validPlayers];
    while (repaired.length < 6) {
      repaired.push(`emergency-slot-${repaired.length}`);
    }
    // Modificamos el array original por referencia para que el resto del motor use los 6 slots
    onCourt.length = 0;
    onCourt.push(...repaired.slice(0, 6));
  }

  const formation = getFormation(system, rotation, phase);
  const override = customs?.[rotation] ?? {};

  // Mapeo rol -> playerId.
  // Asignamos dinámicamente C1/C2 y P1/P2 basándonos en quién está en red (Front) vs zaga (Back)
  const middle1Info = getPlayerRotationInfo(onCourt, lineup.middle1 || "");
  const middle2Info = getPlayerRotationInfo(onCourt, lineup.middle2 || "");
  const outside1Info = getPlayerRotationInfo(onCourt, lineup.outside1 || "");
  const outside2Info = getPlayerRotationInfo(onCourt, lineup.outside2 || "");

  const middleFrontId = middle1Info?.isFrontRow ? lineup.middle1 : (middle2Info?.isFrontRow ? lineup.middle2 : (lineup.middle1 || lineup.middle2));
  const middleBackId = middle2Info?.isBackRow ? lineup.middle2 : (middle1Info?.isBackRow ? lineup.middle1 : (lineup.middle2 || lineup.middle1));
  const outsideFrontId = outside1Info?.isFrontRow ? lineup.outside1 : (outside2Info?.isFrontRow ? lineup.outside2 : (lineup.outside1 || lineup.outside2));
  const outsideBackId = outside2Info?.isBackRow ? lineup.outside2 : (outside1Info?.isBackRow ? lineup.outside1 : (lineup.outside2 || lineup.outside1));


  const roleToPlayer: Partial<Record<TacticalRole, string | undefined>> = {
    setter: lineup.setter,
    opposite: lineup.opposite,
    middle_front: middleFrontId,
    middle_back: middleBackId,
    outside_front: outsideFrontId,
    outside_back: outsideBackId,
    libero: lineup.libero,
  };


  // Lógica para líbero: si no hay líbero asignado en el lineup, middle_back permanece middle_back.
  // El slot 'libero' en la formación se usa para dibujar al líbero o al central zaguero si no hay líbero.
  if (liberoOnCourt && lineup.libero) {
    roleToPlayer.libero = lineup.libero;
  } else {
    // Si no hay líbero, el rol 'libero' en el dibujo táctico lo ocupa el central zaguero.
    roleToPlayer.libero = middleBackId;
  }

  const slots: ResolvedSlot[] = formation.slots.map((s) => {
    const o = override[s.role];
    let playerId = roleToPlayer[s.role] ?? null;

    // Si es fase de recepción y el rol es líbero, pero el líbero no está asignado o no está en cancha,
    // usamos al central zaguero (middle_back) para ocupar ese slot visual.
    if (phase === "reception" && s.role === "libero" && !playerId) {
      playerId = roleToPlayer.middle_back ?? null;
    }

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
