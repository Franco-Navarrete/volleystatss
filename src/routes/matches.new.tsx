import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { useVolley } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus, X } from "lucide-react";

export const Route = createFileRoute("/matches/new")({
  head: () => ({ meta: [{ title: "Nuevo partido · RALLY" }] }),
  component: NewMatch,
});

const LINEUP_SIZE = 6;
type Slot = string | null;
const emptyLineup = (): Slot[] => Array(LINEUP_SIZE).fill(null);

function NewMatch() {
  const navigate = useNavigate();
  const teams = useVolley((s) => s.teams);
  const createMatch = useVolley((s) => s.createMatch);

  const [teamAId, setTeamAId] = useState<string>("");
  const [teamBId, setTeamBId] = useState<string>("");
  const [lineupA, setLineupA] = useState<Slot[]>(emptyLineup);
  const [lineupB, setLineupB] = useState<Slot[]>(emptyLineup);
  const [setsToWin, setSetsToWin] = useState(3);
  const [pointsPerSet, setPointsPerSet] = useState(25);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const teamA = useMemo(() => teams.find((t) => t.id === teamAId), [teams, teamAId]);
  const teamB = useMemo(() => teams.find((t) => t.id === teamBId), [teams, teamBId]);

  const lineupAFull = lineupA.every((x): x is string => !!x);
  const lineupBFull = lineupB.every((x): x is string => !!x);

  const canStart =
    teamAId && teamBId && teamAId !== teamBId &&
    lineupAFull && lineupBFull && !!scheduledAt;

  const assignSlot = (lineup: Slot[], setLineup: (v: Slot[]) => void, slotIdx: number, playerId: string | null) => {
    const next = [...lineup];
    // If player already placed elsewhere, clear that slot first.
    if (playerId) {
      const prev = next.indexOf(playerId);
      if (prev >= 0) next[prev] = null;
    }
    next[slotIdx] = playerId;
    setLineup(next);
  };

  return (
    <AppShell>
      <h1 className="text-3xl font-extrabold mb-1">Nuevo partido</h1>
      <p className="text-muted-foreground text-sm mb-6">Elegí los equipos y asigná cada jugador a su posición en la cancha.</p>

      <div className="grid lg:grid-cols-2 gap-6">
        <TeamPicker label="Equipo local" teams={teams} excludeId={teamBId} selectedId={teamAId} onSelect={(id) => { setTeamAId(id); setLineupA(emptyLineup()); }} />
        <TeamPicker label="Equipo visitante" teams={teams} excludeId={teamAId} selectedId={teamBId} onSelect={(id) => { setTeamBId(id); setLineupB(emptyLineup()); }} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <LineupPicker team={teamA} lineup={lineupA} onAssign={(i, pid) => assignSlot(lineupA, setLineupA, i, pid)} />
        <LineupPicker team={teamB} lineup={lineupB} onAssign={(i, pid) => assignSlot(lineupB, setLineupB, i, pid)} />
      </div>


      <section className="mt-6 rounded-2xl bg-card border border-border/60 p-5 grid sm:grid-cols-3 gap-4">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Fecha y hora</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-background border border-input rounded-md px-3 py-2"
          />
        </label>
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
            const ts = new Date(scheduledAt).getTime();
            const id = createMatch({
              teamAId, teamBId,
              startingLineupA: lineupA,
              startingLineupB: lineupB,
              setsToWin, pointsPerSet,
              scheduledAt: Number.isFinite(ts) ? ts : Date.now(),
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
  // Posiciones de voley (rotación antihoraria 1→6→5→4→3→2→1).
  // Cancha vista desde el banco: arriba la red.
  // Fila delantera: P4 (izq), P3 (centro), P2 (der).
  // Fila trasera:   P5 (izq), P6 (centro), P1 (der, saca).
  const grid: { idx: number; label: string; sub?: string }[][] = [
    [
      { idx: 3, label: "4" }, { idx: 2, label: "3" }, { idx: 1, label: "2" },
    ],
    [
      { idx: 4, label: "5" }, { idx: 5, label: "6" }, { idx: 0, label: "1", sub: "saca" },
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
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="" className="size-7 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className={`size-7 rounded-full scoreboard-digit font-bold flex items-center justify-center text-xs shrink-0 ${active ? "bg-primary-foreground/15" : "bg-background"}`}>{p.number}</span>
                  )}
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
          {lineup.length === LINEUP_SIZE && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Posiciones 1–6 (antihorario)
                </p>
                <p className="text-[10px] text-muted-foreground">↺ 1→6→5→4→3→2→1</p>
              </div>
              <div className="rounded-lg bg-gradient-to-b from-[#1e293b] to-[#0b1322] p-3 border border-court-line/40">
                <div className="text-center text-[9px] uppercase tracking-widest text-muted-foreground mb-1">— red —</div>
                {grid.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-3 gap-2 mb-2 last:mb-0">
                    {row.map(({ idx, label, sub }) => {
                      const pid = lineup[idx];
                      const p = team.players.find((x) => x.id === pid);
                      return (
                        <div key={idx} className="rounded-md bg-background/40 border border-border/40 p-2 text-center relative">
                          <div className="absolute top-1 left-1 text-[9px] scoreboard-digit font-bold text-primary px-1 rounded bg-background/80">P{label}</div>
                          {sub && <div className="absolute top-1 right-1 text-[8px] uppercase tracking-widest text-accent font-bold">{sub}</div>}
                          {p?.photoUrl ? (
                            <img src={p.photoUrl} alt="" className="size-10 mx-auto rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as any]: team.color }} />
                          ) : (
                            <div className="size-10 mx-auto rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-sm" style={{ background: team.color }}>
                              {p?.number}
                            </div>
                          )}
                          <div className="text-[10px] truncate mt-1 font-semibold">#{p?.number} {p?.name}</div>
                          <div className="flex justify-center gap-1 mt-1">
                            <button type="button" title="Rotar atrás" onClick={() => swap(idx, idx === 0 ? lineup.length - 1 : idx - 1)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/70">←</button>
                            <button type="button" title="Rotar adelante" onClick={() => swap(idx, (idx + 1) % lineup.length)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary hover:bg-secondary/70">→</button>
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

