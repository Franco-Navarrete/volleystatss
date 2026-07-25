/**
 * ExportBar — UI para invocar el ExportService.
 * Los exports "grandes" (mp4/pdf) muestran estado "not_implemented" hasta
 * activar FFmpeg. El JSON se descarga sí o sí.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileJson, FileVideo, FileText, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { Clip } from "@/lib/analysis/clip-service";
import { ExportService, type ExportRequest } from "@/lib/analysis/export-service";
import type { Playlist } from "@/lib/analysis/playlist-service";

interface Props {
  matchId: string;
  clips: Clip[];
  playlist?: Playlist | null;
}

export function ExportBar({ matchId, clips, playlist }: Props) {
  const [busy, setBusy] = useState(false);

  const run = async (kind: ExportRequest["kind"], format: ExportRequest["format"]) => {
    setBusy(true);
    try {
      if (format === "json") {
        ExportService.downloadBlob(
          `rally-${kind}-${matchId}.json`,
          "application/json",
          ExportService.serializeJson(clips),
        );
        toast.success(`Descargado ${clips.length} clip(s) en JSON`);
        return;
      }
      const req: ExportRequest = { kind, matchId, format, clips, playlist: playlist ?? undefined };
      const fn =
        kind === "clips"
          ? ExportService.exportClips
          : kind === "playlist"
            ? ExportService.exportPlaylist
            : kind === "report"
              ? ExportService.exportReport
              : ExportService.exportStats;
      const res = await fn(req);
      if (res.status === "ok" && res.downloadUrl) {
        window.open(res.downloadUrl, "_blank");
      } else {
        toast.info(res.message ?? "No implementado todavía");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card/40 border border-border rounded-lg p-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-2">
        Exportar
      </span>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("clips", "json")}>
        <FileJson className="size-3 mr-1" /> Clips (JSON)
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("clips", "mp4")}>
        <FileVideo className="size-3 mr-1" /> Clips (MP4)
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !playlist}
        onClick={() => run("playlist", "mp4")}
      >
        <Download className="size-3 mr-1" /> Playlist activa
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("report", "pdf")}>
        <FileText className="size-3 mr-1" /> Informe PDF
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("stats", "csv")}>
        <BarChart3 className="size-3 mr-1" /> Estadísticas CSV
      </Button>
    </div>
  );
}
