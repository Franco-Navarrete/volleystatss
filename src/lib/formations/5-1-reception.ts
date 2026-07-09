import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 de RECEPCIÓN (formación en "W") ajustadas a los diagramas
 * de referencia enviados por el usuario. Se aplican mientras el equipo está
 * recibiendo el saque. Después de la recepción, se usa la formación de
 * ATAQUE de `5-1.ts`.
 *
 * Convención (por equipo):
 *   y=0 → red, y=100 → línea final
 *   x=0 → izquierda del equipo, x=100 → derecha del equipo
 */
export const FORMATIONS_5_1_RECEPTION: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora en P1 (zaguera derecha). Penetra desde el fondo.
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget: { x: 72, y: 16 },
    attackers: ["outside_back", "middle_front", "opposite", "outside_front"],
    slots: [
      { role: "opposite", x: 78, y: 12 },
      { role: "middle_front", x: 40, y: 20 },
      { role: "setter", x: 68, y: 10 },
      { role: "outside_front", x: 85, y: 48 },
      { role: "outside_back", x: 55, y: 72 },
      { role: "libero", x: 18, y: 85 },
    ],
  },

  // Rot 2 — armadora en P2 (delantera derecha). Se ubica al fondo antes de
  // subir a armar en Z2/3.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 78, y: 16 },
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "outside_front", x: 12, y: 22 },
      { role: "middle_front", x: 32, y: 25 },
      { role: "opposite", x: 55, y: 22 },
      { role: "setter", x: 75, y: 10 },
      { role: "outside_back", x: 22, y: 50 },
      { role: "libero", x: 88, y: 88 },
    ],
  },

  // Rot 3 — armadora en P3 (delantera centro). Se desplaza a z2 para armar.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 78, y: 16 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      { role: "middle_front", x: 52, y: 22 },
      { role: "setter", x: 72, y: 10 },
      { role: "outside_front", x: 15, y: 48 },
      { role: "outside_back", x: 85, y: 48 },
      { role: "libero", x: 40, y: 72 },
      { role: "opposite", x: 62, y: 85 },
    ],
  },

  // Rot 4 — armadora en P4 (delantera izquierda). Recorre a z2/3 para armar.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 78, y: 16 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      { role: "middle_front", x: 42, y: 20 },
      { role: "setter", x: 72, y: 10 },
      { role: "opposite", x: 55, y: 22 },
      { role: "libero", x: 90, y: 25 },
      { role: "outside_front", x: 28, y: 45 },
      { role: "outside_back", x: 12, y: 78 },
    ],
  },

  // Rot 5 — armadora en P5 (zaguera izquierda). Penetra desde la zaga izquierda.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 72, y: 16 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "outside_front", x: 38, y: 22 },
      { role: "setter", x: 68, y: 10 },
      { role: "opposite", x: 88, y: 22 },
      { role: "libero", x: 55, y: 38 },
      { role: "outside_back", x: 35, y: 52 },
      { role: "middle_front", x: 85, y: 82 },
    ],
  },

  // Rot 6 — armadora en P6 (zaguera centro). Penetra desde el centro-fondo.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 72, y: 16 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "outside_front", x: 38, y: 22 },
      { role: "setter", x: 30, y: 48 },
      { role: "libero", x: 60, y: 48 },
      { role: "middle_front", x: 80, y: 48 },
      { role: "outside_back", x: 38, y: 78 },
      { role: "opposite", x: 60, y: 78 },
    ],
  },
};
