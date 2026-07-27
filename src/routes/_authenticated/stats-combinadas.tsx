import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useVolley,
  computeMatchStats,
  computeReceptionStats,
  setsWon,
  type Match,
  type Team,
  type Player,
  type PlayerStat,
  type TeamStat,
  type ReceptionStat,
} from "@/lib/volley-store";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useAllUsersAppState } from "@/hooks/use-all-app-state";
import { useIsAdmin } from "@/hooks/use-auth";
import { useGenderPreference } from "@/hooks/use-gender-preference";
import { getTerminology } from "@/lib/terminology";

export const Route = createFileRoute("/_authenticated/stats-combinadas")({
  head: () => ({ meta: [{ title: "Estadísticas combinadas · RALLY" }] }),
  component: StatsCombinadasPage,
});

type EmptyRec = ReceptionStat;
const emptyRec = (playerId: string): EmptyRec => ({
  playerId,
  doublePositive: 0, positive: 0, neutral: 0,
  negative: 0, doubleNegative: 0, overpass: 0,
  total: 0, positivity: 0, efficiency: 0,
});

const emptyPlayerStat = (playerId: string): PlayerStat => ({
  playerId, name: "", number: 0,
  attack: 0, rotationAttack: 0, counterAttack: 0,
  block: 0, ace: 0, serveError: 0, unforcedError: 0,
  attackError: 0, blockError: 0, total: 0,
});

const emptyTeamStat = (teamId: string): TeamStat => ({
  teamId,
  attack: 0, rotationAttack: 0, counterAttack: 0,
  block: 0, ace: 0, opponentErrors: 0,
  total: 0, unforcedErrors: 0, serveErrors: 0,
  attackErrors: 0, blockErrors: 0,
});

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function StatsCombinadasPage() {
  const localMatches = useVolley((s) => s.matches);
  const localTeams = useVolley((s) => s.teams);
  const localLeagues = useVolley((s) => s.leagues);
  const { isAdmin } = useIsAdmin();
  const adminAll = useAllUsersAppState();
  const { globalGender } = useGenderPreference();
  const t = getTerminology(globalGender);

  const matches = useMemo(() => {
    if (!isAdmin || !adminAll.data) return localMatches;
    const byId = new Map(localMatches.map((m) => [m.id, m]));
    for (const m of adminAll.data.matches) if (!byId.has(m.id)) byId.set(m.id, m);
    return [...byId.values()];
  }, [isAdmin, adminAll.data, localMatches]);

  const teams = useMemo(() => {
    if (!isAdmin || !adminAll.data) return localTeams;
    const byId = new Map(localTeams.map((t) => [t.id, t]));
    for (const t of adminAll.data.teams) if (!byId.has(t.id)) byId.set(t.id, t);
    return [...byId.values()];
  }, [isAdmin, adminAll.data, localTeams]);

  const leagues = useMemo(() => {
    if (!isAdmin || !adminAll.data) return localLeagues;
    const byId = new Map(localLeagues.map((l) => [l.id, l]));
    for (const l of adminAll.data.leagues) if (!byId.has(l.id)) byId.set(l.id, l);
    return [...byId.values()];
  }, [isAdmin, adminAll.data, localLeagues]);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const playerById = useMemo(() => {
    const m = new Map<string, { player: Player; team: Team }>();
    for (const t of teams) for (const p of t.players) m.set(p.id, { player: p, team: t });
    return m;
  }, [teams]);

  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const finished = useMemo(
    () => matches.filter((m) => m.status === "finished").sort((a, b) => b.scheduledAt - a.scheduledAt),
    [matches],
  );

  const availableMatches = useMemo(() => {
    const fromMs = fromDate ? Date.parse(fromDate) : -Infinity;
    const toMs = toDate ? Date.parse(toDate) + 86400000 : Infinity;
    return finished.filter((m) => {
      if (m.scheduledAt < fromMs || m.scheduledAt >= toMs) return false;
      const ta = teamById.get(m.teamAId);
      const tb = teamById.get(m.teamBId);
      if (leagueFilter !== "all") {
        if (ta?.leagueId !== leagueFilter && tb?.leagueId !== leagueFilter) return false;
      }
      if (teamFilter !== "all") {
        if (m.teamAId !== teamFilter && m.teamBId !== teamFilter) return false;
      }
      return true;
    });
  }, [finished, teamById, leagueFilter, teamFilter, fromDate, toDate]);

  const visibleTeams = useMemo(() => {
    if (leagueFilter === "all") return teams;
    return teams.filter((t) => t.leagueId === leagueFilter);
  }, [teams, leagueFilter]);

  const selectedMatches = useMemo(
    () => availableMatches.filter((m) => selectedIds.has(m.id)),
    [availableMatches, selectedIds],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(availableMatches.map((m) => m.id)));
  };
  const clearSel = () => setSelectedIds(new Set());

  // ── Agregación ────────────────────────────────────────────────────────────
  type TeamAgg = TeamStat & { matchesPlayed: number; setsWon: number; matchesWon: number };
  type PlayerAgg = PlayerStat & {
    matchesPlayed: number;
    reception: ReceptionStat;
    perMatch: Array<{ matchId: string; date: number; opponent: string; ps: PlayerStat; rec: ReceptionStat }>;
  };

  const { teamAggs, playerAggs, perMatchBreakdown } = useMemo(() => {
    const tMap = new Map<string, TeamAgg>();
    const pMap = new Map<string, PlayerAgg>();
    const perMatch: Array<{
      match: Match;
      teamAStat: TeamStat;
      teamBStat: TeamStat;
    }> = [];

    const ensureTeam = (id: string): TeamAgg => {
      let a = tMap.get(id);
      if (!a) {
        a = { ...emptyTeamStat(id), matchesPlayed: 0, setsWon: 0, matchesWon: 0 };
        tMap.set(id, a);
      }
      return a;
    };
    const ensurePlayer = (id: string): PlayerAgg => {
      let a = pMap.get(id);
      if (!a) {
        a = { ...emptyPlayerStat(id), matchesPlayed: 0, reception: emptyRec(id), perMatch: [] };
        pMap.set(id, a);
      }
      return a;
    };

    for (const m of selectedMatches) {
      const stats = computeMatchStats(m);
      const rec = computeReceptionStats(m.events);
      const won = setsWon(m);
      const teamA = teamById.get(m.teamAId);
      const teamB = teamById.get(m.teamBId);

      const tA = stats.teams.get(m.teamAId) ?? emptyTeamStat(m.teamAId);
      const tB = stats.teams.get(m.teamBId) ?? emptyTeamStat(m.teamBId);
      perMatch.push({ match: m, teamAStat: tA, teamBStat: tB });

      for (const [teamId, ts] of stats.teams) {
        const a = ensureTeam(teamId);
        a.attack += ts.attack;
        a.rotationAttack += ts.rotationAttack;
        a.counterAttack += ts.counterAttack;
        a.block += ts.block;
        a.ace += ts.ace;
        a.opponentErrors += ts.opponentErrors;
        a.total += ts.total;
        a.unforcedErrors += ts.unforcedErrors;
        a.serveErrors += ts.serveErrors;
        a.attackErrors += ts.attackErrors;
        a.blockErrors += ts.blockErrors;
        a.matchesPlayed++;
        if (teamId === m.teamAId) {
          a.setsWon += won.a;
          if (won.a > won.b) a.matchesWon++;
        } else if (teamId === m.teamBId) {
          a.setsWon += won.b;
          if (won.b > won.a) a.matchesWon++;
        }
      }

      // Asegura ambos equipos aunque no hayan sumado un punto en ese partido
      ensureTeam(m.teamAId);
      ensureTeam(m.teamBId);

      const seenPlayers = new Set<string>();
      for (const ps of stats.players.values()) {
        const a = ensurePlayer(ps.playerId);
        a.attack += ps.attack;
        a.rotationAttack += ps.rotationAttack;
        a.counterAttack += ps.counterAttack;
        a.block += ps.block;
        a.ace += ps.ace;
        a.serveError += ps.serveError;
        a.unforcedError += ps.unforcedError;
        a.attackError += ps.attackError;
        a.blockError += ps.blockError;
        a.total += ps.total;
        seenPlayers.add(ps.playerId);
      }
      for (const rs of rec.values()) {
        const a = ensurePlayer(rs.playerId);
        a.reception.doublePositive += rs.doublePositive;
        a.reception.positive += rs.positive;
        a.reception.neutral += rs.neutral;
        a.reception.negative += rs.negative;
        a.reception.doubleNegative += rs.doubleNegative;
        a.reception.overpass += rs.overpass;
        a.reception.total += rs.total;
        seenPlayers.add(rs.playerId);
      }

      const oppByPlayer = (pid: string) => {
        const info = playerById.get(pid);
        if (!info) return "—";
        const opp = info.team.id === m.teamAId ? teamB : teamA;
        return opp?.shortName ?? opp?.name ?? "—";
      };

      for (const pid of seenPlayers) {
        const a = ensurePlayer(pid);
        a.matchesPlayed++;
        const ps = stats.players.get(pid) ?? emptyPlayerStat(pid);
        const rs = rec.get(pid) ?? emptyRec(pid);
        a.perMatch.push({
          matchId: m.id, date: m.scheduledAt,
          opponent: oppByPlayer(pid), ps, rec: rs,
        });
      }
    }

    // Recalcular positividad/eficiencia agregadas
    for (const a of pMap.values()) {
      const r = a.reception;
      if (r.total > 0) {
        r.positivity = ((r.doublePositive + r.positive) / r.total) * 100;
        const weighted = r.doublePositive * 4 + r.positive * 3 + r.neutral * 2 + r.negative * 1 + r.overpass * -1;
        r.efficiency = (weighted / (r.total * 4)) * 100;
      }
      const info = playerById.get(a.playerId);
      if (info) {
        a.name = info.player.name;
        a.number = info.player.number;
      }
      a.perMatch.sort((x, y) => y.date - x.date);
    }

    const teamAggs = [...tMap.values()].sort((a, b) => b.total - a.total);
    const playerAggs = [...pMap.values()].sort((a, b) => (b.attack + b.block + b.ace) - (a.attack + a.block + a.ace));
    return { teamAggs, playerAggs, perMatchBreakdown: perMatch };
  }, [selectedMatches, teamById, playerById]);

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Layers className="size-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">Estadísticas combinadas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Elegí varios partidos y ver totales acumulados por equipo y por {t.players.toLowerCase().slice(0, -1)}a. Sincronizar la preferencia de sexo con los filtros de cada página para que al cambiar de categoría se actualicen automáticamente los textos y rankings.
            </p>
          </div>
        </header>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Liga</label>
            <Select value={leagueFilter} onValueChange={(v) => { setLeagueFilter(v); setTeamFilter("all"); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {leagues.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}{l.season ? ` · ${l.season}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Equipo</label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {visibleTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Desde</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Hasta</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
          </div>
        </div>

        {/* Lista de partidos */}
        <div className="rounded-xl border border-border/60 bg-card/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Partidos disponibles ({availableMatches.length}) · Seleccionados: {selectedIds.size}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={selectAllVisible}>Seleccionar todos</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSel}>Limpiar</Button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
            {availableMatches.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sin partidos que coincidan con los filtros.</div>
            ) : availableMatches.map((m) => {
              const ta = teamById.get(m.teamAId);
              const tb = teamById.get(m.teamBId);
              const w = setsWon(m);
              const checked = selectedIds.has(m.id);
              return (
                <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/30 cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={() => toggle(m.id)} />
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="truncate font-medium">
                      {ta?.shortName ?? "?"} <span className="text-primary font-bold">{w.a}–{w.b}</span> {tb?.shortName ?? "?"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{fmtDate(m.scheduledAt)}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {selectedMatches.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Seleccioná al menos un partido para ver estadísticas combinadas.
          </div>
        ) : (
          <Tabs defaultValue="teams" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="teams">Equipos</TabsTrigger>
              <TabsTrigger value="players">{t.players}</TabsTrigger>
              <TabsTrigger value="breakdown">Por partido</TabsTrigger>
            </TabsList>

            {/* Equipos */}
            <TabsContent value="teams" className="mt-3">
              <div className="rounded-xl border border-border/60 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-card/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Equipo</th>
                      <th className="text-right px-2 py-2">PJ</th>
                      <th className="text-right px-2 py-2">PG</th>
                      <th className="text-right px-2 py-2">Sets</th>
                      <th className="text-right px-2 py-2">Ptos</th>
                      <th className="text-right px-2 py-2">ATK</th>
                      <th className="text-right px-2 py-2">BLK</th>
                      <th className="text-right px-2 py-2">ACE</th>
                      <th className="text-right px-2 py-2">E.ATK</th>
                      <th className="text-right px-2 py-2">E.BLK</th>
                      <th className="text-right px-2 py-2">E.SAQ</th>
                      <th className="text-right px-2 py-2">E.RIV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {teamAggs.map((a) => {
                      const t = teamById.get(a.teamId);
                      return (
                        <tr key={a.teamId}>
                          <td className="px-3 py-2 font-medium">{t?.name ?? "?"}</td>
                          <td className="text-right px-2 py-2">{a.matchesPlayed}</td>
                          <td className="text-right px-2 py-2">{a.matchesWon}</td>
                          <td className="text-right px-2 py-2">{a.setsWon}</td>
                          <td className="text-right px-2 py-2 font-bold">{a.total}</td>
                          <td className="text-right px-2 py-2">{a.attack}</td>
                          <td className="text-right px-2 py-2">{a.block}</td>
                          <td className="text-right px-2 py-2">{a.ace}</td>
                          <td className="text-right px-2 py-2 text-destructive/80">{a.attackErrors}</td>
                          <td className="text-right px-2 py-2 text-destructive/80">{a.blockErrors}</td>
                          <td className="text-right px-2 py-2 text-destructive/80">{a.serveErrors}</td>
                          <td className="text-right px-2 py-2">{a.opponentErrors}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Jugadoras */}
            <TabsContent value="players" className="mt-3">
              <div className="rounded-xl border border-border/60 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-card/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">#</th>
                      <th className="text-left px-2 py-2">Jugadora</th>
                      <th className="text-left px-2 py-2">Equipo</th>
                      <th className="text-right px-2 py-2">PJ</th>
                      <th className="text-right px-2 py-2">PTS</th>
                      <th className="text-right px-2 py-2">ATK</th>
                      <th className="text-right px-2 py-2">BLK</th>
                      <th className="text-right px-2 py-2">ACE</th>
                      <th className="text-right px-2 py-2">E.ATK</th>
                      <th className="text-right px-2 py-2">E.BLK</th>
                      <th className="text-right px-2 py-2">E.SAQ</th>
                      <th className="text-right px-2 py-2">Rec</th>
                      <th className="text-right px-2 py-2">Efect%</th>
                      <th className="text-right px-2 py-2">Efic%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {playerAggs.map((a) => {
                      const info = playerById.get(a.playerId);
                      const pts = a.attack + a.block + a.ace;
                      return (
                        <tr key={a.playerId}>
                          <td className="px-3 py-2 text-muted-foreground">{info?.player.number ?? "—"}</td>
                          <td className="px-2 py-2 font-medium">{info?.player.name ?? "?"}</td>
                          <td className="px-2 py-2 text-muted-foreground">{info?.team.shortName ?? "—"}</td>
                          <td className="text-right px-2 py-2">{a.matchesPlayed}</td>
                          <td className="text-right px-2 py-2 font-bold">{pts}</td>
                          <td className="text-right px-2 py-2">{a.attack}</td>
                          <td className="text-right px-2 py-2">{a.block}</td>
                          <td className="text-right px-2 py-2">{a.ace}</td>
                          <td className="text-right px-2 py-2 text-destructive/80">{a.attackError}</td>
                          <td className="text-right px-2 py-2 text-destructive/80">{a.blockError}</td>
                          <td className="text-right px-2 py-2 text-destructive/80">{a.serveError}</td>
                          <td className="text-right px-2 py-2">{a.reception.total}</td>
                          <td className="text-right px-2 py-2">{a.reception.total > 0 ? `${a.reception.positivity.toFixed(0)}%` : "—"}</td>
                          <td className="text-right px-2 py-2">{a.reception.total > 0 ? `${a.reception.efficiency.toFixed(0)}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Desglose por partido */}
            <TabsContent value="breakdown" className="mt-3 space-y-4">
              {perMatchBreakdown.map(({ match, teamAStat, teamBStat }) => {
                const ta = teamById.get(match.teamAId);
                const tb = teamById.get(match.teamBId);
                const w = setsWon(match);
                return (
                  <div key={match.id} className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
                      <div className="text-sm font-bold">
                        {ta?.shortName ?? "?"} <span className="text-primary">{w.a}–{w.b}</span> {tb?.shortName ?? "?"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{fmtDate(match.scheduledAt)}</div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-border/40 text-xs">
                      {[
                        { team: ta, stat: teamAStat },
                        { team: tb, stat: teamBStat },
                      ].map(({ team, stat }, i) => (
                        <div key={i} className="p-3 space-y-1">
                          <div className="font-semibold text-sm truncate">{team?.name ?? "?"}</div>
                          <div className="grid grid-cols-3 gap-1 text-[11px]">
                            <div>PTS <span className="font-bold">{stat.total}</span></div>
                            <div>ATK <span className="font-bold">{stat.attack}</span></div>
                            <div>BLK <span className="font-bold">{stat.block}</span></div>
                            <div>ACE <span className="font-bold">{stat.ace}</span></div>
                            <div className="text-destructive/80">E.ATK {stat.attackErrors}</div>
                            <div className="text-destructive/80">E.SAQ {stat.serveErrors}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
