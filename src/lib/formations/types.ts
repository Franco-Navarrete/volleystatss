// Motor de formaciones de recepción basado en roles tácticos.
// Diseñado para ser extendido a 6-2 / 4-2 agregando plantillas sin tocar el motor.

export type TacticalSystem = "5-1";

export type TacticalRole =
  | "setter" // armadora
  | "opposite" // opuesta
  | "middle_front" // central delantera (1er tiempo)
  | "middle_back" // central zaguera (la que típicamente reemplaza el líbero)
  | "outside_front" // punta delantera
  | "outside_back" // punta zaguera
  | "libero";

export const ROLE_LABEL: Record<TacticalRole, string> = {
  setter: "A",
  opposite: "O",
  middle_front: "CF",
  middle_back: "CZ",
  outside_front: "PF",
  outside_back: "PZ",
  libero: "L",
};

/** Colores por rol (oklch tokens del proyecto / fallbacks). */
export const ROLE_COLOR: Record<TacticalRole, string> = {
  setter: "#f59e0b", // naranja
  opposite: "#facc15", // amarillo
  middle_front: "#22c55e", // verde
  middle_back: "#16a34a", // verde más oscuro
  outside_front: "#3b82f6", // azul
  outside_back: "#2563eb", // azul oscuro
  libero: "#38bdf8", // celeste
};

/** Coordenadas en porcentaje. (0,0) = esquina superior izquierda (red al norte). */
export interface FormationSlot {
  role: TacticalRole;
  x: number; // 0..100 (ancho cancha)
  y: number; // 0..100 (largo, 0 = red, 100 = línea final)
}

export type Rotation = 1 | 2 | 3 | 4 | 5 | 6;

export interface ReceptionFormation {
  system: TacticalSystem;
  rotation: Rotation;
  slots: FormationSlot[];
  /** Zona del 2do toque (dónde arma la setter). */
  setterTarget: { x: number; y: number };
  /** Roles que pueden atacar tras la recepción. */
  attackers: TacticalRole[];
}

/** Lineup del equipo: 1 jugadora por rol. */
export interface TeamLineup {
  setter?: string;
  opposite?: string;
  middle1?: string;
  middle2?: string;
  outside1?: string;
  outside2?: string;
  libero?: string;
  /** A qué central reemplaza el líbero (si existe). */
  liberoReplaces?: "middle1" | "middle2" | "none";
}
