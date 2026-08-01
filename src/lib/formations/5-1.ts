import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 de ATAQUE BASE (post-recepción y para el equipo que saca).
 *
 * Reglas aplicadas en cada rotación:
 *
 *   FRENTE
 *     - Opuesto    → zona 2 (frente derecha)
 *     - Central    → zona 3 (frente centro)
 *     - Punta      → zona 4 (frente izquierda)
 *     - Si la armadora es delantera (rot 2/3/4), ocupa su zona y desplaza al
 *       atacante natural de esa zona.
 *
 *   ZONA ZAGUERA
 *     - P1 (zaguera derecha) → armadora si es zaguera, opuesta si la armadora
 *       es delantera. Es desde donde penetra para armar.
 *     - P6 (zaguera centro)  → punta zaguero.
 *     - P5 (zaguera izquierda) → líbero o central zaguero.
 *
 * Sistema de coordenadas (por equipo):
 *   y=0 → red, y=100 → línea final
 *   x=0 → izquierda del equipo, x=100 → derecha del equipo
 */

const P = {
  p1: { x: 85, y: 82 }, // zaguera derecha (penetración armadora)
  p5: { x: 15, y: 82 }, // zaguera izquierda (líbero/central)
  p6: { x: 50, y: 82 }, // zaguera centro (punta zaguero)
  z2: { x: 85, y: 18 }, // frente derecha (opuesto)
  z3: { x: 50, y: 15 }, // frente centro (central)
  z4: { x: 15, y: 18 }, // frente izquierda (punta)
} as const;

const setterTarget = { x: 72, y: 18 };

export const FORMATIONS_5_1: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora zaguera (z1). Penetra a P1. Ataque natural completo.
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget,
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", ...P.p1 },
      { role: "opposite", ...P.z2 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p5 },
      { role: "outside_front", ...P.z4 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p5 },
    ],
  },

  // Rot 2 — armadora delantera (z2). Opuesta cubre P1.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget,
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", ...P.z2 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p5 },
      { role: "outside_front", ...P.z4 },
      { role: "opposite", ...P.p1 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p5 },
    ],
  },

  // Rot 3 — armadora delantera (oficial z3, se desplaza a z2 para armar).
  //   Central abre a z3, punta z4, opuesta cubre P1.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget,
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", ...P.z2 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p5 },
      { role: "outside_front", ...P.z4 },
      { role: "opposite", ...P.p1 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p5 },
    ],
  },

  // Rot 4 — armadora delantera (oficial z4, se desplaza a z2 para armar).
  //   Central z3, punta z4, opuesta cubre P1.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget,
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", ...P.z2 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p5 },
      { role: "outside_front", ...P.z4 },
      { role: "opposite", ...P.p1 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p5 },
    ],
  },

  // Rot 5 — armadora zaguera (z5). Penetra a P1. Ataque natural completo.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget,
    attackers: ["middle_front", "opposite", "outside_front", "outside_back"],
    slots: [
      { role: "setter", ...P.p1 },
      { role: "opposite", ...P.z2 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p5 },
      { role: "outside_front", ...P.z4 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p5 },
    ],
  },

  // Rot 6 — armadora zaguera (z6). Penetra a P1. Ataque natural completo.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget,
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", ...P.p1 },
      { role: "opposite", ...P.z2 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p5 },
      { role: "outside_front", ...P.z4 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p5 },
    ],
  },
};
