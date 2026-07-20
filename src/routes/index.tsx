import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Radio,
  Trophy,
  Users,
  Flame,
  ArrowRight,
  Volleyball,
  Mars,
  Venus,
} from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { TeamBadge } from "@/components/TeamBadge";
import { usePublicData } from "@/lib/use-public-data";
import {
  matchGender,
  setsWon,
  type Match,
  type Team,
  type League,
} from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RALLY · Estadísticas de vóley en vivo" },
      {
        name: "description",
        content:
          "Seguí partidos, ligas, equipos y rankings de vóley en tiempo real. Resultados live, fixture y estadísticas detalladas.",
      },
      { property: "og:title", content: "RALLY · Estadísticas de vóley en vivo" },
      {
        property: "og:description",
        content:
          "Seguí partidos, ligas, equipos y rankings de vóley en tiempo real.",
      },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: PublicHome,
});

type GenderChip = "all" | "F" | "M";

function PublicHome() {
  const { data, isLoading } = usePublicData({ refetchLive: true });
  const teams = data?.teams ?? [];
  const matches = data?.matches ?? [];
  const leagues = data?.leagues ?? [];
  const [gender, setGender] = useState<GenderChip>("all");

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const leagueById = useMemo(
    () => new Map(leagues.map((l) => [l.id, l])),
    [leagues],
  );

  const filtered = useMemo(() => {
    if (gender === "all") return matches;
    return matches.filter((m) => matchGender(m, teamById) === gender);
  }, [matches, gender, teamById]);

  const live = useMemo(
    () =>
      filtered
        .filter((m) => m.status === "live")
        .sort((a, b) => a.scheduledAt - b.scheduledAt),
    [filtered],
  );

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = startOfToday.getTime() + 24 * 60 * 60 * 1000;

  const upcoming = useMemo(
    () =>
      filtered
        .filter((m) => m.status === "scheduled" && m.scheduledAt >= now - 60_000)
        .sort((a, b) => a.scheduledAt - b.scheduledAt),
    [filtered, now],
  );

  const todayScheduled = useMemo(
    () =>
      filtered.filter(
        (m) =>
          m.status === "scheduled" &&
          m.scheduledAt >= startOfToday.getTime() &&
          m.scheduledAt < endOfToday,
      ).length,
    [filtered, startOfToday, endOfToday],
  );

  const recent = useMemo(
    () =>
      filtered
        .filter((m) => m.status === "finished")
        .sort((a, b) => b.createdAt - a.createdAt),
    [filtered],
  );

  const pointsToday = useMemo(() => {
    let total = 0;
    for (const m of matches) {
      if (m.createdAt < startOfToday.getTime()) continue;
      for (const s of m.sets ?? []) total += s.scoreA + s.scoreB;
    }
    return total;
  }, [matches, startOfToday]);

  const stats = [
    { icon: Radio, label: "En vivo", value: live.length, tone: "text-destructive" },
    { icon: Trophy, label: "Ligas", value: leagues.length, tone: "text-primary" },
    { icon: Users, label: "Equipos", value: teams.length, tone: "text-accent" },
    { icon: CalendarDays, label: "Hoy", value: todayScheduled, tone: "text-foreground" },
  ];

  return (
    <PublicShell>
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Compact Hero */}
          <section className="rounded-2xl bg-gradient-surface border border-border/60 px-4 py-4 sm:px-6 sm:py-5 shadow-elevated relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-[0.06] pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">
                  Vóley en vivo, <span className="text-primary">punto a punto</span>.
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Resultados, fixture y estadísticas en tiempo real.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:gap-3 sm:shrink-0">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl bg-background/60 border border-border/60 px-2 py-1.5 sm:px-3 sm:py-2 text-center"
                  >
                    <s.icon className={`size-3.5 mx-auto ${s.tone}`} />
                    <div className="text-base sm:text-lg font-extrabold tabular-nums leading-tight mt-0.5">
                      {s.value}
                    </div>
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Gender chips */}
          <section className="flex flex-wrap items-center gap-2">
            <Chip
              active={gender === "all"}
              onClick={() => setGender("all")}
              icon={<Volleyball className="size-4" />}
              label="Todos"
            />
            <Chip
              active={gender === "F"}
              onClick={() => setGender("F")}
              icon={<Venus className="size-4" />}
              label="Femenino"
            />
            <Chip
              active={gender === "M"}
              onClick={() => setGender("M")}
              icon={<Mars className="size-4" />}
              label="Masculino"
            />
          </section>

          {/* Live matches — hero content */}
          <section>
            <SectionHeader
              icon={<Radio className="size-4 text-destructive animate-pulse" />}
              title="Partidos en vivo"
              count={live.length}
            />
            {live.length === 0 ? (
              <EmptyState text="No hay partidos en vivo ahora mismo." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {live.map((m) => (
                  <LiveMatchCard
                    key={m.id}
                    match={m}
                    teamById={teamById}
                    leagueById={leagueById}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming */}
            <section>
              <SectionHeader
                icon={<CalendarDays className="size-4 text-accent" />}
                title="Próximos partidos"
                count={upcoming.length}
                action={
                  upcoming.length > 3 ? (
                    <Link
                      to="/"
                      hash="calendario"
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Ver calendario <ArrowRight className="size-3" />
                    </Link>
                  ) : null
                }
              />
              {upcoming.length === 0 ? (
                <EmptyState text="No hay partidos programados." />
              ) : (
                <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
                  {upcoming.slice(0, 4).map((m) => (
                    <ScheduledRow
                      key={m.id}
                      match={m}
                      teamById={teamById}
                      leagueById={leagueById}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Recent results — only 3 */}
            <section>
              <SectionHeader
                icon={<Trophy className="size-4 text-primary" />}
                title="Últimos resultados"
                count={recent.length}
                action={
                  recent.length > 3 ? (
                    <Link
                      to="/"
                      hash="historial"
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Ver todos <ArrowRight className="size-3" />
                    </Link>
                  ) : null
                }
              />
              {recent.length === 0 ? (
                <EmptyState text="Aún no hay resultados." />
              ) : (
                <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
                  {recent.slice(0, 3).map((m) => (
                    <ResultRow key={m.id} match={m} teamById={teamById} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Quick stats strip */}
          <section className="rounded-2xl bg-card border border-border/60 px-4 py-3 flex flex-wrap items-center justify-around gap-3 text-xs sm:text-sm">
            <QuickStat icon={<Volleyball className="size-4 text-destructive" />} label="En vivo" value={live.length} />
            <QuickStat icon={<Trophy className="size-4 text-primary" />} label="Ligas" value={leagues.length} />
            <QuickStat icon={<Users className="size-4 text-accent" />} label="Equipos" value={teams.length} />
            <QuickStat icon={<Flame className="size-4 text-orange-400" />} label="Puntos hoy" value={pointsToday} />
          </section>
        </div>
      )}
    </PublicShell>
  );
}

function Chip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-glow"
          : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <h2 className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {icon} {title}
        <span className="text-muted-foreground/70">· {count}</span>
      </h2>
      {action}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="tabular-nums font-extrabold">{value.toLocaleString("es-AR")}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function useElapsed(startedAt: number | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function LiveMatchCard({
  match,
  teamById,
  leagueById,
}: {
  match: Match;
  teamById: Map<string, Team>;
  leagueById: Map<string, League>;
}) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const currentSet = match.sets.find((s) => !s.finished) ?? match.sets.at(-1);
  const w = setsWon(match);
  const league = a?.leagueId ? leagueById.get(a.leagueId) : null;
  const gender = matchGender(match, teamById);
  const serving = match.servingSide;
  const setStart = match.setStartTimes?.[match.currentSet];
  const elapsed = useElapsed(setStart);

  return (
    <Link
      to="/partidos/$id"
      params={{ id: match.id }}
      className="group relative block rounded-2xl bg-card border border-border/60 hover:border-destructive/60 shadow-elevated hover:shadow-glow transition-all overflow-hidden"
    >
      {/* Pulse accent */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-destructive/70 animate-pulse" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/40 bg-background/40">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-destructive">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-destructive" />
          </span>
          En vivo · Set {match.currentSet}
        </span>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {elapsed && <span className="tabular-nums">{elapsed}</span>}
          {gender && (
            <span className="px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">
              {gender === "F" ? "Fem" : "Masc"}
            </span>
          )}
          {league && (
            <span className="truncate max-w-[120px]">{league.name}</span>
          )}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="px-4 py-5">
        <TeamScoreRow
          team={a}
          score={currentSet?.scoreA ?? 0}
          setsWon={w.a}
          serving={serving === "A"}
          leading={(currentSet?.scoreA ?? 0) >= (currentSet?.scoreB ?? 0)}
        />
        <div className="my-2 h-px bg-border/40" />
        <TeamScoreRow
          team={b}
          score={currentSet?.scoreB ?? 0}
          setsWon={w.b}
          serving={serving === "B"}
          leading={(currentSet?.scoreB ?? 0) >= (currentSet?.scoreA ?? 0)}
        />
      </div>

      {/* Footer / CTA */}
      <div className="px-4 py-2.5 border-t border-border/40 bg-background/40 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {serving && (
            <>
              <span className="text-destructive">●</span> Saca{" "}
              {(serving === "A" ? a : b)?.shortName ?? "—"}
            </>
          )}
        </span>
        <span className="text-xs font-bold text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
          Ver partido <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

function TeamScoreRow({
  team,
  score,
  setsWon,
  serving,
  leading,
}: {
  team: Team | undefined;
  score: number;
  setsWon: number;
  serving: boolean;
  leading: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <TeamBadge team={team} size="md" />
      <div className="min-w-0 flex-1">
        <div className="font-bold truncate text-base leading-tight flex items-center gap-1.5">
          {team?.name ?? "—"}
          {serving && (
            <span
              aria-label="Saca"
              title="Saca"
              className="size-2 rounded-full bg-destructive animate-pulse shrink-0"
            />
          )}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Sets ganados · <span className="tabular-nums">{setsWon}</span>
        </div>
      </div>
      <div
        className={`scoreboard-digit tabular-nums font-black text-5xl sm:text-6xl leading-none ${
          leading ? "text-primary" : "text-foreground/70"
        }`}
      >
        {score}
      </div>
    </div>
  );
}

function ScheduledRow({
  match,
  teamById,
  leagueById,
}: {
  match: Match;
  teamById: Map<string, Team>;
  leagueById: Map<string, League>;
}) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const league = a?.leagueId ? leagueById.get(a.leagueId) : null;
  const date = new Date(match.scheduledAt);
  const dateLabel = date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li>
      <Link
        to="/partidos/$id"
        params={{ id: match.id }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="text-xs text-muted-foreground w-16 shrink-0">
          <div className="font-semibold text-foreground capitalize truncate">
            {dateLabel}
          </div>
          <div className="tabular-nums">{timeLabel}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <TeamBadge team={a} size="sm" />
            <span className="font-medium truncate">{a?.shortName ?? "—"}</span>
            <span className="text-muted-foreground text-xs shrink-0">vs</span>
            <span className="font-medium truncate">{b?.shortName ?? "—"}</span>
            <TeamBadge team={b} size="sm" />
          </div>
          {league && (
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5 truncate">
              {league.name}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

function ResultRow({
  match,
  teamById,
}: {
  match: Match;
  teamById: Map<string, Team>;
}) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const w = setsWon(match);
  const aWon = w.a > w.b;
  return (
    <li>
      <Link
        to="/partidos/$id"
        params={{ id: match.id }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <TeamBadge team={a} size="sm" />
        <span
          className={`flex-1 text-sm truncate ${aWon ? "font-bold" : "text-muted-foreground"}`}
        >
          {a?.shortName ?? "—"}
        </span>
        <span className="scoreboard-digit font-bold tabular-nums text-base">
          <span className={aWon ? "text-primary" : ""}>{w.a}</span>
          <span className="text-muted-foreground mx-1">–</span>
          <span className={!aWon ? "text-primary" : ""}>{w.b}</span>
        </span>
        <span
          className={`flex-1 text-right text-sm truncate ${!aWon ? "font-bold" : "text-muted-foreground"}`}
        >
          {b?.shortName ?? "—"}
        </span>
        <TeamBadge team={b} size="sm" />
      </Link>
    </li>
  );
}
