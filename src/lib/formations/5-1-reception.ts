import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 de RECEPCIÓN (formación en "W") derivadas de las láminas VOLEYCA.
 * Se aplican mientras el equipo está recibiendo el saque (antes de que la jugadora
 * registre la recepción). Después de la recepción, se usa la formación de ATAQUE
 * de `5-1.ts`.
 *
 * Sistema de coordenadas (por equipo):
 *   y=0 → red, y=100 → línea final
 *   x=0 → izquierda del equipo, x=100 → derecha del equipo
 */
export const FORMATIONS_5_1_RECEPTION: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora zaguera derecha (z1). Penetra a z2-3 para armar.
  // OPUESTA cubre delante saliendo hacia z4. CENTRAL queda en red para 1er tiempo.
  // Reciben: punta z5, líbero z6, punta zaguera junto a armadora en z1.
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget: { x: 70, y: 14 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 86, y: 78 },
      { role: "outside_back", x: 72, y: 70 },
      { role: "libero", x: 50, y: 70 },
      { role: "outside_front", x: 24, y: 68 },
      { role: "middle_front", x: 50, y: 15 },
      { role: "opposite", x: 10, y: 42 },
    ],
  },

  // Rot 2 — armadora delantera derecha (z2). Se queda en z2 para armar.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 75, y: 14 },
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 85, y: 18 },
      { role: "middle_front", x: 22, y: 16 },
      { role: "outside_front", x: 22, y: 70 },
      { role: "outside_back", x: 44, y: 72 },
      { role: "libero", x: 66, y: 72 },
      { role: "opposite", x: 84, y: 90 },
    ],
  },

  // Rot 3 — armadora delantera centro (z3). Se desplaza a z2.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 75, y: 14 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 55, y: 20 },
      { role: "middle_front", x: 82, y: 18 },
      { role: "outside_front", x: 22, y: 70 },
      { role: "libero", x: 50, y: 70 },
      { role: "outside_back", x: 78, y: 72 },
      { role: "opposite", x: 80, y: 92 },
    ],
  },

  // Rot 4 — armadora delantera izquierda (z4). Recorre todo para llegar a z2.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 75, y: 14 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      { role: "setter", x: 18, y: 18 },
      { role: "middle_front", x: 42, y: 38 },
      { role: "outside_front", x: 22, y: 72 },
      { role: "outside_back", x: 50, y: 72 },
      { role: "libero", x: 74, y: 72 },
      { role: "opposite", x: 88, y: 90 },
    ],
  },

  // Rot 5 — armadora zaguera izquierda (z5). Penetra a z2.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 72, y: 14 },
    attackers: ["middle_front", "opposite", "outside_front", "outside_back"],
    slots: [
      { role: "setter", x: 45, y: 30 },
      { role: "middle_front", x: 22, y: 18 },
      { role: "opposite", x: 84, y: 18 },
      { role: "outside_front", x: 22, y: 72 },
      { role: "outside_back", x: 50, y: 72 },
      { role: "libero", x: 78, y: 72 },
    ],
  },

  // Rot 6 — armadora zaguera centro (z6). Penetra entre z2-3.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 70, y: 14 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 62, y: 28 },
      { role: "middle_front", x: 50, y: 16 },
      { role: "opposite", x: 84, y: 18 },
      { role: "outside_front", x: 22, y: 32 },
      { role: "libero", x: 50, y: 72 },
      { role: "outside_back", x: 78, y: 72 },
    ],
  },
};
