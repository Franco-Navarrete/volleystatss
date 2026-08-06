import type { ReceptionFormation, Rotation } from "./types";

/**
 * Coordenadas oficiales 5-1 para RECEPCIÓN (equipo que no saca).
 *
 * Convención de Rotación (TanStack Vstats):
 * - Rotación 1: Armadora en P2 (delantera derecha).
 * - Rotación 2: Armadora en P1 (zaguera derecha).
 * - Rotación 3: Armadora en P6 (zaguera centro).
 * - Rotación 4: Armadora en P5 (zaguera izquierda).
 * - Rotación 5: Armadora en P4 (delantera izquierda).
 * - Rotación 6: Armadora en P3 (delantera centro).
 */

const P = {
  // Red
  z4: { x: 12, y: 15 },
  z3: { x: 50, y: 12 },
  z2: { x: 88, y: 15 },
  // Zaga
  z5: { x: 12, y: 80 },
  z6: { x: 50, y: 85 },
  z1: { x: 88, y: 80 },
  // Escondidos / Apoyo
  hide_left: { x: 8, y: 12 },
  hide_right: { x: 92, y: 12 },
  net_setter: { x: 72, y: 15 },
} as const;

export const FORMATIONS_5_1_RECEPTION: Record<Rotation, ReceptionFormation> = {
  // Rotación 1 (Armadora en P2)
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget: P.net_setter,
    attackers: ["outside_front", "middle_front"],
    slots: [
      { role: "setter", ...P.hide_right },
      { role: "outside_front", ...P.z4 },
      { role: "middle_front", ...P.z3 },
      { role: "opposite", ...P.z1 },
      { role: "outside_back", ...P.z5 },
      { role: "middle_back", ...P.z6 },
      { role: "libero", ...P.z6 },
    ],
  },
  // Rotación 2 (Armadora en P1)
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: P.net_setter,
    attackers: ["outside_front", "middle_front", "opposite"],
    slots: [
      { role: "setter", ...P.hide_right },
      { role: "outside_front", ...P.z4 },
      { role: "middle_front", ...P.z3 },
      { role: "opposite", ...P.z2 },
      { role: "outside_back", ...P.z6 },
      { role: "middle_back", ...P.z5 },
      { role: "libero", ...P.z5 },
    ],
  },
  // Rotación 3 (Armadora en P6)
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: P.net_setter,
    attackers: ["outside_front", "middle_front", "opposite"],
    slots: [
      { role: "setter", ...P.z6 },
      { role: "outside_front", ...P.z4 },
      { role: "middle_front", ...P.z3 },
      { role: "opposite", ...P.z2 },
      { role: "outside_back", ...P.z5 },
      { role: "middle_back", ...P.z1 },
      { role: "libero", ...P.z1 },
    ],
  },
  // Rotación 4 (Armadora en P5)
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: P.net_setter,
    attackers: ["outside_front", "middle_front", "opposite"],
    slots: [
      { role: "setter", ...P.z5 },
      { role: "outside_front", ...P.z4 },
      { role: "middle_front", ...P.z3 },
      { role: "opposite", ...P.z2 },
      { role: "outside_back", ...P.z1 },
      { role: "middle_back", ...P.z6 },
      { role: "libero", ...P.z6 },
    ],
  },
  // Rotación 5 (Armadora en P4)
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: P.net_setter,
    attackers: ["middle_front", "opposite"],
    slots: [
      { role: "setter", ...P.hide_left },
      { role: "middle_front", ...P.z3 },
      { role: "opposite", ...P.z2 },
      { role: "outside_front", ...P.z5 },
      { role: "outside_back", ...P.z6 },
      { role: "middle_back", ...P.z1 },
      { role: "libero", ...P.z1 },
    ],
  },
  // Rotación 6 (Armadora en P3)
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: P.net_setter,
    attackers: ["outside_front", "opposite"],
    slots: [
      { role: "setter", ...P.hide_right },
      { role: "outside_front", ...P.z4 },
      { role: "opposite", ...P.z2 },
      { role: "middle_front", ...P.z5 },
      { role: "outside_back", ...P.z6 },
      { role: "middle_back", ...P.z1 },
      { role: "libero", ...P.z1 },
    ],
  },
};