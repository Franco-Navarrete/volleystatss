import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 de ATAQUE BASE (post-recepción y para el equipo que saca).
 *
 * Coordenadas oficiales:
 * y=0 -> red, y=100 -> línea final
 * x=0 -> izquierda, x=100 -> derecha
 */

const P = {
  p1: { x: 85, y: 82 }, // zaguera derecha
  p5: { x: 15, y: 82 }, // zaguera izquierda
  p6: { x: 50, y: 82 }, // zaguera centro
  z2: { x: 85, y: 18 }, // frente derecha
  z3: { x: 50, y: 15 }, // frente centro
  z4: { x: 15, y: 18 }, // frente izquierda
} as const;

const setterTarget = { x: 72, y: 18 };

export const FORMATIONS_5_1: Record<Rotation, ReceptionFormation> = {
  // Rotación 1 (Armadora en P1)
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
  // Rotación 2 (Armadora en P2)
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
  // Rotación 3 (Armadora en P3)
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget,
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", ...P.z3 },
      { role: "middle_front", ...P.z4 },
      { role: "middle_back", ...P.p6 },
      { role: "outside_front", ...P.z2 },
      { role: "opposite", ...P.p1 },
      { role: "outside_back", ...P.p5 },
      { role: "libero", ...P.p6 },
    ],
  },
  // Rotación 4 (Armadora en P4)
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget,
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", ...P.z4 },
      { role: "middle_front", ...P.z2 },
      { role: "middle_back", ...P.p1 },
      { role: "outside_front", ...P.z3 },
      { role: "opposite", ...P.p5 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p1 },
    ],
  },
  // Rotación 5 (Armadora en P5)
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget,
    attackers: ["middle_front", "opposite", "outside_front", "outside_back"],
    slots: [
      { role: "setter", ...P.p5 },
      { role: "opposite", ...P.z4 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p1 },
      { role: "outside_front", ...P.z2 },
      { role: "outside_back", ...P.p6 },
      { role: "libero", ...P.p1 },
    ],
  },
  // Rotación 6 (Armadora en P6)
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget,
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", ...P.p6 },
      { role: "opposite", ...P.z1 },
      { role: "middle_front", ...P.z3 },
      { role: "middle_back", ...P.p1 },
      { role: "outside_front", ...P.z4 },
      { role: "outside_back", ...P.p5 },
      { role: "libero", ...P.p1 },
    ],
  },
};