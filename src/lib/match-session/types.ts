/**
 * Match Session — entidad principal que envuelve el ciclo completo de un
 * partido: preparación → vivo → procesando → análisis → finalizado.
 *
 * NO duplica datos: sólo guarda referencias al `matchId` del volley-store,
 * y todos los stores existentes (analysis-store, video-scout-store, etc.)
 * siguen operando por `matchId` como hasta ahora.
 */

export type SessionStatus =
  | "preparation"
  | "live"
  | "processing"
  | "analysis"
  | "finished";

export type SessionVideoKind = "file" | "camera" | "window" | "screen" | "youtube";

export interface SessionVideoHint {
  kind: SessionVideoKind;
  label?: string;
  /** URL de YouTube o nombre de archivo elegido en preparación. */
  ref?: string;
}

export type ProcessingStepId =
  | "sync"
  | "index"
  | "stats"
  | "clips"
  | "analysis";

export interface ProcessingStep {
  id: ProcessingStepId;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

export interface MatchSession {
  /** Coincide 1:1 con el `Match.id` del volley-store. */
  id: string;
  status: SessionStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;

  competition?: string;
  category?: string;
  teamAId: string;
  teamBId: string;

  videoSourceHint?: SessionVideoHint;
  /** Nombre sugerido del archivo local elegido con File System Access API. */
  recordingFileName?: string;

  processing?: ProcessingStep[];
}
