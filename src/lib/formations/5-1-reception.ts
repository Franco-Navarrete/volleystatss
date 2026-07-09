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
    setterTarget: { x: 75, y: 14 },
    attackers: ["outside_back", "middle_front", "opposite", "outside_front"],
    slots: [
      // Armadora penetra desde P1 (zaguera derecha) hacia la red.
      { role: "setter", x: 88, y: 82 },
      // Opuesto ataca por zona 4 (frente izquierda).
      { role: "opposite", x: 15, y: 15 },
      // Central delantera cubre zona 3.
      { role: "middle_front", x: 40, y: 18 },
      // P1 sube a atacar por zona 2 (frente derecha, pegada a la red).
      { role: "outside_back", x: 72, y: 18 },
      // P2 (punta delantera) recibe abierto por izquierda.
      { role: "outside_front", x: 14, y: 48 },
      // Líbero recibe junto a la punta.
      { role: "libero", x: 30, y: 48 },
    ],
  },

  // Rot 2 — armadora en P2 (delantera derecha). Se queda pegada a la red a la derecha.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 60, y: 14 },
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      // Armadora pegada a la red, lado derecho (Z2).
      { role: "setter", x: 60, y: 15 },
      // Central delantera arriba a la izquierda (Z3/4).
      { role: "middle_front", x: 15, y: 15 },
      // P1 (punta zaguera) recibe arriba-medio a la izquierda.
      { role: "outside_back", x: 18, y: 32 },
      // Opuesto atrás (zaguero izquierda).
      { role: "opposite", x: 18, y: 50 },
      // P2 (punta delantera) recibe al medio-izquierda.
      { role: "outside_front", x: 25, y: 65 },
      // Líbero recibe abajo a la izquierda.
      { role: "libero", x: 32, y: 82 },
    ],
  },

  // Rot 3 — armadora en P3 (delantera centro). Se ubica pegada a la red en Z3.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 50, y: 14 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      // Armadora pegada a la red, centro (levemente derecha).
      { role: "setter", x: 45, y: 10 },
      // Central delantera detrás/al lado de la armadora.
      { role: "middle_front", x: 38, y: 24 },
      // P1 (punta zaguera) recibe arriba a la izquierda.
      { role: "outside_back", x: 15, y: 24 },
      // Líbero recibe al medio-izquierda.
      { role: "libero", x: 18, y: 42 },
      // P2 (punta delantera) recibe abajo del líbero.
      { role: "outside_front", x: 22, y: 60 },
      // Opuesto atrás a la izquierda (zaguero).
      { role: "opposite", x: 22, y: 80 },
    ],
  },

  // Rot 4 — armadora en P4 (delantera izquierda). Se queda pegada a la red por la izquierda.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 40, y: 14 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      // Armadora pegada a la red, izquierda (Z4).
      { role: "setter", x: 15, y: 10 },
      // Central delantera al lado en Z3.
      { role: "middle_front", x: 25, y: 22 },
      // P2 (punta delantera) recibe al medio-izquierda.
      { role: "outside_front", x: 15, y: 40 },
      // P1 (punta zaguera) recibe debajo.
      { role: "outside_back", x: 22, y: 55 },
      // Líbero recibe abajo.
      { role: "libero", x: 32, y: 65 },
      // Opuesto atrás a la izquierda (zaguero).
      { role: "opposite", x: 20, y: 82 },
    ],
  },

  // Rot 5 — armadora en P5 (zaguera izquierda). Penetra al centro pegada a la red.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 55, y: 14 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      // Armadora penetra al centro, pegada a la red.
      { role: "setter", x: 52, y: 10 },
      // Opuesto pegado a la red, a la derecha de la armadora (Z2).
      { role: "opposite", x: 66, y: 15 },
      // Central delantera a la izquierda de la armadora (Z3).
      { role: "middle_front", x: 35, y: 15 },
      // P2 (punta delantera) recibe arriba a la izquierda.
      { role: "outside_front", x: 15, y: 32 },
      // P1 (punta zaguera) recibe al medio-izquierda.
      { role: "outside_back", x: 22, y: 52 },
      // Líbero recibe abajo a la izquierda.
      { role: "libero", x: 28, y: 72 },
    ],
  },

  // Rot 6 — armadora en P6 (zaguera centro). Penetra al centro pegada a la red.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 60, y: 14 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      // Armadora penetra desde P6 y se ubica pegada a la red, centro.
      { role: "setter", x: 58, y: 10 },
      // Central delantera al lado de la armadora, cubriendo Z3.
      { role: "middle_front", x: 42, y: 18 },
      // P2 (punta delantera) recibe abierto arriba a la izquierda.
      { role: "outside_front", x: 15, y: 30 },
      // Líbero recibe en el centro-izquierda.
      { role: "libero", x: 28, y: 48 },
      // P1 (punta zaguera) recibe abajo a la izquierda.
      { role: "outside_back", x: 32, y: 70 },
      // Opuesto atrás a la derecha.
      { role: "opposite", x: 82, y: 78 },
    ],
  },
};
