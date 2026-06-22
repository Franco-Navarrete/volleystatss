import { useMemo } from "react";
import {
  type Match,
  type Team,
  type PointEvent,
  type AttackZone,
  isAttackType,
} from "@/lib/volley-store";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
  /** Si se pasa, filtra al set indicado. */
  setNumber?: number;
}

type ZoneKey = "4" | "3" | "2" | "1" | "6" | "5";
const ZONE_KEYS: ZoneKey[] = ["4", "3", "2", "1", "6", "5"];

const ZONE_SHORT_LABEL: Record<ZoneKey, string> = {
  "4": "Punta",
  "3": "Central",
  "2": "Opuesto",
  "1": "Zag. 1",
  "6": "Zag. 6",
  "5": "Zag. 5",
};

function zoneKey(z: AttackZone | "back"): ZoneKey {
  if (z === "back") return "1";
  return String(z) as ZoneKey;
}


interface ZoneStats {
  points: number;
  errors: number;
}

function emptyZoneStats(): Record<ZoneKey, ZoneStats> {
  return { "4": { points: 0, errors: 0 }, "3": { points: 0, errors: 0 }, "2": { points: 0, errors: 0 }, "1": { points: 0, errors: 0 }, "6": { points: 0, errors: 0 }, "5": { points: 0, errors: 0 } };
}

export function AttackZonesPanel({ match, teamA, teamB, setNumber }: Props) {
  const data = useMemo(() => {
    const events = match.events.filter((e): e is PointEvent => "type" in e && (setNumber === undefined || e.setNumber === setNumber));
    const attacks = events.filter((e) => isAttackType(e.type) && e.attackZone !== undefined);
    const errors = events.filter((e) => e.type === "attack_error");

    const byTeam: Record<string, Record<ZoneKey, ZoneStats>> = {
      [teamA.id]: emptyZoneStats(),
      [teamB.id]: emptyZoneStats(),
    };
    const byPlayer = new Map<string, { teamId: string; zones: Record<ZoneKey, ZoneStats> }>();

    for (const ev of attacks) {
      if (!ev.playerSide || ev.attackZone === undefined) continue;
      const teamId = ev.playerSide === "A" ? teamA.id : teamB.id;
      const k = zoneKey(ev.attackZone);
      byTeam[teamId][k].points++;
      if (ev.playerId) {
        const pe = byPlayer.get(ev.playerId) ?? { teamId, zones: emptyZoneStats() };
        pe.zones[k].points++;
        byPlayer.set(ev.playerId, pe);
      }
    }
    // Errores de ataque (sin zona): se suman al total del jugador como "errores" generales.
    for (const ev of errors) {
      if (!ev.playerSide || !ev.playerId) continue;
      const teamId = ev.playerSide === "A" ? teamA.id : teamB.id;
      const pe = byPlayer.get(ev.playerId) ?? { teamId, zones: emptyZoneStats() };
      // Se reparte como "errores sin zona": guardamos en zona "—" virtual sumando a cada? mejor agregar campo aparte.
      // Para simplicidad: ignoramos al desglose por zona (los errores no tienen zona registrada).
      void pe;
    }

    return { byTeam, byPlayer };
  }, [match, teamA.id, teamB.id, setNumber]);

  const teamTotals = (teamId: string) => {
    const z = data.byTeam[teamId];
    const total = ZONE_KEYS.reduce((s, k) => s + z[k].points, 0);
    return { z, total };
  };

  const renderTeam = (team: Team) => {
    const { z, total } = teamTotals(team.id);
    return (
      <div className="rounded-lg border border-border/60 bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="size-3 rounded-full" style={{ background: team.color }} />
          <span className="text-sm font-bold">{team.name}</span>
          <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {total} ataques
          </span>
        </div>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground">Sin ataques con zona registrada.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {ZONE_KEYS.map((k) => {
              const pts = z[k].points;
              const pct = total > 0 ? Math.round((pts / total) * 100) : 0;
              return (
                <div key={k} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    {ZONE_SHORT_LABEL[k]}
                  </div>
                  <div className="scoreboard-digit text-base font-black">{pts}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{pct}%</div>
                </div>
              );
            })}
          </div>

        )}

        {/* Jugadoras del equipo */}
        <PlayerZoneTable team={team} byPlayer={data.byPlayer} />
      </div>
    );
  };

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {renderTeam(teamA)}
      {renderTeam(teamB)}
    </div>
  );
}

function PlayerZoneTable({
  team,
  byPlayer,
}: {
  team: Team;
  byPlayer: Map<string, { teamId: string; zones: Record<ZoneKey, ZoneStats> }>;
}) {
  const rows = team.players
    .map((p) => {
      const entry = byPlayer.get(p.id);
      const zones = entry?.zones ?? emptyZoneStats();
      const total = ZONE_KEYS.reduce((s, k) => s + zones[k].points, 0);
      return { player: p, zones, total };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              <th className="text-left py-1 pr-2">Jugadora</th>
              <th className="text-right px-1">Z4</th>
              <th className="text-right px-1">Z3</th>
              <th className="text-right px-1">Z2</th>
              <th className="text-right px-1">Z1</th>
              <th className="text-right px-1">Z6</th>
              <th className="text-right px-1">Z5</th>
              <th className="text-right pl-2">Tot</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player.id} className="border-t border-border/40">
                <td className="py-1 pr-2 truncate">
                  <span className="scoreboard-digit text-muted-foreground mr-1">#{r.player.number}</span>
                  {r.player.name}
                </td>
                <td className="text-right px-1 tabular-nums">{r.zones["4"].points || ""}</td>
                <td className="text-right px-1 tabular-nums">{r.zones["3"].points || ""}</td>
                <td className="text-right px-1 tabular-nums">{r.zones["2"].points || ""}</td>
                <td className="text-right px-1 tabular-nums">{r.zones["1"].points || ""}</td>
                <td className="text-right px-1 tabular-nums">{r.zones["6"].points || ""}</td>
                <td className="text-right px-1 tabular-nums">{r.zones["5"].points || ""}</td>
                <td className="text-right pl-2 font-bold tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>

      </table>
    </div>
  );
}
