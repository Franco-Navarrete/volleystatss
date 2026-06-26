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

  // Rot 2 — armadora delantera derecha (z2). Layout estándar:
  //   Delanteros: punta z4, central z3, armadora z2.
  //   Zagueros: líbero P5, punta zaguero P6, opuesta P1.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 75, y: 14 },
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "outside_front", x: 15, y: 18 }, // z4 — punta
      { role: "middle_front", x: 50, y: 15 },  // z3 — central
      { role: "setter", x: 85, y: 18 },        // z2 — armadora
      { role: "libero", x: 15, y: 82 },        // P5
      { role: "outside_back", x: 50, y: 82 },  // P6 — punta zaguero
      { role: "opposite", x: 85, y: 82 },      // P1
    ],
  },

  // Rot 3 — armadora delantera (oficial z3, va a z2). Central z3, punta z4.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 75, y: 14 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      { role: "outside_front", x: 15, y: 18 },
      { role: "middle_front", x: 50, y: 15 },
      { role: "setter", x: 85, y: 18 },
      { role: "libero", x: 15, y: 82 },
      { role: "outside_back", x: 50, y: 82 },
      { role: "opposite", x: 85, y: 82 },
    ],
  },

  // Rot 4 — armadora delantera (oficial z4, va a z2). Central z3, punta z4.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 75, y: 14 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      { role: "outside_front", x: 15, y: 18 },
      { role: "middle_front", x: 50, y: 15 },
      { role: "setter", x: 85, y: 18 },
      { role: "libero", x: 15, y: 82 },
      { role: "outside_back", x: 50, y: 82 },
      { role: "opposite", x: 85, y: 82 },
    ],
  },

  // Rot 5 — armadora zaguera izquierda (z5). Penetra a z2.
  //   Delanteros: punta z4, central z3, opuesta z2. Armadora penetra desde P5/P1.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 72, y: 14 },
    attackers: ["middle_front", "opposite", "outside_front", "outside_back"],
    slots: [
      { role: "outside_front", x: 15, y: 18 },
      { role: "middle_front", x: 50, y: 15 },
      { role: "opposite", x: 85, y: 18 },
      { role: "setter", x: 85, y: 82 },
      { role: "outside_back", x: 50, y: 82 },
      { role: "libero", x: 15, y: 82 },
    ],
  },

  // Rot 6 — armadora zaguera centro (z6). Penetra a P1.
  //   Delanteros: punta z4, central z3, opuesta z2.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 70, y: 14 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "outside_front", x: 15, y: 18 },
      { role: "middle_front", x: 50, y: 15 },
      { role: "opposite", x: 85, y: 18 },
      { role: "setter", x: 85, y: 82 },
      { role: "outside_back", x: 50, y: 82 },
      { role: "libero", x: 15, y: 82 },
    ],
  },
};
