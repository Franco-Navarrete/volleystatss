/**
 * tengo este error en partidos que me aparecen en "en vivo" y no me deja eliminarlos. tengo que poder eliminarlos si quiero
 * tiene que poder eliminar partidos en vivo sin problema
 * el usuario "franco.e.navarrete@gmail.com" tiene que ser super admin y poder eliminar, agregar todo lo que quiera sobre cualquier otro usuario registrado


 *
 * en cancha tiene que estar j1,j2,j3,j4,j5,j6
 * 
 * Corregir error de rotación: equipo con menos de 6 jugadores en cancha
 *
 * Existe un error en el módulo de rotaciones.
 *
 * Problema detectado
 * En la captura adjunta, el equipo de la derecha solamente muestra 5 jugadores en cancha, cuando reglamentariamente siempre deben existir 6 jugadores activos.
 * Esto indica que durante el cálculo de la rotación, una sustitución o el cambio de posiciones está eliminando un jugador del renderizado o dejando una posición vacía.
 *
 * Comportamiento esperado
 * El sistema debe garantizar que:
 *  Siempre existan exactamente 6 jugadores visibles en cancha.
 *  Ninguna posición de rotación (1, 2, 3, 4, 5 y 6) quede vacía.
 *  Ningún jugador desaparezca durante una rotación.
 *  Ningún jugador pueda ocupar dos posiciones simultáneamente.
 *  Cada jugador tenga una única posición de rotación y una única posición táctica.
 *
 * Revisar especialmente
 * Analizar toda la lógica de:
 *  Rotación automática.
 *  Cambio de saque.
 *  Aplicación del sistema 5-1.
 *  Sustituciones del líbero.
 *  Renderizado del equipo rival.
 *  Cálculo de posiciones tácticas después del saque.
 *
 * Verificar si en algún punto del flujo:
 *  Se elimina un jugador del array.
 *  Se reemplaza un jugador por null o undefined.
 *  Se filtran jugadores por error.
 *  Existe un conflicto de IDs.
 *  Algún jugador queda oculto por la lógica del render.
 *
 * Validaciones obligatorias
 * Antes de renderizar la cancha, validar:
 * playersOnCourt.length === 6
 *
 * Además:
 *  Todos los IDs deben ser únicos.
 *  Deben existir exactamente las posiciones: 1, 2, 3, 4, 5, 6
 *  No puede haber dos jugadores con la misma posición.
 *  No puede faltar ninguna posición.
 *
 * Si hay un error
 * Si el sistema detecta menos de seis jugadores:
 *  Mostrar un error en consola indicando cuál jugador falta.
 *  Mostrar el estado del array antes y después de la rotación.
 *  Registrar: id del jugador, rol, posición de rotación, posición táctica, estado (titular, líbero o banco)
 *
 * Auditoría de la rotación
 * Agregar un log temporal como el siguiente:
 * ===== ROTACIÓN =====
 * Jugadores en cancha: 5 ❌
 * Posición 1 -> J1
 * Posición 2 -> J2
 * Posición 3 -> J3
 * Posición 4 -> J4
 * Posición 5 -> VACÍA ❌
 * Posición 6 -> J6
 * Jugador perdido: ID: / Nombre: / Rol:
 * ====================
 *
 * Objetivo
 * Refactorizar la lógica de rotaciones para que:
 *  Siempre haya 6 jugadores en cancha.
 *  Nunca desaparezca un jugador al rotar.
 *  Nunca se pierda una posición reglamentaria.
 *  El sistema sea robusto tanto para el equipo local como para el rival, con y sin líbero.
 *  Antes de cada renderizado se valide la integridad de la formación para evitar inconsistencias visuales o de datos.
 *
 * Importante: No aplicar soluciones temporales (por ejemplo, crear un jugador ficticio para completar la formación). El objetivo es encontrar y corregir la causa raíz por la que un jugador deja de formar parte del estado de la cancha.
 */

/**
 * Corregir la lógica de rotación del sistema 5-1.
 *
 * Actualmente solo rota el armador y el resto de los jugadores permanece fijo en sus posiciones. Esto es incorrecto.
 *
 * Implementar la rotación oficial del voleibol:
 *
 *  Al recuperar el saque, los seis jugadores deben rotar una posición en sentido horario.
 *
 *  Cada jugador mantiene su rol original (Armador, Central 1, Central 2, Punta 1, Punta 2 u Opuesto).
 *
 *  Lo único que cambia es la posición (P1–P6).
 *
 *  La visualización debe reconstruirse utilizando la nueva posición de cada jugador.
 *
 * La rotación debe seguir esta secuencia:
 *
 * P1 → P6
 * P6 → P5
 * P5 → P4
 * P4 → P3
 * P3 → P2
 * P2 → P1
 *
 * Después de cada rotación, todos los indicadores (P1, P2, C1, C2, O y Armador) deben desplazarse junto con el jugador correspondiente.
 *
 * No debe existir ninguna lógica especial que deje fijos al C1, C2, Punta 1, Punta 2 u Opuesto. Todos los jugadores rotan exactamente igual que en un partido oficial de voleibol. Solo la posición cambia; el rol del jugador permanece constante.
 */

/**
 * 1. Rol Entrenador (Espacio "Mi Club")
 * Cada usuario con el rol Coach / Entrenador contará con un espacio centralizado llamado "Mi Club" para gestionar su información deportiva.
 * Podrá administrar únicamente la información de los clubes a los que fue asignado.
 * Un entrenador puede estar asignado a: Un club. Varios clubes.
 * El sistema siempre debe respetar esos permisos.
 *
 * 2. Clubes (Módulo Mi Club)
 * Dentro de "Mi Club", el entrenador visualizará únicamente los clubes donde posee permisos.
 * Si solo tiene un club asignado: Seleccionarlo automáticamente.
 * Si tiene varios clubes:
 * Mostrar un selector al ingresar al módulo.
 * Ejemplo:
 * ¿Con qué club desea trabajar?
 * ○ Club Independiente
 * ○ Club Virgen Niña
 * ○ Club Uruguay
 * Una vez seleccionado el club, todas las acciones posteriores deberán realizarse dentro de ese club.
 *
 * 3. Categorías
 * Cada club tendrá sus propias categorías.
 * Ejemplo: Sub 14 Femenino Sub 16 Masculino Primera División Maxi Vóley
 * Las categorías pertenecen al club.
 * Nunca son compartidas entre clubes.
 *
 * 4. Jugadores
 * Cada categoría tendrá su plantel.
 * Cada jugador deberá almacenar como mínimo: Nombre y apellido Número de camiseta Rol Armador Punta Central Opuesto Líbero Mano hábil Fecha de nacimiento (opcional) Altura (opcional)
 * Los roles solamente serán obligatorios para los jugadores del club propio.
 *
 * 5. Equipos rivales
 * El entrenador podrá crear equipos rivales.
 * Para un equipo rival solamente será obligatorio cargar: Nombre del equipo. Números de camiseta de los jugadores. Identificar cuál de ellos es el armador.
 * No será obligatorio cargar: nombres; altura; mano hábil; posiciones.
 *
 * 6. Asignación automática de roles del rival
 * Una vez indicado cuál jugador es el armador, el sistema deberá asignar automáticamente los demás roles.
 * No solicitar los otros roles al usuario.
 * Utilizar siempre el patrón del sistema 5-1:
 * Armador↓Punta↓Central↓Opuesto↓Punta↓Central
 * El sistema deberá detectar automáticamente: Armador Punta 1 Central 1 Opuesto Punta 2 Central 2
 * El usuario nunca deberá ingresar estos datos manualmente.
 *
 * 7. Creación de un partido
 * Al crear un nuevo partido, el sistema debe seguir el siguiente flujo.
 *
 * Paso 1
 * Seleccionar el club.
 * Si el entrenador solo tiene un club asignado:
 * Seleccionarlo automáticamente.
 * Si posee varios clubes:
 * Solicitar cuál utilizar.
 *
 * Paso 2
 * Una vez seleccionado el club:
 * Mostrar únicamente las categorías pertenecientes a ese club.
 * Ejemplo:
 * Club seleccionado
 * Club Virgen Niña
 * Categorías
 * ○ Sub 14
 * ○ Sub 16
 * ○ Sub 18
 * ○ Primera
 * Nunca mostrar categorías de otros clubes.
 *
 * Paso 3
 * Seleccionar la categoría.
 * Automáticamente cargar: jugadores; roles; números; líbero; capitán (si existe).
 *
 * Paso 4
 * Seleccionar el equipo rival.
 * Permitir: elegir uno existente; crear uno nuevo.
 *
 * Paso 5
 * Mostrar una cancha interactiva para ambos equipos.
 * Equipo propio
 * Mostrar los jugadores de la categoría seleccionada.
 * Permitir arrastrarlos a la cancha.
 * Los roles ya existen.
 * No volver a solicitarlos.
 * Equipo rival
 * Mostrar únicamente los números de camiseta.
 * Permitir arrastrarlos a las zonas de la cancha.
 * Luego seleccionar únicamente:
 * ¿Cuál es el armador?
 * A partir de esa información:
 * Ejecutar automáticamente el motor de rotaciones.
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
