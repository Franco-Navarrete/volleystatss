/**
 * Preparación: crea el Match en volley-store y la MatchSession asociada.
 * Reusa selectores/estilos existentes (TeamBadge). Deliberadamente delegamos
 * la configuración avanzada (roster/atajos) a las pantallas actuales para no
 * duplicar UI: aquí sólo cubrimos lo mínimo para iniciar el flujo.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { Button } from "@/components/ui/button";
import { useVolley } from "@/lib/volley-store";
import { MatchSessionService } from "@/lib/match-session/services/match-session-service";
import type { SessionVideoKind } from "@/lib/match-session/types";
import { Play, Video, Camera, Monitor, AppWindow, Youtube, Film } from "lucide-react";
import { toast } from "sonner";

export function PreparationView() {
  const navigate = useNavigate();
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const matchCategories = useVolley((s) => s.matchCategories);
  const createMatch = useVolley((s) => s.createMatch);

  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [leagueId, setLeagueId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [videoKind, setVideoKind] = useState<SessionVideoKind>("camera");

  const teamOptions = useMemo(() => teams.filter((t) => t.id), [teams]);
  const canStart = !!teamAId && !!teamBId && teamAId !== teamBId;

  const start = () => {
    if (!canStart) {
      toast.error("Seleccioná los dos equipos.");
      return;
    }
    const matchId = createMatch({
      teamAId,
      teamBId,
      leagueId: leagueId || undefined,
      category: category || undefined,
      scheduledAt: Date.now(),
      setsToWin: 3,
      pointsPerSet: 25,
    });
    MatchSessionService.create({
      matchId,
      teamAId,
      teamBId,
      competition: leagues.find((l) => l.id === leagueId)?.name,
      category: category || undefined,
      videoSourceHint: { kind: videoKind },
    });
    MatchSessionService.setStatus(matchId, "live");
    toast.success("Sesión iniciada");
    navigate({ to: "/session/$id", params: { id: matchId } });
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-1">Nueva sesión de partido</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Preparación → En vivo → Procesando → Análisis → Finalizado. Todo en
          una única sesión.
        </p>

        <section className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Competencia</label>
            <div className="flex gap-2 mt-1">
              <select
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— sin liga —</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— categoría —</option>
                {matchCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <TeamPicker label="Equipo local" value={teamAId} onChange={setTeamAId} teams={teamOptions} />
            <TeamPicker label="Equipo visitante" value={teamBId} onChange={setTeamBId} teams={teamOptions} />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Fuente de video</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
              <VideoOption v="camera" cur={videoKind} onPick={setVideoKind} Icon={Camera} label="Cámara" />
              <VideoOption v="window" cur={videoKind} onPick={setVideoKind} Icon={AppWindow} label="Ventana" />
              <VideoOption v="screen" cur={videoKind} onPick={setVideoKind} Icon={Monitor} label="Pantalla" />
              <VideoOption v="file" cur={videoKind} onPick={setVideoKind} Icon={Film} label="Archivo" />
              <VideoOption v="youtube" cur={videoKind} onPick={setVideoKind} Icon={Youtube} label="YouTube" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <Video className="size-3" /> La fuente concreta se abre desde la vista en vivo.
            </p>
          </div>

          <div className="pt-4">
            <Button
              size="lg"
              disabled={!canStart}
              onClick={start}
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow gap-2"
            >
              <Play className="size-4" /> Iniciar partido
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function TeamPicker({
  label, value, onChange, teams,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  teams: { id: string; name: string; color?: string }[];
}) {
  const sel = teams.find((t) => t.id === value);
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{label}</label>
      <div className="mt-1 rounded-xl border border-border bg-card/40 p-3 flex items-center gap-3">
        <TeamBadge team={sel} size="md" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">— seleccionar —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function VideoOption({
  v, cur, onPick, Icon, label,
}: {
  v: SessionVideoKind;
  cur: SessionVideoKind;
  onPick: (v: SessionVideoKind) => void;
  Icon: typeof Camera;
  label: string;
}) {
  const active = cur === v;
  return (
    <button
      type="button"
      onClick={() => onPick(v)}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card/40 text-muted-foreground hover:border-primary/40"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
