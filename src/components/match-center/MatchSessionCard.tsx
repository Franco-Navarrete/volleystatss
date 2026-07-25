import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Match, Team } from "@/lib/volley-store";
import { useVolley, setsWon } from "@/lib/volley-store";
import type { MatchVideoRow } from "@/hooks/use-match-video";
import { useMatchSessionStore } from "@/lib/match-session/store";
import type { SessionStatus } from "@/lib/match-session/types";
import { SessionStatusBadge } from "@/components/session/SessionStatusBadge";
import {
  Video,
  VideoOff,
  Clock,
  Radio,
  BarChart3,
  MoreVertical,
  Copy,
  Trash2,
  Settings2,
  PlayCircle,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Props {
  match: Match;
  teamA?: Team;
  teamB?: Team;
  video: MatchVideoRow | null;
  competition?: string;
}

function pickStatus(match: Match, video: MatchVideoRow | null, explicit?: SessionStatus): SessionStatus {
  if (explicit) return explicit;
  const finished = match.sets.some((s) => s.finished) && match.status !== "live";
  if (match.status === "live") return "live";
  if (finished && video) return "analysis";
  if (finished) return "finished";
  return "preparation";
}

export function MatchSessionCard({ match, teamA, teamB, video, competition }: Props) {
  const [confirming, setConfirming] = useState(false);
  const explicit = useMatchSessionStore((s) => s.sessions[match.id]?.status);
  const removeSession = useMatchSessionStore((s) => s.remove);
  const removeMatch = useVolley((s) => s.deleteMatch);

  const status = pickStatus(match, video, explicit);
  const { a: setsA, b: setsB } = setsWon(match);
  const actionsCount = match.events.length;
  const ralliesCount = match.events.filter((e) => e.kind === "point").length;
  const dur = video?.duration_sec ? formatDur(video.duration_sec) : "—";

  const videoState = !video ? "sin" : video.sync_offset_ms === 0 ? "linked" : "synced";

  const scoutState =
    actionsCount === 0 ? "idle" : match.sets.some((s) => s.finished) ? "done" : "progress";

  const analysisAvailable = !!video && match.sets.some((s) => s.finished);

  const duplicate = () => toast.info("Duplicar sesión: próximamente");

  const handleDelete = () => {
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3000); return; }
    removeSession(match.id);
    removeMatch(match.id);
    toast.success("Sesión eliminada");
  };

  return (
    <div className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/60 hover:shadow-glow transition-all flex flex-col">
      {/* Top bar: competition + menu */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="truncate">{competition ?? match.category ?? "Match Session"}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-secondary/60" aria-label="Acciones">
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link to="/video/$matchId" params={{ matchId: match.id }}>
                <Settings2 className="size-4 mr-2" /> Administrar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/video/$matchId/live" params={{ matchId: match.id }}>
                <Radio className="size-4 mr-2" /> Continuar en vivo
              </Link>
            </DropdownMenuItem>
            {analysisAvailable && (
              <DropdownMenuItem asChild>
                <Link to="/video/$matchId/analysis" params={{ matchId: match.id }}>
                  <BarChart3 className="size-4 mr-2" /> Abrir análisis
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={duplicate}>
              <Copy className="size-4 mr-2" /> Duplicar sesión
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="size-4 mr-2" /> {confirming ? "Confirmar eliminar" : "Eliminar"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Teams + score */}
      <Link
        to="/video/$matchId"
        params={{ matchId: match.id }}
        className="px-4 pb-3 flex items-center gap-3"
      >
        <TeamCrest team={teamA} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-sm truncate">{teamA?.name ?? "—"}</div>
            <div className="text-lg font-black tabular-nums">{setsA}</div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground my-0.5">vs</div>
          <div className="flex items-center justify-between gap-2">
            <div className="font-bold text-sm truncate">{teamB?.name ?? "—"}</div>
            <div className="text-lg font-black tabular-nums">{setsB}</div>
          </div>
        </div>
        <TeamCrest team={teamB} />
      </Link>

      {/* Meta line */}
      <div className="px-4 py-2 border-t border-border/40 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{new Date(match.scheduledAt).toLocaleDateString()}</span>
        <span>·</span>
        <span>{new Date(match.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        {match.category && (<><span>·</span><span className="truncate">{match.category}</span></>)}
      </div>

      {/* Status chips */}
      <div className="px-4 py-3 border-t border-border/40 flex flex-wrap items-center gap-1.5">
        <SessionStatusBadge status={status} />
        <VideoChip state={videoState} />
        <ScoutChip state={scoutState} />
      </div>

      {/* Metrics */}
      <div className="px-4 py-3 border-t border-border/40 grid grid-cols-3 gap-2 text-center">
        <Metric icon={<ListChecks className="size-3.5" />} label="Acciones" value={actionsCount} />
        <Metric icon={<Radio className="size-3.5" />} label="Rallies" value={ralliesCount} />
        <Metric icon={<Clock className="size-3.5" />} label="Video" value={dur} />
      </div>

      {/* Quick actions */}
      <div className="px-4 py-3 border-t border-border/40 flex items-center gap-2 mt-auto">
        {status === "live" ? (
          <Link to="/video/$matchId/live" params={{ matchId: match.id }} className="flex-1">
            <Button size="sm" variant="destructive" className="w-full gap-1">
              <Radio className="size-3.5 animate-pulse" /> Continuar
            </Button>
          </Link>
        ) : status === "preparation" ? (
          <Link to="/video/$matchId" params={{ matchId: match.id }} className="flex-1">
            <Button size="sm" className="w-full gap-1">
              <PlayCircle className="size-3.5" /> Abrir centro
            </Button>
          </Link>
        ) : analysisAvailable ? (
          <Link to="/video/$matchId/analysis" params={{ matchId: match.id }} className="flex-1">
            <Button size="sm" className="w-full gap-1">
              <BarChart3 className="size-3.5" /> Análisis
            </Button>
          </Link>
        ) : (
          <Link to="/video/$matchId" params={{ matchId: match.id }} className="flex-1">
            <Button size="sm" variant="outline" className="w-full">Abrir</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function TeamCrest({ team }: { team?: Team }) {
  const initials = (team?.name ?? "??").slice(0, 2).toUpperCase();
  return (
    <div
      className="size-11 shrink-0 rounded-lg grid place-items-center font-black text-xs border border-border/60"
      style={{ background: team?.color ? `${team.color}22` : "hsl(var(--muted))", color: team?.color ?? undefined }}
    >
      {initials}
    </div>
  );
}

function VideoChip({ state }: { state: "sin" | "linked" | "synced" }) {
  if (state === "sin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <VideoOff className="size-3" /> Sin video
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
        state === "synced" ? "border-success/50 bg-success/10 text-success" : "border-primary/50 bg-primary/10 text-primary"
      }`}
    >
      <Video className="size-3" /> {state === "synced" ? "Sincronizado" : "Vinculado"}
    </span>
  );
}

function ScoutChip({ state }: { state: "idle" | "progress" | "done" }) {
  const map = {
    idle: { label: "Scout: sin iniciar", cls: "border-border text-muted-foreground" },
    progress: { label: "Scout: en progreso", cls: "border-amber-500/50 bg-amber-500/10 text-amber-500" },
    done: { label: "Scout: finalizado", cls: "border-success/50 bg-success/10 text-success" },
  } as const;
  const { label, cls } = map[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${cls}`}>
      <ListChecks className="size-3" /> {label}
    </span>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}
