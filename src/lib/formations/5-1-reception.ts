import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 de RECEPCIÓN (formación en "W") ajustadas a las láminas
 * VOLEYCA de referencia. Se aplican mientras el equipo está recibiendo el
 * saque. Después de la recepción, se usa la formación de ATAQUE de `5-1.ts`.
 *
 * Convención (por equipo):
 *   y=0 → red, y=100 → línea final
 *   x=0 → izquierda del equipo, x=100 → derecha del equipo
 *
 * Etiquetas de la lámina:
 *   YO = armadora, C = central, O = opuesta,
 *   P1/P2 = puntas (front/back), L = líbero.
 */
export const FORMATIONS_5_1_RECEPTION: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora zaguera derecha (P1). Se ubica detrás del punta 1
  // y luego penetra a zona 2-3 para armar.
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget: { x: 72, y: 16 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "opposite", x: 15, y: 15 },
      { role: "middle_front", x: 48, y: 15 },
      { role: "outside_front", x: 20, y: 55 },
      { role: "libero", x: 45, y: 68 },
      { role: "outside_back", x: 72, y: 55 },
      { role: "setter", x: 90, y: 82 },
    ],
  },

  // Rot 2 — armadora delantera derecha (z2). Se queda en z2 para armar.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 78, y: 16 },
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "middle_front", x: 15, y: 20 },
      { role: "setter", x: 80, y: 15 },
      { role: "outside_front", x: 22, y: 52 },
      { role: "libero", x: 78, y: 52 },
      { role: "outside_back", x: 48, y: 62 },
      { role: "opposite", x: 30, y: 90 },
    ],
  },

  // Rot 3 — armadora delantera centro (z3). Se desplaza a z2 para armar.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 78, y: 16 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 62, y: 14 },
      { role: "middle_front", x: 82, y: 20 },
      { role: "outside_front", x: 22, y: 48 },
      { role: "libero", x: 45, y: 58 },
      { role: "outside_back", x: 72, y: 48 },
      { role: "opposite", x: 60, y: 78 },
    ],
  },

  // Rot 4 — armadora delantera izquierda (z4). Se ubica en el borde
  // izquierdo y luego recorre a z2-3 para armar.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 78, y: 16 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      { role: "setter", x: 10, y: 12 },
      { role: "middle_front", x: 25, y: 22 },
      { role: "outside_front", x: 30, y: 48 },
      { role: "libero", x: 68, y: 48 },
      { role: "outside_back", x: 48, y: 58 },
      { role: "opposite", x: 85, y: 90 },
    ],
  },

  // Rot 5 — armadora zaguera izquierda (P5). Se ubica debajo del central
  // y a la izquierda del punta 1, luego penetra a z2-3.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 72, y: 16 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      // P2 (outside_front) al frente, ligeramente a la izquierda de la red
      { role: "outside_front", x: 40, y: 15 },
      // O (opposite) al frente derecha
      { role: "opposite", x: 85, y: 18 },
      // L (libero) cubriendo al central en zaga izquierda
      { role: "libero", x: 22, y: 45 },
      // C2 (middle_front) al costado derecho, escalonada hacia atrás
      { role: "middle_front", x: 82, y: 42 },
      // P1 (outside_back) en el centro-fondo
      { role: "outside_back", x: 50, y: 60 },
      // A (setter) penetrando desde zaga izquierda
      { role: "setter", x: 15, y: 80 },
    ],
  },

  // Rot 6 — armadora zaguera centro (P6). Se ubica debajo del opuesto
  // y a la izquierda del central, luego penetra a z2-3.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 72, y: 16 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "opposite", x: 65, y: 15 },
      { role: "middle_front", x: 82, y: 22 },
      { role: "setter", x: 52, y: 30 },
      { role: "outside_front", x: 18, y: 55 },
      { role: "outside_back", x: 82, y: 60 },
      { role: "libero", x: 50, y: 72 },
    ],
  },
};
