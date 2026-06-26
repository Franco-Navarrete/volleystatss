import type { ReceptionFormation, Rotation } from "./types";

// Coordenadas de referencia (% sobre media cancha):
//   y=0 = red, y=100 = fondo. x=0 izquierda, x=100 derecha.
// Posiciones rotación base:
//   pos 4 (z4): x=18 y=20
//   pos 3 (z3): x=50 y=20
//   pos 2 (z2): x=82 y=20
//   pos 5 (z5): x=18 y=80
//   pos 6 (z6): x=50 y=80
//   pos 1 (z1): x=82 y=80

/**
 * Plantillas de recepción 5-1 derivadas del sistema VOLEYCA.
 * En cada rotación la armadora "se esconde" y la opuesta cubre por ella
 * en la fase de saque, luego desplazándose al lugar indicado para recibir
 * el balón. Los slots representan la posición INICIAL de recepción
 * (formación en "W" con la armadora afuera del pase).
 */
export const FORMATIONS_5_1: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora en zaguero derecho (pos 1)
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget: { x: 65, y: 18 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 88, y: 55 }, // sale de 1 hacia 2-3 para armar
      { role: "outside_front", x: 22, y: 30 }, // punta delantera abre a 4
      { role: "middle_front", x: 50, y: 18 }, // central preparada 1er tiempo
      { role: "opposite", x: 78, y: 38 }, // opuesta zaguera (pipe / cobertura)
      { role: "outside_back", x: 32, y: 72 }, // punta zaguera recibe
      { role: "libero", x: 62, y: 75 }, // líbero recibe centro-fondo
    ],
  },

  // Rot 2 — armadora en frente derecho (pos 2)
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 70, y: 15 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 82, y: 22 },
      { role: "middle_front", x: 45, y: 18 },
      { role: "outside_front", x: 18, y: 25 },
      { role: "outside_back", x: 35, y: 75 },
      { role: "libero", x: 60, y: 75 },
      { role: "opposite", x: 82, y: 72 }, // opuesta zaguera cubre 1
    ],
  },

  // Rot 3 — armadora en frente centro (pos 3)
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 72, y: 15 },
    attackers: ["outside_front", "middle_back", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 55, y: 22 }, // desplaza a 2 para armar
      { role: "outside_front", x: 18, y: 25 }, // punta abre a 4
      { role: "middle_back", x: 82, y: 38 }, // central zaguera (z2/atrás)
      { role: "outside_back", x: 30, y: 72 },
      { role: "libero", x: 55, y: 78 },
      { role: "opposite", x: 78, y: 78 },
    ],
  },

  // Rot 4 — armadora en frente izquierdo (pos 4)
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 70, y: 15 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      { role: "setter", x: 18, y: 22 }, // se desplaza fuerte a 2 al armar
      { role: "middle_front", x: 45, y: 18 },
      { role: "outside_front", x: 38, y: 55 }, // central transición / punta delantera baja
      { role: "outside_back", x: 30, y: 75 },
      { role: "libero", x: 62, y: 78 },
      { role: "opposite", x: 85, y: 72 },
    ],
  },

  // Rot 5 — armadora en zaguero izquierdo (pos 5)
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 65, y: 18 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 50, y: 45 }, // sube de 5 a 2-3 para armar
      { role: "outside_front", x: 18, y: 22 },
      { role: "middle_front", x: 48, y: 18 },
      { role: "opposite", x: 82, y: 22 },
      { role: "outside_back", x: 25, y: 75 },
      { role: "libero", x: 70, y: 78 },
    ],
  },

  // Rot 6 — armadora en zaguero centro (pos 6)
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 60, y: 18 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 55, y: 45 }, // sube de 6 entre 2-3
      { role: "opposite", x: 78, y: 22 }, // opuesta delantera en 2
      { role: "middle_front", x: 50, y: 18 },
      { role: "outside_front", x: 22, y: 30 },
      { role: "outside_back", x: 82, y: 78 },
      { role: "libero", x: 50, y: 80 },
    ],
  },
};
