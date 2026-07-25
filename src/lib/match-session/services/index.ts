/**
 * Fachadas: exponen los módulos ya existentes bajo un solo punto de entrada
 * para que consumidores de MatchSession no necesiten conocer paths internos.
 * No se re-implementa nada — sólo se re-exporta.
 */
export { MatchSessionService } from "./match-session-service";
export { ProcessingService } from "./processing-service";

// Video / grabación
export { LiveRecorder } from "@/lib/live-recording";
export * as VideoService from "@/lib/video/providers";

// Datos / análisis
export * as ClipService from "@/lib/analysis/clip-service";
export * as PlaylistService from "@/lib/analysis/playlist-service";
export * as StatisticsService from "@/lib/analysis/statistics-service";
export * as FilterService from "@/lib/analysis/filter-service";
export * as ExportService from "@/lib/analysis/export-service";
export { buildVideoMarks, buildRallyBlocks } from "@/lib/video-marks";
