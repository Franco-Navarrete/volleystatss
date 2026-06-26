import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 con posiciones de ATAQUE BASE automáticas.
 *
 * Regla general aplicada en cada rotación:
 *   - Opuesto    → siempre zona 2 (frente derecha)
 *   - Central    → siempre zona 3 (frente centro)
 *   - Punta      → siempre zona 4 (frente izquierda)
 *   - Líbero     → zona 6 (fondo centro)
 *   - Punta zaguero → zona 5 (fondo izquierda)
 *   - Armadora   → ocupa la zona dictada por su rotación. Si su rotación
 *                  coincide con z2/z3/z4 (frente), desplaza al atacante natural
 *                  de esa zona hacia el fondo (z1).
 *
 * Sistema de coordenadas (por equipo):
 *   y=0 → red, y=100 → línea final
 *   x=0 → izquierda del equipo, x=100 → derecha del equipo
 */

const Z = {
  z1: { x: 85, y: 82 },
  z2: { x: 85, y: 18 },
  z3: { x: 50, y: 15 },
  z4: { x: 15, y: 18 },
  z5: { x: 15, y: 82 },
  z6: { x: 50, y: 82 },
} as const;

const setterTarget = { x: 72, y: 18 };

export const FORMATIONS_5_1: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora en z1 (zaguera derecha). Ataque natural completo.
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget,
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", ...Z.z1 },
      { role: "opposite", ...Z.z2 },
      { role: "middle_front", ...Z.z3 },
      { role: "outside_front", ...Z.z4 },
      { role: "outside_back", ...Z.z5 },
      { role: "libero", ...Z.z6 },
    ],
  },

  // Rot 2 — armadora en z2 (frente derecha). Desplaza al opuesto al fondo (z1).
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget,
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", ...Z.z2 },
      { role: "middle_front", ...Z.z3 },
      { role: "outside_front", ...Z.z4 },
      { role: "opposite", ...Z.z1 },
      { role: "outside_back", ...Z.z5 },
      { role: "libero", ...Z.z6 },
    ],
  },

  // Rot 3 — armadora en z3. Desplaza a la central al fondo derecha.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget,
    attackers: ["outside_front", "opposite", "outside_back", "middle_front"],
    slots: [
      { role: "setter", ...Z.z3 },
      { role: "opposite", ...Z.z2 },
      { role: "outside_front", ...Z.z4 },
      { role: "middle_front", ...Z.z1 },
      { role: "outside_back", ...Z.z5 },
      { role: "libero", ...Z.z6 },
    ],
  },

  // Rot 4 — armadora en z4. Desplaza al punta delantera al fondo (z1).
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget,
    attackers: ["middle_front", "opposite", "outside_back", "outside_front"],
    slots: [
      { role: "setter", ...Z.z4 },
      { role: "middle_front", ...Z.z3 },
      { role: "opposite", ...Z.z2 },
      { role: "outside_front", ...Z.z1 },
      { role: "outside_back", ...Z.z5 },
      { role: "libero", ...Z.z6 },
    ],
  },

  // Rot 5 — armadora en z5 (zaguera izquierda). Ataque natural completo.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget,
    attackers: ["middle_front", "opposite", "outside_front", "outside_back"],
    slots: [
      { role: "setter", ...Z.z5 },
      { role: "opposite", ...Z.z2 },
      { role: "middle_front", ...Z.z3 },
      { role: "outside_front", ...Z.z4 },
      { role: "outside_back", ...Z.z1 },
      { role: "libero", ...Z.z6 },
    ],
  },

  // Rot 6 — armadora en z6 (zaguera centro). Ataque natural completo.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget,
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", ...Z.z6 },
      { role: "opposite", ...Z.z2 },
      { role: "middle_front", ...Z.z3 },
      { role: "outside_front", ...Z.z4 },
      { role: "outside_back", ...Z.z5 },
      { role: "libero", ...Z.z1 },
    ],
  },
};
