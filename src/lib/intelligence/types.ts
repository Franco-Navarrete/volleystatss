// Rally Intelligence — tipos base compartidos por motores, IA y UI.

export type InsightSeverity = "info" | "positive" | "warning" | "critical";

export type InsightCategory =
  | "attack"
  | "reception"
  | "serve"
  | "setting"
  | "block"
  | "rotation";

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  /** Título corto legible por humanos (ES). */
  title: string;
  /** Explicación breve del hallazgo. */
  detail: string;
  /** Métricas numéricas relevantes (para IA y UI). */
  metrics?: Record<string, number | string>;
  /** Referencia opcional a jugadora / rotación. */
  playerId?: string;
  rotation?: number;
}

export interface EngineContext {
  matchId: string;
  /** Side del equipo analizado (A o B). */
  side: "A" | "B";
}

export interface EngineResult {
  category: InsightCategory;
  insights: Insight[];
}

export interface IntelligenceReport {
  id?: string;
  scope: "match" | "team";
  scopeRef: string;
  title: string;
  insights: Insight[];
  summaryMd: string;
  model?: string;
  createdAt?: number;
}
