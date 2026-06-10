import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { useVolley, PLAYER_POSITION_LABEL } from "@/lib/volley-store";
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
  const [captainA, setCaptainA] = useState<string>("");
  const [captainB, setCaptainB] = useState<string>("");
  const [liberoA1, setLiberoA1] = useState<string>("");
  const [liberoA2, setLiberoA2] = useState<string>("");
  const [liberoB1, setLiberoB1] = useState<string>("");
  const [liberoB2, setLiberoB2] = useState<string>("");
  const [setsToWin, setSetsToWin] = useState(3);
  const [pointsPerSet, setPointsPerSet] = useState(25);
  const [servingSide, setServingSide] = useState<"A" | "B">("A");
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

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <RolePicker
          team={teamA}
          label="Roles · local"
          captain={captainA} setCaptain={setCaptainA}
          libero1={liberoA1} setLibero1={setLiberoA1}
          libero2={liberoA2} setLibero2={setLiberoA2}
        />
        <RolePicker
          team={teamB}
          label="Roles · visitante"
          captain={captainB} setCaptain={setCaptainB}
          libero1={liberoB1} setLibero1={setLiberoB1}
          libero2={liberoB2} setLibero2={setLiberoB2}
        />
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
              startingLineupA: lineupA.filter((x): x is string => !!x),
              startingLineupB: lineupB.filter((x): x is string => !!x),
              setsToWin, pointsPerSet,
              scheduledAt: Number.isFinite(ts) ? ts : Date.now(),
              captainAId: captainA || null,
              captainBId: captainB || null,
              liberoA1Id: liberoA1 || null,
              liberoA2Id: liberoA2 || null,
              liberoB1Id: liberoB1 || null,
              liberoB2Id: liberoB2 || null,
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
  team, lineup, onAssign,
}: {
  team: ReturnType<typeof useVolley.getState>["teams"][number] | undefined;
  lineup: Slot[];
  onAssign: (slotIdx: number, playerId: string | null) => void;
}) {
  // Posiciones de voley (rotación antihoraria 1→6→5→4→3→2→1).
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
  const filled = lineup.filter(Boolean).length;
  return (
    <section className="rounded-2xl bg-card border border-border/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
          Formación · {team?.shortName ?? "—"}
        </h2>
        <span className="text-xs scoreboard-digit font-bold">
          <span className={filled === LINEUP_SIZE ? "text-success" : "text-primary"}>{filled}</span>
          <span className="text-muted-foreground"> / {LINEUP_SIZE}</span>
        </span>
      </div>
      {!team ? (
        <p className="text-sm text-muted-foreground text-center py-8">Elegí un equipo.</p>
      ) : (
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
                    <SlotCell
                      key={idx}
                      label={label}
                      sub={sub}
                      teamColor={team.color}
                      player={p}
                      players={team.players}
                      takenIds={lineup.filter((x): x is string => !!x && x !== pid)}
                      onPick={(playerId) => onAssign(idx, playerId)}
                      onClear={() => onAssign(idx, null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SlotCell({
  label, sub, teamColor, player, players, takenIds, onPick, onClear,
}: {
  label: string;
  sub?: string;
  teamColor: string;
  player: ReturnType<typeof useVolley.getState>["teams"][number]["players"][number] | undefined;
  players: ReturnType<typeof useVolley.getState>["teams"][number]["players"];
  takenIds: string[];
  onPick: (playerId: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md bg-background/40 border border-border/40 p-2 text-center relative min-h-[92px] flex flex-col">
      <div className="absolute top-1 left-1 text-[9px] scoreboard-digit font-bold text-primary px-1 rounded bg-background/80 z-10">P{label}</div>
      {sub && <div className="absolute top-1 right-1 text-[8px] uppercase tracking-widest text-accent font-bold z-10">{sub}</div>}
      {player && (
        <button
          type="button"
          onClick={onClear}
          title="Quitar jugador"
          className="absolute bottom-1 right-1 text-muted-foreground hover:text-destructive z-10"
        >
          <X className="size-3.5" />
        </button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex-1 flex flex-col items-center justify-center gap-1 w-full rounded hover:bg-background/30 transition-colors pt-3"
          >
            {player ? (
              <>
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt="" className="size-10 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as any]: teamColor }} />
                ) : (
                  <div className="size-10 rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-sm" style={{ background: teamColor }}>
                    {player.number}
                  </div>
                )}
                <div className="text-[10px] truncate max-w-full font-semibold px-1">#{player.number} {player.name}</div>
              </>
            ) : (
              <>
                <div className="size-10 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
                  <Plus className="size-4" />
                </div>
                <div className="text-[10px] text-muted-foreground">Asignar</div>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-1 max-h-72 overflow-y-auto" align="center">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Elegir jugador · P{label}
          </div>
          {players.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">Sin jugadores en el equipo.</p>
          )}
          {players.map((pl) => {
            const taken = takenIds.includes(pl.id);
            const isCurrent = player?.id === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                disabled={taken}
                onClick={() => { onPick(pl.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${isCurrent ? "bg-primary/10" : "hover:bg-secondary"} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {pl.photoUrl ? (
                  <img src={pl.photoUrl} alt="" className="size-7 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="size-7 rounded-full scoreboard-digit font-bold flex items-center justify-center text-xs shrink-0 bg-secondary">{pl.number}</span>
                )}
                <span className="truncate flex-1 flex flex-col">
                  <span className="truncate">#{pl.number} {pl.name}</span>
                  <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    {pl.position ? PLAYER_POSITION_LABEL[pl.position] : "Sin posición"}
                  </span>
                </span>
                {taken && <span className="text-[9px] uppercase text-muted-foreground">en cancha</span>}
                {isCurrent && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RolePicker({
  team, label, captain, setCaptain, libero1, setLibero1, libero2, setLibero2,
}: {
  team: ReturnType<typeof useVolley.getState>["teams"][number] | undefined;
  label: string;
  captain: string; setCaptain: (v: string) => void;
  libero1: string; setLibero1: (v: string) => void;
  libero2: string; setLibero2: (v: string) => void;
}) {
  const players = team?.players ?? [];
  const renderSelect = (value: string, onChange: (v: string) => void, exclude: string[]) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!team}
      className="w-full bg-background border border-input rounded-md px-2 py-2 text-sm disabled:opacity-50"
    >
      <option value="">— Sin asignar —</option>
      {players.map((p) => (
        <option key={p.id} value={p.id} disabled={exclude.includes(p.id)}>
          #{p.number} {p.name}
        </option>
      ))}
    </select>
  );
  return (
    <section className="rounded-2xl bg-card border border-border/60 p-5">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">{label}</h2>
      {!team ? (
        <p className="text-sm text-muted-foreground text-center py-4">Elegí un equipo.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Capitán</span>
            {renderSelect(captain, setCaptain, [])}
          </label>
          <label className="text-sm">
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Líbero 1</span>
            {renderSelect(libero1, setLibero1, [libero2].filter(Boolean))}
          </label>
          <label className="text-sm">
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Líbero 2</span>
            {renderSelect(libero2, setLibero2, [libero1].filter(Boolean))}
          </label>
        </div>
      )}
    </section>
  );
}



