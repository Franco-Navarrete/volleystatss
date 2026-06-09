import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { useVolley } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/matches/new")({
  head: () => ({ meta: [{ title: "Nuevo partido · RALLY" }] }),
  component: NewMatch,
});

const LINEUP_SIZE = 6;

function NewMatch() {
  const navigate = useNavigate();
  const teams = useVolley((s) => s.teams);
  const createMatch = useVolley((s) => s.createMatch);

  const [teamAId, setTeamAId] = useState<string>("");
  const [teamBId, setTeamBId] = useState<string>("");
  const [lineupA, setLineupA] = useState<string[]>([]);
  const [lineupB, setLineupB] = useState<string[]>([]);
  const [setsToWin, setSetsToWin] = useState(3);
  const [pointsPerSet, setPointsPerSet] = useState(25);
  // Default scheduled date: today + 1h, rounded to local minute.
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const teamA = useMemo(() => teams.find((t) => t.id === teamAId), [teams, teamAId]);
  const teamB = useMemo(() => teams.find((t) => t.id === teamBId), [teams, teamBId]);

  const canStart =
    teamAId && teamBId && teamAId !== teamBId &&
    lineupA.length === LINEUP_SIZE && lineupB.length === LINEUP_SIZE &&
    !!scheduledAt;


  const toggle = (lineup: string[], setLineup: (v: string[]) => void, id: string) => {
    if (lineup.includes(id)) setLineup(lineup.filter((x) => x !== id));
    else if (lineup.length < LINEUP_SIZE) setLineup([...lineup, id]);
  };

  return (
    <AppShell>
      <h1 className="text-3xl font-extrabold mb-1">Nuevo partido</h1>
      <p className="text-muted-foreground text-sm mb-6">Elegí los equipos y la formación inicial (6 jugadores).</p>

      <div className="grid lg:grid-cols-2 gap-6">
        <TeamPicker label="Equipo local" teams={teams} excludeId={teamBId} selectedId={teamAId} onSelect={(id) => { setTeamAId(id); setLineupA([]); }} />
        <TeamPicker label="Equipo visitante" teams={teams} excludeId={teamAId} selectedId={teamBId} onSelect={(id) => { setTeamBId(id); setLineupB([]); }} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <LineupPicker team={teamA} lineup={lineupA} onToggle={(id) => toggle(lineupA, setLineupA, id)} onReorder={setLineupA} />
        <LineupPicker team={teamB} lineup={lineupB} onToggle={(id) => toggle(lineupB, setLineupB, id)} onReorder={setLineupB} />
      </div>

      <section className="mt-6 rounded-2xl bg-card border border-border/60 p-5 grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Sets para ganar</span>
          <select value={setsToWin} onChange={(e) => setSetsToWin(Number(e.target.value))} className="w-full bg-background border border-input rounded-md px-3 py-2">
            <option value={2}>Al mejor de 3 (2)</option>
            <option value={3}>Al mejor de 5 (3)</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Puntos por set</span>
          <select value={pointsPerSet} onChange={(e) => setPointsPerSet(Number(e.target.value))} className="w-full bg-background border border-input rounded-md px-3 py-2">
            <option value={25}>25 puntos</option>
            <option value={21}>21 puntos</option>
            <option value={15}>15 puntos</option>
          </select>
        </label>
      </section>

      <div className="mt-6 flex justify-end">
        <Button
          size="lg"
          disabled={!canStart}
          className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
          onClick={() => {
            const id = createMatch({
              teamAId, teamBId,
              startingLineupA: lineupA,
              startingLineupB: lineupB,
              setsToWin, pointsPerSet,
              scheduledAt: Date.now(),
            });
            navigate({ to: "/matches/$id", params: { id } });
          }}
        >
          Crear partido
        </Button>
      </div>
    </AppShell>
  );
}

function TeamPicker({
  label, teams, excludeId, selectedId, onSelect,
}: {
  label: string;
  teams: ReturnType<typeof useVolley.getState>["teams"];
  excludeId: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/60 p-5">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">{label}</h2>
      <div className="grid grid-cols-2 gap-2">
        {teams.filter((t) => t.id !== excludeId).map((t) => {
          const active = selectedId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${active ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"}`}
            >
              <TeamBadge team={t} size="sm" />
              <span className="font-medium text-sm text-left flex-1 truncate">{t.name}</span>
              {active && <Check className="size-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LineupPicker({
  team, lineup, onToggle, onReorder,
}: {
  team: ReturnType<typeof useVolley.getState>["teams"][number] | undefined;
  lineup: string[];
  onToggle: (id: string) => void;
  onReorder: (next: string[]) => void;
}) {
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= lineup.length) return;
    const next = [...lineup];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  };
  // Court display: front row [pos4, pos3, pos2] = indices [3,2,1]; back row [pos5, pos6, pos1] = [4,5,0]
  const grid: { idx: number; label: string }[][] = [
    [
      { idx: 3, label: "P4" }, { idx: 2, label: "P3" }, { idx: 1, label: "P2" },
    ],
    [
      { idx: 4, label: "P5" }, { idx: 5, label: "P6" }, { idx: 0, label: "P1 (saca)" },
    ],
  ];
  return (
    <section className="rounded-2xl bg-card border border-border/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
          Formación · {team?.shortName ?? "—"}
        </h2>
        <span className="text-xs scoreboard-digit font-bold">
          <span className={lineup.length === LINEUP_SIZE ? "text-success" : "text-primary"}>{lineup.length}</span>
          <span className="text-muted-foreground"> / {LINEUP_SIZE}</span>
        </span>
      </div>
      {!team ? (
        <p className="text-sm text-muted-foreground text-center py-8">Elegí un equipo.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {team.players.map((p) => {
              const active = lineup.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => onToggle(p.id)}
                  disabled={!active && lineup.length >= LINEUP_SIZE}
                  className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-all ${active ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary/40 hover:bg-secondary disabled:opacity-40"}`}
                >
                  <span className={`size-7 rounded scoreboard-digit font-bold flex items-center justify-center text-xs ${active ? "bg-primary-foreground/15" : "bg-background"}`}>{p.number}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
          {lineup.length === LINEUP_SIZE && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                Posicioná a los jugadores en cancha
              </p>
              <div className="rounded-lg bg-gradient-to-b from-[#1e293b] to-[#0b1322] p-3 border border-court-line/40">
                {grid.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-3 gap-2 mb-2 last:mb-0">
                    {row.map(({ idx, label }) => {
                      const pid = lineup[idx];
                      const p = team.players.find((x) => x.id === pid);
                      return (
                        <div key={idx} className="rounded-md bg-background/40 border border-border/40 p-2 text-center">
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</div>
                          <div className="size-9 mx-auto rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-sm" style={{ background: team.color }}>
                            {p?.number}
                          </div>
                          <div className="text-[10px] truncate mt-1">{p?.name}</div>
                          <div className="flex justify-center gap-1 mt-1">
                            <button type="button" onClick={() => swap(idx, idx === 0 ? lineup.length - 1 : idx - 1)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/70">←</button>
                            <button type="button" onClick={() => swap(idx, (idx + 1) % lineup.length)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/70">→</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
