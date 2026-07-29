/**
 * Quiero implementar un sistema inteligente para identificar automáticamente los roles del equipo rival en un partido de voleibol.
 *
 * Objetivo
 * El usuario NO debe ingresar manualmente el rol de todos los jugadores.
 * Solo deberá indicar: Los seis números de camiseta que están en cancha. Qué número corresponde al armador. La ubicación inicial (zonas 1 a 6) de los seis jugadores al comenzar el set.
 * A partir de esa información, el sistema deberá asignar automáticamente el rol del resto de los jugadores.
 *
 * Datos de entrada
 * Ejemplo:
 * Zona 1 → Nº4
 * Zona 2 → Nº12
 * Zona 3 → Nº8
 * Zona 4 → Nº15
 * Zona 5 → Nº6
 * Zona 6 → Nº10
 * Armador: Nº4
 *
 * Regla de asignación
 * El sistema deberá recorrer la rotación en sentido horario comenzando desde el armador.
 * El patrón de roles será siempre:
 * Armador
 * ↓
 * Punta
 * ↓
 * Central
 * ↓
 * Opuesto
 * ↓
 * Punta
 * ↓
 * Central
 * ↓
 * (vuelve al Armador)
 * No se deben solicitar más datos al usuario.
 *
 * Ejemplo
 * Entrada:
 * Zona1 = Nº4
 * Zona2 = Nº12
 * Zona3 = Nº8
 * Zona4 = Nº15
 * Zona5 = Nº6
 * Zona6 = Nº10
 * Armador = Nº4
 *
 * Salida esperada:
 * Número Rol
 * 4 Armador
 * 12 Punta
 * 8 Central
 * 15 Opuesto
 * 6 Punta
 * 10 Central
 *
 * Algoritmo
 * 1. Encontrar la zona donde se encuentra el armador.
 * 2. Recorrer las zonas en sentido horario respetando la rotación del voleibol:
 *    1 → 6 → 5 → 4 → 3 → 2 → 1
 * 3. Asignar los roles siguiendo exactamente este orden:
 *    Armador
 *    Punta
 *    Central
 *    Opuesto
 *    Punta
 *    Central
 * 4. Guardar esa asignación para todo el set.
 * 5. Los roles nunca cambian durante el set.
 * 6. Solo cambia la posición de cada jugador al rotar.
 *
 * Rotaciones automáticas
 * Agregar un botón: Rotó el rival
 * Cuando se presione: Mover todos los jugadores una posición en sentido horario.
 * Ejemplo:
 * Antes
 * Zona1 = 4
 * Zona2 = 12
 * Zona3 = 8
 * Zona4 = 15
 * Zona5 = 6
 * Zona6 = 10
 * Después
 * Zona1 = 12
 * Zona2 = 8
 * Zona3 = 15
 * Zona4 = 6
 * Zona5 = 10
 * Zona6 = 4
 * Los roles NO deben modificarse. Solo cambia la zona donde se encuentra cada jugador.
 *
 * Estructura de datos sugerida
 * Cada jugador debe almacenar:
 * Número
 * Rol
 * Zona actual
 * Fila (Delantero / Zaguero)
 * Puede bloquear (Sí / No)
 * Puede atacar por el centro (Sí / No)
 * Estos datos deben actualizarse automáticamente después de cada rotación.
 *
 * Lógica para el líbero
 * Más adelante el sistema deberá permitir indicar que un central fue reemplazado por el líbero.
 * Cuando esto ocurra:
 * - Mantener el rol original del central.
 * - Marcar que el jugador visible en cancha es el líbero.
 * - Continuar utilizando el rol del central para todas las estadísticas y la lógica de rotación.
 * - No modificar el orden de la rotación.
 *
 * Compatibilidad futura
 * Diseñar este módulo para que pueda utilizarse posteriormente en:
 * - Estadísticas por rotación.
 * - Estadísticas por jugador.
 * - Análisis de K1.
 * - Análisis de K2.
 * - Recepción.
 * - Ataques por zona.
 * - Bloqueos.
 * - Ubicación automática del armador.
 * - Simulación táctica.
 * - Análisis en video sincronizado.
 *
 * Requisitos de implementación
 * - Toda la lógica debe ser automática.
 * - No solicitar el rol de los otros cinco jugadores.
 * - La asignación debe calcularse únicamente a partir del armador y la formación inicial.
 * - La lógica debe ser independiente de los nombres de los jugadores, funcionando también con solo números de camiseta.
 * - El código debe ser modular para reutilizar el motor de rotaciones en otros módulos del sistema.
 * - Crear funciones separadas para:
 *   - Detectar la zona del armador.
 *   - Asignar roles automáticamente.
 *   - Rotar jugadores.
 *   - Obtener la rotación actual (R1 a R6).
 *   - Consultar el rol de cualquier jugador según su número de camiseta.
 *   - Consultar qué jugador ocupa una zona determinada en cualquier momento.
 *
 * Consideración importante
 * Implementar esta lógica solo para sistemas 5-1, pero diseñar la arquitectura de forma que en el futuro sea sencillo agregar soporte para otros sistemas tácticos (por ejemplo, 6-2 o 4-2) sin tener que reescribir el motor de rotaciones.
 * La asignación de roles debe depender de una configuración del sistema táctico y no de valores fijos en el código.
 */




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
import { useGenderPreference } from "@/hooks/use-gender-preference";
import { getTerminology } from "@/lib/terminology";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RALLY · El ecosistema digital del voleibol" },
      {
        name: "description",
        content:
          "Resultados en vivo, estadísticas profesionales, ligas, equipos y jugadores. Todo el voleibol en un solo lugar.",
      },
      { property: "og:title", content: "RALLY · El ecosistema digital del voleibol" },
      {
        property: "og:description",
        content:
          "Explorá el mundo del voleibol con estadísticas en tiempo real y perfiles profesionales.",
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
  const { globalGender, setGlobalGender } = useGenderPreference();
  const [gender, setGender] = useState<GenderChip>(
    globalGender === "femenino" ? "F" : globalGender === "masculino" ? "M" : "all"
  );

  const t = getTerminology(globalGender);

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
        .sort((a, b) => (b.setStartTimes?.[b.currentSet] ?? 0) - (a.setStartTimes?.[a.currentSet] ?? 0)),
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
          <section className="rounded-2xl bg-gradient-surface border border-border/60 px-4 py-4 sm:px-6 sm:py-5 shadow-elevated relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-[0.06] pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 sm:gap-12">
              <div className="flex-1 min-w-0">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tighter">
                  Todo el voleibol en un <span className="text-primary">solo lugar</span>.
                </h1>
                <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl">
                  Seguí tus ligas, equipos y {t.players.toLowerCase()} favorit{globalGender === "femenino" ? "as" : "os"} con estadísticas profesionales en tiempo real. 
                  Explorá el ecosistema digital del voleibol.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    to="/"
                    hash="vivo"
                    className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center shadow-glow hover:opacity-90 transition-all text-base"
                  >
                    Ver partidos en vivo
                  </Link>
                  <Link
                    to="/ligas"
                    className="h-12 px-8 rounded-xl bg-secondary text-secondary-foreground border border-border/60 font-bold flex items-center justify-center hover:bg-secondary/80 transition-all text-base"
                  >
                    Explorar ligas
                  </Link>
                  <Link
                    to="/auth"
                    className="h-12 px-8 rounded-xl bg-background border border-border/60 font-bold flex items-center justify-center hover:bg-secondary/20 transition-all text-base"
                  >
                    Crear cuenta gratuita
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:shrink-0 lg:max-w-md w-full">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl bg-background/60 border border-border/60 px-4 py-4 text-center backdrop-blur-sm flex flex-col items-center justify-center min-h-[100px]"
                  >
                    <s.icon className={`size-5 sm:size-6 mb-2 ${s.tone}`} />
                    <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none">
                      {s.value}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-2">
                      {s.label}
                    </div>
                  </div>
                ))}
                <div className="rounded-xl bg-background/60 border border-border/60 px-4 py-4 text-center backdrop-blur-sm flex flex-col items-center justify-center min-h-[100px]">
                  <Flame className="size-5 sm:size-6 mb-2 text-orange-500" />
                  <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none">
                    {pointsToday}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-2">
                    Puntos Hoy
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-2">
            <Chip
              active={gender === "all"}
              onClick={() => {
                setGender("all");
                setGlobalGender("mixto");
              }}
              icon={<Volleyball className="size-4" />}
              label="Todos"
            />
            <Chip
              active={gender === "F"}
              onClick={() => {
                setGender("F");
                setGlobalGender("femenino");
              }}
              icon={<Venus className="size-4" />}
              label="Femenino"
            />
            <Chip
              active={gender === "M"}
              onClick={() => {
                setGender("M");
                setGlobalGender("masculino");
              }}
              icon={<Mars className="size-4" />}
              label="Masculino"
            />
          </section>

          <section id="vivo">
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

function Chip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
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

function SectionHeader({ icon, title, count, action }: { icon: React.ReactNode; title: string; count: number; action?: React.ReactNode }) {
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

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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

function LiveMatchCard({ match, teamById, leagueById }: { match: Match; teamById: Map<string, Team>; leagueById: Map<string, League> }) {
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
      className="group relative block rounded-2xl bg-card border border-border/60 hover:border-destructive/60 shadow-elevated hover:shadow-glow transition-all overflow-hidden animate-in fade-in duration-500"
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-destructive/70 animate-pulse" />
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
          {gender && <span className="px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">{gender === "F" ? "Fem" : "Masc"}</span>}
          {league && <span className="truncate max-w-[120px]">{league.name}</span>}
        </div>
      </div>
      <div className="px-4 py-5">
        <TeamScoreRow team={a} score={currentSet?.scoreA ?? 0} setsWon={w.a} serving={serving === "A"} leading={(currentSet?.scoreA ?? 0) >= (currentSet?.scoreB ?? 0)} />
        <div className="my-2 h-px bg-border/40" />
        <TeamScoreRow team={b} score={currentSet?.scoreB ?? 0} setsWon={w.b} serving={serving === "B"} leading={(currentSet?.scoreB ?? 0) >= (currentSet?.scoreA ?? 0)} />
      </div>
      <div className="px-4 py-2.5 border-t border-border/40 bg-background/40 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {serving && <> <span className="text-destructive">●</span> Saca {(serving === "A" ? a : b)?.shortName ?? "—"} </>}
        </span>
        <span className="text-xs font-bold text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">Ver partido <ArrowRight className="size-3.5" /></span>
      </div>
    </Link>
  );
}

function TeamScoreRow({ team, score, setsWon, serving, leading }: { team?: Team; score: number; setsWon: number; serving: boolean; leading: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <TeamBadge team={team} size="sm" />
        <span className={`text-sm font-bold truncate ${leading ? "text-foreground" : "text-muted-foreground"}`}>{team?.name ?? "—"}</span>
        {serving && <div className="size-1.5 rounded-full bg-destructive shadow-glow-destructive" />}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`size-1.5 rounded-full ${i < setsWon ? "bg-primary shadow-glow" : "bg-border"}`} />
          ))}
        </div>
        <div className={`text-2xl font-black tabular-nums scoreboard-digit ${leading ? "text-primary" : "text-muted-foreground/60"}`}>{score}</div>
      </div>
    </div>
  );
}

function ScheduledRow({ match, teamById, leagueById }: { match: Match; teamById: Map<string, Team>; leagueById: Map<string, League> }) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const league = a?.leagueId ? leagueById.get(a.leagueId) : null;
  const date = new Date(match.scheduledAt);
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  return (
    <li className="p-3 sm:p-4 hover:bg-secondary/30 transition-colors">
      <Link to="/partidos/$id" params={{ id: match.id }} className="flex items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center gap-2 justify-end min-w-0">
            <span className="text-xs font-bold truncate text-right">{a?.shortName ?? "—"}</span>
            <TeamBadge team={a} size="sm" />
          </div>
          <div className="px-2 py-0.5 rounded bg-secondary/50 text-[10px] font-bold tabular-nums">VS</div>
          <div className="flex items-center gap-2 min-w-0">
            <TeamBadge team={b} size="sm" />
            <span className="text-xs font-bold truncate">{b?.shortName ?? "—"}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-bold tabular-nums">{time}</div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold truncate max-w-[80px]">{league?.name ?? "Amistoso"}</div>
        </div>
      </Link>
    </li>
  );
}

function ResultRow({ match, teamById }: { match: Match; teamById: Map<string, Team> }) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const w = setsWon(match);
  return (
    <li className="p-3 sm:p-4 hover:bg-secondary/30 transition-colors">
      <Link to="/partidos/$id" params={{ id: match.id }} className="flex items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center gap-2 justify-end min-w-0">
            <span className={`text-xs font-bold truncate text-right ${w.a > w.b ? "text-foreground" : "text-muted-foreground"}`}>{a?.shortName ?? "—"}</span>
            <TeamBadge team={a} size="sm" />
          </div>
          <div className="text-xs font-black tabular-nums bg-secondary/50 px-2.5 py-1 rounded-md">{w.a}–{w.b}</div>
          <div className="flex items-center gap-2 min-w-0">
            <TeamBadge team={b} size="sm" />
            <span className={`text-xs font-bold truncate ${w.b > w.a ? "text-foreground" : "text-muted-foreground"}`}>{b?.shortName ?? "—"}</span>
          </div>
        </div>
        <ArrowRight className="size-3.5 text-muted-foreground/40" />
      </Link>
    </li>
  );
}
