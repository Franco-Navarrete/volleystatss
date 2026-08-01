import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 de RECEPCIÓN (formación en "W").
 *
 * Convención (por equipo):
 *   y=0 → red, y=100 → línea final
 *   x=0 → izquierda del equipo, x=100 → derecha del equipo
 *
 * REGLA GENERAL para evitar amontonamiento en la cancha horizontal:
 * - Los 3 atacantes de red se pegan a la red (y ≈ 10-15) repartidos en
 *   Z4 (x≈15), Z3 (x≈50) y Z2 (x≈85).
 * - Los receptores (2 puntas + líbero, o punta/opuesto según rotación)
 *   forman una W ocupando TODO el ancho: izquierda (x≈20), centro (x≈50)
 *   y derecha (x≈80), a distintas profundidades (y entre 45 y 75).
 * - La armadora se ubica según su posición: pegada a la red si es
 *   delantera, o penetrando desde el fondo si es zaguera.
 */
export const FORMATIONS_5_1_RECEPTION: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora en P1 (zaguera derecha). Penetra hacia Z2.
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget: { x: 70, y: 15 },
    attackers: ["outside_back", "middle_front", "opposite", "outside_front"],
    slots: [
      { role: "setter", x: 72, y: 30 },
      { role: "opposite", x: 15, y: 12 },
      { role: "middle_front", x: 45, y: 12 },
      { role: "middle_back", x: 55, y: 70 },
      { role: "outside_back", x: 90, y: 12 },
      { role: "outside_front", x: 20, y: 60 },
      { role: "libero", x: 55, y: 70 },
    ],
  },

  // Rot 2 — armadora en P2 (delantera derecha). Pegada a la red en Z2.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 80, y: 15 },
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 88, y: 12 },
      { role: "middle_front", x: 50, y: 12 },
      { role: "middle_back", x: 45, y: 65 },
      { role: "outside_front", x: 15, y: 12 },
      { role: "outside_back", x: 78, y: 55 },
      { role: "libero", x: 45, y: 65 },
      { role: "opposite", x: 18, y: 60 },
    ],
  },

  // Rot 3 — armadora en P3 (delantera centro). En Z2/3 pegada a la red.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 65, y: 15 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 65, y: 12 },
      { role: "middle_front", x: 35, y: 12 },
      { role: "middle_back", x: 48, y: 68 },
      { role: "outside_front", x: 12, y: 12 },
      { role: "outside_back", x: 80, y: 60 },
      { role: "libero", x: 48, y: 68 },
      { role: "opposite", x: 18, y: 62 },
      { role: "libero", x: 48, y: 68 },
      { role: "opposite", x: 18, y: 62 },
    ],
  },

  // Rot 4 — armadora en P4 (delantera izquierda). Pegada a la red por Z4.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 55, y: 15 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      { role: "setter", x: 15, y: 12 },
      { role: "middle_front", x: 45, y: 12 },
      { role: "middle_back", x: 55, y: 70 },
      { role: "outside_front", x: 85, y: 12 },
      { role: "outside_back", x: 25, y: 60 },
      { role: "libero", x: 55, y: 70 },
      { role: "opposite", x: 82, y: 60 },
    ],
  },

  // Rot 5 — armadora en P5 (zaguera izquierda). Penetra al centro hacia Z2/3.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 60, y: 15 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 55, y: 30 },
      { role: "opposite", x: 88, y: 12 },
      { role: "middle_front", x: 50, y: 12 },
      { role: "outside_front", x: 12, y: 12 },
      { role: "middle_back", x: 50, y: 75 },
      { role: "outside_back", x: 25, y: 65 },
      { role: "libero", x: 78, y: 65 },
    ],
  },

  // Rot 6 — armadora en P6 (zaguera centro). Penetra al centro hacia Z2/3.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 65, y: 15 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 62, y: 25 },
      { role: "opposite", x: 88, y: 12 },
      { role: "middle_front", x: 40, y: 12 },
      { role: "outside_front", x: 12, y: 12 },
      { role: "middle_back", x: 80, y: 60 },
      { role: "outside_back", x: 20, y: 60 },
      { role: "libero", x: 55, y: 72 },
    ],
  },
};
