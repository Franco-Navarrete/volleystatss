import type { ReceptionFormation, Rotation } from "./types";

/**
 * Plantillas 5-1 de recepción derivadas de las láminas VOLEYCA.
 * Sistema de coordenadas (por equipo): y=0 → red, y=100 → línea final;
 * x=0 → lado izquierdo del equipo, x=100 → lado derecho del equipo.
 * Las posiciones reflejan la formación EN W para recibir el saque.
 */
export const FORMATIONS_5_1: Record<Rotation, ReceptionFormation> = {
  // Rot 1 — armadora zaguera derecha (z1). Penetra a z2-3 para armar.
  // OPUESTA cubre delante saliendo hacia z4. CENTRAL queda en red para 1er tiempo.
  // Reciben: punta z5, líbero z6, punta zaguera junto a armadora en z1.
  1: {
    system: "5-1",
    rotation: 1,
    setterTarget: { x: 70, y: 14 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 86, y: 78 }, // z1
      { role: "outside_back", x: 72, y: 70 }, // back-right, izq de la armadora
      { role: "libero", x: 50, y: 70 }, // z6
      { role: "outside_front", x: 24, y: 68 }, // z5 (cae a recibir)
      { role: "middle_front", x: 50, y: 15 }, // z3 frente
      { role: "opposite", x: 10, y: 42 }, // sale a z4 a atacar
    ],
  },

  // Rot 2 — armadora delantera derecha (z2). Se queda en z2 para armar.
  2: {
    system: "5-1",
    rotation: 2,
    setterTarget: { x: 75, y: 14 },
    attackers: ["middle_front", "outside_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 85, y: 18 }, // z2
      { role: "middle_front", x: 22, y: 16 }, // z4 frente
      { role: "outside_front", x: 22, y: 70 }, // z5 back-left
      { role: "outside_back", x: 44, y: 72 }, // entre z5 y z6
      { role: "libero", x: 66, y: 72 }, // z6/z1 cubriendo
      { role: "opposite", x: 84, y: 90 }, // z1 fondo, atacará desde atrás
    ],
  },

  // Rot 3 — armadora delantera centro (z3). Se desplaza a z2.
  3: {
    system: "5-1",
    rotation: 3,
    setterTarget: { x: 75, y: 14 },
    attackers: ["outside_front", "middle_front", "outside_back", "opposite"],
    slots: [
      { role: "setter", x: 55, y: 20 }, // desplazada de z3 hacia z2
      { role: "middle_front", x: 82, y: 18 }, // central queda en z2/z3 para 1er tiempo
      { role: "outside_front", x: 22, y: 70 }, // z5 back-left
      { role: "libero", x: 50, y: 70 }, // z6
      { role: "outside_back", x: 78, y: 72 }, // z1 back-right
      { role: "opposite", x: 80, y: 92 }, // sale por detrás de z1 para atacar
    ],
  },

  // Rot 4 — armadora delantera izquierda (z4). Recorre todo para llegar a z2.
  4: {
    system: "5-1",
    rotation: 4,
    setterTarget: { x: 75, y: 14 },
    attackers: ["middle_front", "outside_back", "opposite", "outside_front"],
    slots: [
      { role: "setter", x: 18, y: 18 }, // z4 (se desplaza fuerte a z2 al armar)
      { role: "middle_front", x: 42, y: 38 }, // central en transición (1er tiempo)
      { role: "outside_front", x: 22, y: 72 }, // z5
      { role: "outside_back", x: 50, y: 72 }, // pipe / z6
      { role: "libero", x: 74, y: 72 }, // z1
      { role: "opposite", x: 88, y: 90 }, // fondo z1 atacando
    ],
  },

  // Rot 5 — armadora zaguera izquierda (z5). Penetra a z2.
  5: {
    system: "5-1",
    rotation: 5,
    setterTarget: { x: 72, y: 14 },
    attackers: ["middle_front", "opposite", "outside_front", "outside_back"],
    slots: [
      { role: "setter", x: 45, y: 30 }, // penetrando desde z5
      { role: "middle_front", x: 22, y: 18 }, // z4
      { role: "opposite", x: 84, y: 18 }, // z2
      { role: "outside_front", x: 22, y: 72 }, // z5 (ataque pipe / back)
      { role: "outside_back", x: 50, y: 72 }, // z6
      { role: "libero", x: 78, y: 72 }, // z1
    ],
  },

  // Rot 6 — armadora zaguera centro (z6). Penetra entre z2-3.
  6: {
    system: "5-1",
    rotation: 6,
    setterTarget: { x: 70, y: 14 },
    attackers: ["outside_front", "middle_front", "opposite", "outside_back"],
    slots: [
      { role: "setter", x: 62, y: 28 }, // penetra desde z6
      { role: "middle_front", x: 50, y: 16 }, // z3
      { role: "opposite", x: 84, y: 18 }, // z2
      { role: "outside_front", x: 22, y: 32 }, // sale a z4 (atacante delantera)
      { role: "libero", x: 50, y: 72 }, // z6
      { role: "outside_back", x: 78, y: 72 }, // z1
    ],
  },
};
