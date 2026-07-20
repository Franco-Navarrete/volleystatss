import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Pin } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  PLAYER_POSITION_LABEL,
  SETTING_ATTACK_ZONE_LABEL,
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

const ATTACK_TYPES = new Set(["attack", "counter_attack", "rotation_attack"]);

interface PlayerCourtStats {
  points: number;
  attackKills: number;
  attackAttempts: number;
  attackErrors: number;
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
    attackErrors = 0,
    blocks = 0,
    aces = 0,
    recTotal = 0,
    recPositive = 0;
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
        attackErrors++;
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
  return { points, attackKills, attackAttempts, attackErrors, effAtk, blocks, aces, recTotal, recPositive, effRec };
}

/* --------------------------- highlights (halo/pop) --------------------------- */

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

/* --------------------------- última acción --------------------------- */

const RECEPTION_LABEL: Record<ReceptionEvent["rating"], string> = {
  double_positive: "Recepción #",
  positive: "Recepción +",
  neutral: "Recepción 0",
  negative: "Recepción −",
  double_negative: "Recepción =",
  overpass: "Recepción ≠ (punto rival)",
};

function describeLastAction(events: MatchEvent[], playerId: string): { text: string; tone: "good" | "bad" | "neutral" } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if ("scoringSide" in ev && (ev as PointEvent).playerId === playerId) {
      const pe = ev as PointEvent;
      const isPoint = pe.playerSide === pe.scoringSide;
      switch (pe.type) {
        case "attack":
        case "counter_attack":
        case "rotation_attack":
          return { text: isPoint ? "Ataque · Punto 🔥" : "Ataque defendido", tone: isPoint ? "good" : "neutral" };
        case "attack_error":
          return { text: "Error de ataque", tone: "bad" };
        case "ace":
          return { text: "Ace ⚡", tone: "good" };
        case "serve_error":
          return { text: "Error de saque", tone: "bad" };
        case "block":
          return { text: "Bloqueo 🛡", tone: "good" };
        case "block_error":
          return { text: "Error de bloqueo", tone: "bad" };
        case "unforced_error":
          return { text: "Error no forzado", tone: "bad" };
        default:
          return { text: isPoint ? "Punto" : "Error", tone: isPoint ? "good" : "bad" };
      }
    }
    if ("kind" in ev) {
      if (ev.kind === "reception" && (ev as ReceptionEvent).playerId === playerId) {
        const r = ev as ReceptionEvent;
        const tone = r.rating === "double_positive" || r.rating === "positive" ? "good" : r.rating === "overpass" || r.rating === "double_negative" ? "bad" : "neutral";
        return { text: RECEPTION_LABEL[r.rating], tone };
      }
      if (ev.kind === "attackAttempt" && ev.playerId === playerId) {
        const zone = ev.attackZone ? ` · ${SETTING_ATTACK_ZONE_LABEL[("z" + ev.attackZone) as keyof typeof SETTING_ATTACK_ZONE_LABEL] ?? "Z" + ev.attackZone}` : "";
        return { text: `Ataque continuidad${zone}`, tone: "neutral" };
      }
      if (ev.kind === "setting" && ev.setterId === playerId) {
        return { text: `Armado → ${SETTING_ATTACK_ZONE_LABEL[ev.attackZone] ?? ev.attackZone}`, tone: "neutral" };
      }
    }
  }
  return null;
}

/* --------------------------- match badges --------------------------- */

type BadgeCode = "mvp" | "scorer" | "aces" | "block" | "reception";
const BADGE_META: Record<BadgeCode, { icon: string; label: string; className: string }> = {
  mvp: { icon: "⭐", label: "MVP", className: "bg-amber-500/15 text-amber-300 border-amber-400/30" },
  scorer: { icon: "🔥", label: "Máx anotador", className: "bg-rose-500/15 text-rose-300 border-rose-400/30" },
  aces: { icon: "⚡", label: "Más aces", className: "bg-yellow-500/15 text-yellow-200 border-yellow-400/30" },
  block: { icon: "🛡", label: "Mejor bloqueo", className: "bg-sky-500/15 text-sky-300 border-sky-400/30" },
  reception: { icon: "🎯", label: "Mejor recepción", className: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" },
};

function computeBadges(events: MatchEvent[], playerId: string, teamPlayerIds: string[]): BadgeCode[] {
  const perPlayer = new Map<string, PlayerCourtStats>();
  for (const pid of teamPlayerIds) perPlayer.set(pid, computeStats(events, pid));
  const me = perPlayer.get(playerId);
  if (!me) return [];
  const isLeader = (fn: (s: PlayerCourtStats) => number, min = 1) => {
    const val = fn(me);
    if (val < min) return false;
    for (const [pid, s] of perPlayer) {
      if (pid === playerId) continue;
      if (fn(s) >= val) return false;
    }
    return true;
  };
  const badges: BadgeCode[] = [];
  if (isLeader((s) => s.points, 3)) badges.push("scorer");
  if (isLeader((s) => s.aces, 2)) badges.push("aces");
  if (isLeader((s) => s.blocks, 2)) badges.push("block");
  if (isLeader((s) => (s.recTotal >= 4 ? s.effRec : -1), 60)) badges.push("reception");
  // MVP: kills + aces + blocks combined leader with meaningful volume
  if (isLeader((s) => s.attackKills + s.aces + s.blocks, 6)) badges.unshift("mvp");
  return badges.slice(0, 3);
}

/* --------------------------- contexto del partido --------------------------- */

function buildContext(events: MatchEvent[], playerId: string, currentSet: number, playerSide: "A" | "B"): string[] {
  const notes: string[] = [];
  // Rachas de puntos consecutivos sin error
  let streak = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if ("scoringSide" in ev && (ev as PointEvent).playerId === playerId) {
      const pe = ev as PointEvent;
      const isPoint = pe.playerSide === pe.scoringSide;
      if (isPoint) streak++;
      else break;
    }
  }
  if (streak >= 2) notes.push(`${streak} puntos consecutivos sin error`);

  // Set actual
  const setStats = computeStats(
    events.filter((ev) => ("setNumber" in ev ? ev.setNumber === currentSet : false)),
    playerId,
  );
  if (setStats.points > 0 || setStats.attackAttempts > 0) {
    const eff = setStats.attackAttempts > 0 ? `${setStats.effAtk}% ef.` : "";
    notes.push(`Set ${currentSet}: ${setStats.points} pts${eff ? " · " + eff : ""}`);
  }

  // Participación en últimos rallies (aprox: últimos 3 puntos)
  const lastPoints: PointEvent[] = [];
  for (let i = events.length - 1; i >= 0 && lastPoints.length < 3; i--) {
    const ev = events[i];
    if ("scoringSide" in ev) lastPoints.push(ev as PointEvent);
  }
  const touched = lastPoints.filter((p) => p.playerId === playerId).length;
  if (touched >= 2) notes.push(`Participó en ${touched} de los últimos 3 rallies`);

  // Zona de ataque más frecuente
  const zoneCount = new Map<string, number>();
  for (const ev of events) {
    if ("kind" in ev && ev.kind === "setting" && ev.attackerId === playerId && ev.attackZone) {
      const label = SETTING_ATTACK_ZONE_LABEL[ev.attackZone];
      zoneCount.set(label, (zoneCount.get(label) ?? 0) + 1);
    }
  }
  if (zoneCount.size > 0) {
    const top = [...zoneCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top[1] >= 2) notes.push(`Zona frecuente: ${top[0]}`);
  }

  void playerSide;
  return notes.slice(0, 3);
}

/* --------------------------- tone helpers --------------------------- */

function effTone(eff: number, samples: number): string {
  if (samples < 3) return "text-muted-foreground";
  if (eff >= 45) return "text-emerald-400";
  if (eff >= 25) return "text-amber-300";
  return "text-rose-400";
}

/* --------------------------- component --------------------------- */

export interface CourtPlayerBadgeProps {
  player: Player;
  team: Team;
  match: Match;
  isServer?: boolean;
  isLibero?: boolean;
  isReceiverHighlight?: boolean;
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
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

  const lastRelevant = useMemo(() => {
    for (let i = match.events.length - 1; i >= 0; i--) {
      const ev = match.events[i];
      const h = classifyHighlight(ev, player.id);
      if (h) return { id: ev.id, kind: h };
    }
    return null;
  }, [match.events, player.id]);

  const newestEventId = match.events[match.events.length - 1]?.id ?? null;

  const [highlight, setHighlight] = useState<Highlight>(null);
  const lastIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setHighlight(null);
    };
    if (!lastRelevant) {
      clear();
      return;
    }
    if (newestEventId && newestEventId !== lastRelevant.id) {
      clear();
      lastIdRef.current = lastRelevant.id;
      return;
    }
    if (lastIdRef.current === null) {
      lastIdRef.current = lastRelevant.id;
      return;
    }
    if (lastRelevant.id === lastIdRef.current) return;
    lastIdRef.current = lastRelevant.id;
    setHighlight(lastRelevant.kind);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setHighlight(null);
    }, 1000);
  }, [lastRelevant, newestEventId]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const initials = getInitials(player.name);
  const borderColor = team.color;
  const hl = highlight ? HIGHLIGHT_STYLE[highlight] : null;

  // --- Tooltip pin / open control ---
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = hover || pinned;

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setPinned(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [pinned]);

  const handleContext = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPinned((p) => !p);
  }, []);

  // Whether player is currently the newest actor
  const isLastActor = useMemo(() => {
    if (!newestEventId || !lastRelevant) return false;
    return lastRelevant.id === newestEventId;
  }, [newestEventId, lastRelevant]);

  return (
    <HoverCard open={isOpen} onOpenChange={(o) => setHover(o)} openDelay={120} closeDelay={150}>
      <HoverCardTrigger asChild>

        <button
          type="button"
          ref={triggerRef}
          onClick={onClick}
          onContextMenu={handleContext}
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

          {isServer && (
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary/70 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary border border-white" />
            </span>
          )}

          {isLibero && (
            <span
              className="absolute -top-1 -left-1 z-10 px-1 rounded-sm text-[8px] font-black uppercase tracking-widest text-white shadow"
              style={{ background: team.color }}
            >
              L
            </span>
          )}

          {isReceiverHighlight && (
            <span className="absolute -inset-1 rounded-full ring-2 ring-yellow-300 animate-pulse pointer-events-none" />
          )}

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

      <HoverCardContent
        ref={contentRef}
        side="top"
        sideOffset={10}
        align="center"
        collisionPadding={12}
        avoidCollisions
        className="w-[240px] p-0 overflow-hidden border-border/70 bg-popover/95 backdrop-blur-sm shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <PlayerTooltipContent
          player={player}
          team={team}
          match={match}
          initials={initials}
          imgOk={imgOk}
          isLastActor={isLastActor}
          active={active}
          pinned={pinned}
          onTogglePin={() => setPinned((p) => !p)}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

/* --------------------------- tooltip content --------------------------- */

function PlayerTooltipContent({
  player,
  team,
  match,
  initials,
  imgOk,
  isLastActor,
  active,
  pinned,
  onTogglePin,
}: {
  player: Player;
  team: Team;
  match: Match;
  initials: string;
  imgOk: boolean;
  isLastActor: boolean;
  active?: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const stats = useMemo(() => computeStats(match.events, player.id), [match.events, player.id]);
  const lastAction = useMemo(() => describeLastAction(match.events, player.id), [match.events, player.id]);
  const teamPlayerIds = useMemo(() => team.players.map((p) => p.id), [team]);
  const badges = useMemo(
    () => computeBadges(match.events, player.id, teamPlayerIds),
    [match.events, player.id, teamPlayerIds],
  );
  const playerSide: "A" | "B" = team.id === match.teamAId ? "A" : "B";
  const context = useMemo(
    () => buildContext(match.events, player.id, match.currentSet, playerSide),
    [match.events, player.id, match.currentSet, playerSide],
  );

  type Row = { key: string; icon: string; label: string; value: string; tone?: string };
  const rows: Row[] = [];
  if (stats.attackKills || stats.attackAttempts) {
    rows.push({ key: "atk", icon: "🏐", label: "Ataques", value: `${stats.attackKills}/${stats.attackAttempts}` });
    rows.push({ key: "eff", icon: "📈", label: "Eficiencia", value: `${stats.effAtk}%`, tone: effTone(stats.effAtk, stats.attackAttempts) });
  }
  if (stats.points) rows.push({ key: "pts", icon: "🔥", label: "Puntos", value: String(stats.points) });
  if (stats.aces) rows.push({ key: "ace", icon: "⚡", label: "Aces", value: String(stats.aces) });
  if (stats.blocks) rows.push({ key: "blk", icon: "🛡", label: "Bloqueos", value: String(stats.blocks) });
  if (stats.recTotal) rows.push({ key: "rec", icon: "📥", label: "Recepción", value: `${stats.recPositive}/${stats.recTotal} · ${stats.effRec}%`, tone: effTone(stats.effRec, stats.recTotal) });

  const statusPill =
    active
      ? { text: "🟢 En acción", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" }
      : isLastActor
        ? { text: "🔥 Última acción", cls: "bg-rose-500/15 text-rose-300 border-rose-400/30" }
        : null;

  return (
    <div className="text-[12px]">
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3 py-2 border-b border-border/60"
        style={{ background: `${team.color}1a` }}
      >
        <div
          className="size-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: team.color }}
        >
          {player.photoUrl && imgOk ? (
            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-black text-sm">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black leading-tight truncate">
            #{player.number} · {player.name}
          </div>
          <div className="text-[10px] text-muted-foreground font-semibold truncate">
            {player.position ? PLAYER_POSITION_LABEL[player.position] : "—"} · {team.shortName || team.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onTogglePin}
          className={`shrink-0 size-6 grid place-items-center rounded-md border border-border/60 transition-colors ${
            pinned ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label={pinned ? "Desfijar" : "Fijar"}
          title={pinned ? "Desfijar" : "Fijar (o clic derecho)"}
        >
          <Pin className="size-3" />
        </button>
      </div>

      {/* Status + badges */}
      {(statusPill || badges.length > 0) && (
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {statusPill && (
            <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${statusPill.cls}`}>
              {statusPill.text}
            </span>
          )}
          {badges.map((b) => {
            const meta = BADGE_META[b];
            return (
              <span
                key={b}
                className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide ${meta.className}`}
                title={meta.label}
              >
                {meta.icon} {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Stats — solo no vacías */}
      {rows.length > 0 ? (
        <div className="px-3 py-2 grid grid-cols-1 gap-1">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span aria-hidden>{r.icon}</span>
                {r.label}
              </span>
              <span className={`scoreboard-digit tabular-nums font-black text-[12px] ${r.tone ?? "text-foreground"}`}>
                {r.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 text-[11px] text-muted-foreground italic">Sin acciones registradas aún.</div>
      )}

      {/* Última acción */}
      {lastAction && (
        <div className="px-3 py-2 border-t border-border/60">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Última acción</div>
          <div
            className={`text-[12px] font-bold ${
              lastAction.tone === "good"
                ? "text-emerald-400"
                : lastAction.tone === "bad"
                  ? "text-rose-400"
                  : "text-foreground"
            }`}
          >
            {lastAction.text}
          </div>
        </div>
      )}

      {/* Contexto */}
      {context.length > 0 && (
        <div className="px-3 py-2 border-t border-border/60 space-y-0.5">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Contexto</div>
          {context.map((c, i) => (
            <div key={i} className="text-[11px] text-foreground/90 leading-snug">• {c}</div>
          ))}
        </div>
      )}

      {/* Ver perfil */}
      <Link
        to="/jugadora/$id"
        params={{ id: player.id }}
        className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/60 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
      >
        <span>Ver perfil completo</span>
        <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}
