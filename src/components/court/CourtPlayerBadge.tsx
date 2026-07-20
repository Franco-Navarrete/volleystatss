import { useEffect, useMemo, useRef, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  PLAYER_POSITION_LABEL,
  type Match,
  type MatchEvent,
  type Player,
  type PointEvent,
  type ReceptionEvent,
  type Team,
} from "@/lib/volley-store";

/* --------------------------- helpers --------------------------- */

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PlayerCourtStats {
  points: number;
  attackKills: number;
  attackAttempts: number;
  effAtk: number;
  blocks: number;
  aces: number;
  recTotal: number;
  recPositive: number;
  effRec: number;
}

function computeStats(events: MatchEvent[], playerId: string): PlayerCourtStats {
  let points = 0,
    attackKills = 0,
    attackAttempts = 0,
    blocks = 0,
    aces = 0,
    recTotal = 0,
    recPositive = 0;
  const ATTACK_TYPES = new Set(["attack", "counter_attack", "rotation_attack"]);
  for (const ev of events) {
    if ("scoringSide" in ev && (ev as PointEvent).playerId === playerId) {
      const pe = ev as PointEvent;
      const isPoint = pe.playerSide === pe.scoringSide;
      if (isPoint) points++;
      if (ATTACK_TYPES.has(pe.type)) {
        attackAttempts++;
        if (isPoint) attackKills++;
      } else if (pe.type === "attack_error") {
        attackAttempts++;
      } else if (pe.type === "block" && isPoint) {
        blocks++;
      } else if (pe.type === "ace" && isPoint) {
        aces++;
      }
    } else if ("kind" in ev) {
      if (ev.kind === "reception" && (ev as ReceptionEvent).playerId === playerId) {
        const r = ev as ReceptionEvent;
        recTotal++;
        if (r.rating === "double_positive" || r.rating === "positive") recPositive++;
      } else if (ev.kind === "attackAttempt" && ev.playerId === playerId) {
        attackAttempts++;
      }
    }
  }
  const effAtk = attackAttempts > 0 ? Math.round((attackKills / attackAttempts) * 100) : 0;
  const effRec = recTotal > 0 ? Math.round((recPositive / recTotal) * 100) : 0;
  return { points, attackKills, attackAttempts, effAtk, blocks, aces, recTotal, recPositive, effRec };
}

type Highlight = "ace" | "attack" | "block" | "reception+" | "defense" | "error" | null;

function classifyHighlight(ev: MatchEvent, playerId: string): Highlight {
  if ("scoringSide" in ev && (ev as PointEvent).playerId === playerId) {
    const pe = ev as PointEvent;
    const isPoint = pe.playerSide === pe.scoringSide;
    if (pe.type === "ace" && isPoint) return "ace";
    if (pe.type === "block" && isPoint) return "block";
    if (isPoint && (pe.type === "attack" || pe.type === "counter_attack" || pe.type === "rotation_attack")) return "attack";
    if (!isPoint) return "error";
  }
  if ("kind" in ev && ev.kind === "reception" && (ev as ReceptionEvent).playerId === playerId) {
    const r = ev as ReceptionEvent;
    if (r.rating === "double_positive" || r.rating === "positive") return "reception+";
  }
  return null;
}

const HIGHLIGHT_STYLE: Record<
  NonNullable<Highlight>,
  { label: string; icon: string; ring: string }
> = {
  ace: { label: "ACE", icon: "⚡", ring: "ring-yellow-300" },
  attack: { label: "PUNTO", icon: "🔥", ring: "ring-emerald-300" },
  block: { label: "BLOQUEO", icon: "🛡", ring: "ring-sky-300" },
  "reception+": { label: "REC +", icon: "✅", ring: "ring-emerald-300" },
  defense: { label: "DEFENSA", icon: "👐", ring: "ring-cyan-300" },
  error: { label: "ERROR", icon: "✕", ring: "ring-rose-400" },
};

/* --------------------------- component --------------------------- */

export interface CourtPlayerBadgeProps {
  player: Player;
  team: Team;
  match: Match;
  isServer?: boolean;
  isLibero?: boolean;
  isReceiverHighlight?: boolean;
  /** Halo pulsante mientras el jugador está seleccionado para registrar acción. */
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  /** Extra classes to control size / positioning of the outer wrapper. */
  className?: string;
  style?: React.CSSProperties;
}

export function CourtPlayerBadge({
  player,
  team,
  match,
  isServer,
  isLibero,
  isReceiverHighlight,
  active,
  dimmed,
  onClick,
  className,
  style,
}: CourtPlayerBadgeProps) {
  const [imgOk, setImgOk] = useState(!!player.photoUrl);
  useEffect(() => {
    setImgOk(!!player.photoUrl);
  }, [player.photoUrl]);

  // Compute last event referring this player and animate on change.
  const lastRelevant = useMemo(() => {
    for (let i = match.events.length - 1; i >= 0; i--) {
      const ev = match.events[i];
      const h = classifyHighlight(ev, player.id);
      if (h) return { id: ev.id, kind: h };
    }
    return null;
  }, [match.events, player.id]);

  const [highlight, setHighlight] = useState<Highlight>(null);
  const lastIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!lastRelevant) return;
    // On mount just remember, don't flash historic highlights.
    if (lastIdRef.current === null) {
      lastIdRef.current = lastRelevant.id;
      return;
    }
    if (lastRelevant.id === lastIdRef.current) return;
    lastIdRef.current = lastRelevant.id;
    setHighlight(lastRelevant.kind);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHighlight(null), 1200);
  }, [lastRelevant]);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const stats = useMemo(() => computeStats(match.events, player.id), [match.events, player.id]);
  const initials = getInitials(player.name);
  const borderColor = team.color;
  const hl = highlight ? HIGHLIGHT_STYLE[highlight] : null;

  return (
    <HoverCard openDelay={180} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          title={`#${player.number} ${player.name}`}
          className={[
            "group relative rounded-full aspect-square overflow-visible",
            "flex items-center justify-center",
            "shadow-lg transition-all active:scale-95",
            "hover:scale-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            active ? "player-active" : "",
            dimmed ? "opacity-40 grayscale" : "",
            className ?? "",
          ].join(" ")}
          style={style}
        >
          {/* Circular avatar (photo or initials) */}
          <span
            className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              background: isLibero ? "#ffffff" : team.color,
              border: `3px solid ${isLibero ? team.color : "rgba(255,255,255,0.9)"}`,
              boxShadow: `0 0 0 2px ${borderColor}`,
            }}
          >
            {player.photoUrl && imgOk ? (
              <img
                src={player.photoUrl}
                alt={player.name}
                loading="lazy"
                onError={() => setImgOk(false)}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <span
                className="scoreboard-digit font-black leading-none text-[clamp(0.75rem,2.6vw,1.5rem)]"
                style={{
                  color: isLibero ? team.color : "#ffffff",
                  textShadow: isLibero
                    ? undefined
                    : "-1px -1px 0 rgba(0,0,0,.55),1px -1px 0 rgba(0,0,0,.55),-1px 1px 0 rgba(0,0,0,.55),1px 1px 0 rgba(0,0,0,.55)",
                }}
              >
                {initials}
              </span>
            )}
          </span>

          {/* Number badge (always visible over the avatar) */}
          <span
            className="absolute -bottom-1 -right-1 min-w-[42%] h-[42%] px-1 rounded-full flex items-center justify-center scoreboard-digit font-black text-[clamp(0.55rem,1.6vw,0.95rem)] leading-none tabular-nums shadow-md"
            style={{
              background: "#111827",
              color: "#ffffff",
              border: `2px solid ${borderColor}`,
            }}
          >
            {player.number}
          </span>

          {/* Server indicator */}
          {isServer && (
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary/70 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary border border-white" />
            </span>
          )}

          {/* Libero marker */}
          {isLibero && (
            <span
              className="absolute -top-1 -left-1 z-10 px-1 rounded-sm text-[8px] font-black uppercase tracking-widest text-white shadow"
              style={{ background: team.color }}
            >
              L
            </span>
          )}

          {/* Receiver highlight ring */}
          {isReceiverHighlight && (
            <span className="absolute -inset-1 rounded-full ring-2 ring-yellow-300 animate-pulse pointer-events-none" />
          )}

          {/* Action highlight */}
          {hl && (
            <>
              <span className={`absolute -inset-1 rounded-full ring-4 ${hl.ring} animate-pulse pointer-events-none`} />
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-full bg-black/85 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap animate-fade-in shadow-lg">
                {hl.icon} {hl.label}
              </span>
            </>
          )}
        </button>
      </HoverCardTrigger>

      <HoverCardContent className="w-64 p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-3 border-b border-border/60" style={{ background: `${team.color}18` }}>
          <div
            className="relative size-14 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
            style={{ background: team.color, border: `2px solid ${team.color}` }}
          >
            {player.photoUrl && imgOk ? (
              <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-lg">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black truncate">{player.name}</div>
            <div className="text-[11px] text-muted-foreground font-semibold">
              #{player.number}
              {player.position ? ` · ${PLAYER_POSITION_LABEL[player.position]}` : ""}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold truncate">
              {team.shortName || team.name}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border/60 text-center">
          <StatCell label="Pts" value={stats.points} />
          <StatCell label="Ataques" value={`${stats.attackKills}/${stats.attackAttempts}`} />
          <StatCell label="Ef. atk" value={`${stats.effAtk}%`} />
          <StatCell label="Bloqueos" value={stats.blocks} />
          <StatCell label="Aces" value={stats.aces} />
          <StatCell label="Ef. rec" value={stats.recTotal ? `${stats.effRec}%` : "–"} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-popover px-2 py-2">
      <div className="scoreboard-digit font-black text-base tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
    </div>
  );
}
