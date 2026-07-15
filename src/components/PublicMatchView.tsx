import { useMemo } from "react";
import { ListOrdered } from "lucide-react";
import {
  currentServer,
  repairOnCourt,
  setsWon,
  type Match,
  type MatchEvent,
  type PointEvent,
  type Team,
  type League,
} from "@/lib/volley-store";

export interface PublicMatchViewProps {
  match: Match;
  teamA: Team;
  teamB: Team;
  league?: League | null;
}

export function PublicMatchView({ match, teamA, teamB, league }: PublicMatchViewProps) {
  const w = setsWon(match);
  const server = currentServer(match);

  return (
    <div className="space-y-6">
      {/* Header / Final */}
      <section className="rounded-3xl bg-gradient-surface border border-border/60 p-6 sm:p-8 shadow-elevated">
        {league && (
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center mb-2">
            {league.name}{league.season ? ` · ${league.season}` : ""}
          </div>
        )}
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center mb-3">
          {match.status === "finished" ? "Resultado final" : match.status === "live" ? "En vivo" : "Próximamente"}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 sm:gap-8 items-center">
          <TeamHeader team={teamA} sets={w.a} highlight={w.a > w.b} align="left" />
          <div className="text-2xl text-muted-foreground font-bold">–</div>
          <TeamHeader team={teamB} sets={w.b} highlight={w.b > w.a} align="right" />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {match.sets.map((s) => (
            <span
              key={s.number}
              className="px-3 py-1.5 rounded-md bg-background/40 border border-border/60 text-xs scoreboard-digit font-bold tabular-nums"
            >
              Set {s.number}: {s.scoreA}–{s.scoreB}
            </span>
          ))}
        </div>
      </section>

      {/* Cancha en vivo */}
      {match.status !== "scheduled" && (
        <PublicCourt
          match={match}
          teamA={teamA}
          teamB={teamB}
          serverSide={server.side}
          serverPlayerId={server.playerId}
        />
      )}

      {/* Punto a punto */}
      <PlayByPlay match={match} teamA={teamA} teamB={teamB} />
    </div>
  );
}

function TeamHeader({
  team, sets, highlight, align,
}: {
  team: Team; sets: number; highlight: boolean; align: "left" | "right";
}) {
  return (
    <div className={`flex items-center gap-4 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div
        className="size-14 rounded-xl flex items-center justify-center font-black text-lg shrink-0 overflow-hidden"
        style={{ background: team.color + "20", color: team.color }}
      >
        {team.logoUrl
          ? <img src={team.logoUrl} alt={team.name} className="size-full object-cover" />
          : team.shortName?.slice(0, 3) || team.name.slice(0, 3)}
      </div>
      <div className="min-w-0">
        <div className="font-bold truncate">{team.name}</div>
        <div className="scoreboard-digit text-5xl font-black mt-1 leading-none">
          <span className={highlight ? "text-primary" : "text-muted-foreground"}>{sets}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Cancha pública (solo lectura) ---------------- */

function PublicCourt({
  match, teamA, teamB, serverSide, serverPlayerId,
}: {
  match: Match; teamA: Team; teamB: Team;
  serverSide: "A" | "B"; serverPlayerId: string | null;
}) {
  // A siempre a la izquierda en la vista pública
  const leftSide: "A" | "B" = "A";
  const rightSide: "A" | "B" = "B";
  const teamFor = (s: "A" | "B") => (s === "A" ? teamA : teamB);
  const columns: Array<{ side: "A" | "B"; team: Team; idxs: number[] }> = [
    { side: leftSide, team: teamFor(leftSide), idxs: [4, 5, 0] },
    { side: leftSide, team: teamFor(leftSide), idxs: [3, 2, 1] },
    { side: rightSide, team: teamFor(rightSide), idxs: [1, 2, 3] },
    { side: rightSide, team: teamFor(rightSide), idxs: [0, 5, 4] },
  ];

  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-4 py-3 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <h3 className="font-bold text-sm uppercase tracking-wider flex-1">En cancha</h3>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: teamA.color }} />
            {teamA.shortName || teamA.name.slice(0, 3)}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: teamB.color }} />
            {teamB.shortName || teamB.name.slice(0, 3)}
          </span>
        </div>
      </header>
      <div className="p-3 sm:p-4">
        <div className="relative rounded-lg md:rounded-xl overflow-hidden min-h-[180px] [@media(max-width:360px)]:min-h-[140px] sm:min-h-[260px] md:min-h-[380px] bg-[#1e5fa8] p-1.5 [@media(max-width:360px)]:p-1 sm:p-5 md:p-7">
          <div className="absolute inset-2 [@media(max-width:360px)]:inset-1.5 sm:inset-5 md:inset-7 bg-[#f4a36a] border-2 border-white rounded-sm" />
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-white pointer-events-none z-10" />
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white z-10" />
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white z-10" />
          <div className="absolute top-0 bottom-0 left-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />
          <div className="absolute top-0 bottom-0 right-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />

          <div className="absolute inset-3 [@media(max-width:360px)]:inset-2 sm:inset-8 md:inset-10 grid grid-cols-4 z-20">
            {columns.map((col, ci) => {
              const onCourt = col.side === "A" ? match.onCourtA : match.onCourtB;
              const serverPid = serverSide === col.side ? serverPlayerId : null;
              const isFront = ci === 1 || ci === 2;
              return (
                <div
                  key={ci}
                  className={`grid grid-rows-3 items-center gap-1 [@media(max-width:360px)]:gap-0.5 sm:gap-3 h-full px-0.5 [@media(max-width:360px)]:px-0 sm:px-2 ${isFront ? "bg-[#ec7a3c]/70" : ""}`}
                >
                  {col.idxs.map((idx) => {
                    const pid = onCourt[idx];
                    const p = col.team.players.find((x) => x.id === pid);
                    const isServer = !!pid && pid === serverPid;
                    const designated = (col.side === "A"
                      ? [match.liberoA1Id, match.liberoA2Id]
                      : [match.liberoB1Id, match.liberoB2Id]
                    ).filter(Boolean) as string[];
                    const isLibero = !!p && (designated.length > 0 ? designated.includes(p.id) : p.position === "libero");
                    return (
                      <div
                        key={`${ci}-${idx}`}
                        className={`relative rounded-full flex flex-col items-center justify-center text-white font-black shadow-md aspect-square mx-auto h-[58%] [@media(max-width:360px)]:h-[48%] sm:h-[72%] overflow-hidden ${isServer ? "ring-2 [@media(max-width:360px)]:ring-1 sm:ring-4 ring-primary" : ""} ${isLibero ? "border-[2px] [@media(max-width:360px)]:border sm:border-[3px] md:border-4" : ""}`}
                        style={isLibero
                          ? { background: "#ffffff", color: col.team.color, borderColor: col.team.color }
                          : { background: col.team.color }}
                        title={p ? `#${p.number} ${p.name}` : ""}
                      >
                        <span className="scoreboard-digit leading-none text-sm [@media(max-width:360px)]:text-xs sm:text-xl md:text-3xl" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{p?.number ?? "?"}</span>
                        {p && (
                          <span className="max-w-[90%] truncate text-[9px] [@media(max-width:360px)]:text-[7px] sm:text-[13px] md:text-[16px] font-bold leading-tight" style={{ textShadow: '-0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000' }}>{p.name}</span>
                        )}
                        {isLibero && (
                          <span className="absolute top-0 left-1/2 -translate-x-1/2 px-1 rounded-b text-[5px] [@media(max-width:360px)]:text-[4px] sm:text-[8px] font-bold uppercase tracking-widest text-white" style={{ background: col.team.color }}>L</span>
                        )}
                        {isServer && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 sm:px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[7px] [@media(max-width:360px)]:text-[5px] sm:text-[8px] font-bold uppercase tracking-widest">Saque</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Punto a punto ---------------- */

interface Rally {
  id: string;
  scoreA: number;
  scoreB: number;
  scoringSide: "A" | "B";
}

function buildRalliesBySet(events: MatchEvent[]): Map<number, Rally[]> {
  const bySet = new Map<number, Rally[]>();
  const tally: Record<number, { a: number; b: number }> = {};
  for (const ev of events) {
    if ((ev as PointEvent).scoringSide === undefined) continue;
    const p = ev as PointEvent;
    const cur = (tally[p.setNumber] ??= { a: 0, b: 0 });
    if (p.scoringSide === "A") cur.a++;
    else cur.b++;
    const arr = bySet.get(p.setNumber) ?? [];
    arr.push({ id: p.id, scoreA: cur.a, scoreB: cur.b, scoringSide: p.scoringSide });
    bySet.set(p.setNumber, arr);
  }
  return bySet;
}

function PlayByPlay({ match, teamA, teamB }: { match: Match; teamA: Team; teamB: Team }) {
  const ralliesBySet = useMemo(() => buildRalliesBySet(match.events), [match.events]);
  const setNumbers = Array.from(ralliesBySet.keys()).sort((a, b) => a - b);
  if (setNumbers.length === 0) {
    return (
      <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
        <header className="px-4 py-3 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
          <ListOrdered className="size-4 text-primary" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Punto a punto</h3>
        </header>
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          Todavía no hay puntos registrados.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-4 py-3 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <ListOrdered className="size-4 text-primary" />
        <h3 className="font-bold text-sm uppercase tracking-wider flex-1">Punto a punto</h3>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: teamA.color }} />
            {teamA.shortName || teamA.name.slice(0, 3)}
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: teamB.color }} />
            {teamB.shortName || teamB.name.slice(0, 3)}
          </span>
        </div>
      </header>
      <div className="divide-y divide-border/40">
        {setNumbers.map((n) => {
          const rallies = ralliesBySet.get(n)!;
          const last = rallies[rallies.length - 1];
          const setMeta = match.sets.find((s) => s.number === n);
          return (
            <details key={n} open={n === match.currentSet || setNumbers.length === 1} className="group">
              <summary className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-secondary/20 select-none">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Set {n}</span>
                <span className="scoreboard-digit font-black text-base tabular-nums">
                  {last.scoreA}–{last.scoreB}
                </span>
                {setMeta?.finished ? (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">final</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest text-success font-bold flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-success animate-pulse" /> en juego
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">{rallies.length} pts</span>
              </summary>
              <ol className="max-h-80 overflow-y-auto">
                {[...rallies].reverse().map((r) => {
                  const aWon = r.scoringSide === "A";
                  return (
                    <li
                      key={r.id}
                      className="px-4 py-1.5 grid grid-cols-[1fr_auto_1fr] items-center text-sm odd:bg-background/40"
                    >
                      <div className="flex items-center justify-end gap-2">
                        {aWon && (
                          <span
                            className="size-2 rounded-full"
                            style={{ background: teamA.color }}
                            aria-label={`Punto ${teamA.name}`}
                          />
                        )}
                        <span
                          className={`scoreboard-digit tabular-nums font-bold ${aWon ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {r.scoreA}
                        </span>
                      </div>
                      <span className="px-2 text-[10px] text-muted-foreground">–</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`scoreboard-digit tabular-nums font-bold ${!aWon ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {r.scoreB}
                        </span>
                        {!aWon && (
                          <span
                            className="size-2 rounded-full"
                            style={{ background: teamB.color }}
                            aria-label={`Punto ${teamB.name}`}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </div>
    </section>
  );
}
