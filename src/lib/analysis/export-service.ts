/**
 * ExportService — arquitectura preparada, sin implementación de FFmpeg.
 * Cada `export*` devuelve una promesa con estado not_implemented para que
 * la UI muestre disponibilidad futura sin bloquear la app.
 */
import type { Clip } from "@/lib/analysis/clip-service";
import type { Playlist } from "@/lib/analysis/playlist-service";

export type ExportTargetKind = "clips" | "playlist" | "report" | "stats";

export interface ExportRequest {
  kind: ExportTargetKind;
  matchId: string;
  format: "mp4" | "webm" | "json" | "csv" | "pdf";
  clips?: Clip[];
  playlist?: Playlist;
  stats?: Record<string, unknown>;
  options?: {
    includeMetadata?: boolean;
    burnInScoreboard?: boolean;
    quality?: "low" | "medium" | "high";
    concatenate?: boolean;
  };
}

export interface ExportResult {
  status: "not_implemented" | "ok" | "error";
  message?: string;
  downloadUrl?: string;
  bytes?: number;
}

async function stub(kind: ExportTargetKind): Promise<ExportResult> {
  return {
    status: "not_implemented",
    message: `Exportación de "${kind}" disponible próximamente. Se generará vía FFmpeg cuando el módulo esté activo.`,
  };
}

export const ExportService = {
  exportClips: (req: ExportRequest) => stub(req.kind),
  exportPlaylist: (req: ExportRequest) => stub(req.kind),
  exportReport: (req: ExportRequest) => stub(req.kind),
  exportStats: (req: ExportRequest) => stub(req.kind),

  /** Serializa la selección a JSON descargable — sí implementado. */
  serializeJson(clips: Clip[]): string {
    return JSON.stringify(
      clips.map((c) => ({
        id: c.id,
        tMs: c.tMs,
        inicioClipMs: c.inicioClipMs,
        finClipMs: c.finClipMs,
        fundamento: c.fundamento,
        result: c.result,
        set: c.setNumber,
        rally: c.rallyId,
        team: c.team,
        player: c.playerName,
        playerNumber: c.playerNumber,
        title: c.title,
        tags: c.meta.tags ?? [],
        favorite: !!c.meta.favorite,
      })),
      null,
      2,
    );
  },
  /** Descarga un blob en el navegador — sí implementado. */
  downloadBlob(filename: string, mime: string, content: string) {
    if (typeof window === "undefined") return;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
