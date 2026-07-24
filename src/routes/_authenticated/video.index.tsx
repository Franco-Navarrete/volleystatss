import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useVolley, setsWon } from "@/lib/volley-store";
import { listMatchVideos, type MatchVideoRow } from "@/hooks/use-match-video";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, Video, VideoOff, Search, Filter, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/video/")({
  head: () => ({
    meta: [
      { title: "Análisis de video — RALLY" },
      { name: "description", content: "Biblioteca de partidos con video sincronizado al scout." },
    ],
  }),
  component: VideoLibrary,
});

function VideoLibrary() {
  const matches = useVolley((s) => s.matches);
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const [videos, setVideos] = useState<MatchVideoRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "synced" | "unsynced" | "none">("all");
  const [onlyFav, setOnlyFav] = useState(false);

  useEffect(() => { void listMatchVideos().then(setVideos); }, []);

  const videoByMatch = useMemo(() => new Map(videos.map((v) => [v.match_id, v] as const)), [videos]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t] as const)), [teams]);
  const leagueById = useMemo(() => new Map(leagues.map((l) => [l.id, l] as const)), [leagues]);

  const rows = useMemo(() => {
    return matches
      .map((m) => {
        const v = videoByMatch.get(m.id) ?? null;
        return { m, v };
      })
      .filter(({ m, v }) => {
        const a = teamById.get(m.teamAId);
        const b = teamById.get(m.teamBId);
        const text = `${a?.name ?? ""} ${b?.name ?? ""} ${m.category ?? ""}`.toLowerCase();
        if (q && !text.includes(q.toLowerCase())) return false;
        if (statusFilter === "synced" && !(v && v.sync_offset_ms !== 0)) return false;
        if (statusFilter === "unsynced" && !(v && v.sync_offset_ms === 0)) return false;
        if (statusFilter === "none" && v) return false;
        if (onlyFav && !v?.favorite) return false;
        return true;
      })
      .sort((x, y) => y.m.scheduledAt - x.m.scheduledAt);
  }, [matches, videoByMatch, teamById, q, statusFilter, onlyFav]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Video className="size-7 text-primary" /> Análisis de video
            </h1>
            <p className="text-muted-foreground text-sm">
              Sincronizá el video del partido con el scout y navegá cada acción con un click.
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 bg-card/40 border border-border rounded-lg p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar equipo, rival o categoría…" className="pl-8" />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Filter className="size-4 text-muted-foreground" />
            {(["all", "synced", "unsynced", "none"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={`px-2 py-1 rounded-md ${statusFilter === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50 text-muted-foreground"}`}
              >
                {k === "all" ? "Todos" : k === "synced" ? "Sincronizados" : k === "unsynced" ? "Sin sincronizar" : "Sin video"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOnlyFav((f) => !f)}
            className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 ${onlyFav ? "bg-primary/20 text-primary" : "hover:bg-secondary/50 text-muted-foreground"}`}
          >
            <Star className={`size-4 ${onlyFav ? "fill-primary text-primary" : ""}`} /> Favoritos
          </button>
        </div>

        {rows.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
            No hay partidos que coincidan con los filtros.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(({ m, v }) => {
            const a = teamById.get(m.teamAId);
            const b = teamById.get(m.teamBId);
            const league = null;
            const { a: setsA, b: setsB } = setsWon(m);
            void league;
            const finished = m.sets.filter((s) => s.finished).length > 0;
            const status = !v ? "Sin video" : v.sync_offset_ms === 0 ? "Sin sincronizar" : "Sincronizado";
            const statusColor = !v ? "bg-muted text-muted-foreground" : v.sync_offset_ms === 0 ? "bg-warning/20 text-warning" : "bg-success/20 text-success";
            const dur = v?.duration_sec ? formatDur(v.duration_sec) : "—";
            return (
              <Link
                key={m.id}
                to="/video/$matchId"
                params={{ matchId: m.id }}
                className="group bg-card border border-border rounded-lg p-4 hover:border-primary/60 hover:shadow-glow transition-all flex flex-col gap-3"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span>{m.category ?? "Sin categoría"}</span>
                  <span className={`px-1.5 py-0.5 rounded ${statusColor}`}>{status}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{a?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">vs {b?.name ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black tabular-nums">{setsA}–{setsB}</div>
                    <div className="text-[10px] text-muted-foreground">{finished ? "Finalizado" : m.status === "live" ? "En vivo" : "Programado"}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{new Date(m.scheduledAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" /> {dur}</span>
                  {v ? <Video className="size-3.5 text-primary" /> : <VideoOff className="size-3.5" />}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground border-t border-border/40 pt-3">
          Tip: en el workspace de cada partido podés subir el video, pegar una URL (HTTPS directa, Bunny, Cloudflare Stream, YouTube),
          marcar el primer saque para sincronizar y navegar cada acción con teclado.
        </div>
      </div>
    </AppShell>
  );
}

function formatDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

