// Rally Intelligence — umbrales programáticos usados por los motores.
// Todos ajustables en un solo lugar para calibrar sensibilidad.

export const RULES = {
  attack: {
    /** Mínimo de intentos para evaluar eficiencia. */
    minAttempts: 6,
    /** % eficiencia (kills/intentos) considerada baja. */
    lowEfficiency: 25,
    /** % eficiencia considerada élite. */
    highEfficiency: 45,
    /** Errores de ataque considerados excesivos. */
    highErrors: 6,
  },
  reception: {
    minTotal: 5,
    /** Eficiencia ponderada baja (0-100). */
    lowEfficiency: 40,
    highEfficiency: 65,
  },
  serve: {
    /** Errores de saque considerados altos. */
    highErrors: 5,
    /** Aces considerados destacados. */
    highAces: 3,
  },
  block: {
    highBlocks: 4,
    highErrors: 4,
  },
  setting: {
    /** No hay métrica agregada aún; se usa como placeholder. */
    minSettings: 5,
  },
  rotation: {
    /** Diferencia PF-PC en una rotación considerada crítica. */
    criticalDelta: -3,
    positiveDelta: 3,
  },
} as const;
