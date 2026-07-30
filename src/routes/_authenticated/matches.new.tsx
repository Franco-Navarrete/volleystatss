import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { useVolley, PLAYER_POSITION_LABEL } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Plus, X, Info } from "lucide-react";
import { useCanCreateMatches } from "@/hooks/use-permissions";
import { useIsAdmin } from "@/hooks/use-auth";
import { useCoachAccess } from "@/hooks/use-coach-access";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/matches/new")({
  head: () => ({ meta: [{ title: "Nuevo partido · RALLY" }] }),
  component: NewMatch,
});

const LINEUP_SIZE = 6;
type Slot = string | null;
const emptyLineup = (): Slot[] => Array(LINEUP_SIZE).fill(null);

function NewMatch() {
  const navigate = useNavigate();
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const matchCategories = useVolley((s) => s.matchCategories);
  const referees = useVolley((s) => s.referees);
  const scorekeepers = useVolley((s) => s.scorekeepers);
  const addMatchCategory = useVolley((s) => s.addMatchCategory);
  const addReferee = useVolley((s) => s.addReferee);
  const addScorekeeper = useVolley((s) => s.addScorekeeper);
  const createMatch = useVolley((s) => s.createMatch);
  const startMatch = useVolley((s) => s.startMatch);
  const { allowed: canCreate, loading: permLoading } = useCanCreateMatches();

  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "M" | "F">("all");
  
  const { isAdmin, user } = useIsAdmin();
  const { hasAccess: isCoach } = useCoachAccess();

  const filteredTeams = useMemo(() => {
    let list = teams;
    
    // Si es Coach, filtramos según la visión Saas
    if (!isAdmin && isCoach) {
      // Mis ligas (basadas en mis equipos)
      const myTeams = teams.filter(t => t.ownerId === user?.id);
      const myLeagueIds = new Set(myTeams.filter(t => t.leagueId).map(t => t.leagueId));
      
      list = list.filter(t => {
        // Mi equipo
        if (t.ownerId === user?.id) return true;
        // Equipo de mi misma liga
        if (t.leagueId && myLeagueIds.has(t.leagueId)) return true;
        return false;
      });
    }
    
    if (leagueFilter !== "all") list = list.filter((t) => t.leagueId === leagueFilter);
    if (genderFilter !== "all") list = list.filter((t) => t.gender === genderFilter);
    return list;
  }, [teams, leagueFilter, genderFilter, isAdmin, isCoach, user?.id]);

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

  // Información oficial del partido
  const [category, setCategory] = useState<string>("");
  const [mainReferee, setMainReferee] = useState<string>("");
  const [secondReferee, setSecondReferee] = useState<string>("");
  const [scorekeeper, setScorekeeper] = useState<string>("");
  

  const teamA = useMemo(() => teams.find((t) => t.id === teamAId), [teams, teamAId]);
  const teamB = useMemo(() => teams.find((t) => t.id === teamBId), [teams, teamBId]);

  const lineupAFull = lineupA.every((x): x is string => !!x);
  const lineupBFull = lineupB.every((x): x is string => !!x);

  const categoryValid = category.trim().length > 0;
  const mainRefValid = mainReferee.trim().length > 0;
  const scorekeeperValid = scorekeeper.trim().length > 0;

  const canStart =
    teamAId && teamBId && teamAId !== teamBId &&
    lineupAFull && lineupBFull && !!scheduledAt &&
    categoryValid && mainRefValid && scorekeeperValid;

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

  if (permLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Verificando permisos…</p>
      </AppShell>
    );
  }
  if (!canCreate) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-16">
          <h1 className="text-lg font-semibold">Sin permiso</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Tu cuenta no tiene habilitado crear partidos. Pedile al administrador que te active el permiso.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link to="/matches">Volver a partidos</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-extrabold mb-1">Nuevo partido</h1>
      <p className="text-muted-foreground text-sm mb-4">Elegí los equipos y asigná cada jugador a su posición en la cancha.</p>

      {leagues.length > 0 && (
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Liga</span>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-card border border-border/60 p-1">
            <button
              type="button"
              onClick={() => { setLeagueFilter("all"); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${leagueFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Todas
            </button>
            {leagues.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setLeagueFilter(l.id);
                  if (l.gender) setGenderFilter(l.gender);
                  const a = teams.find((t) => t.id === teamAId);
                  const b = teams.find((t) => t.id === teamBId);
                  if (a && a.leagueId !== l.id) { setTeamAId(""); setLineupA(emptyLineup()); }
                  if (b && b.leagueId !== l.id) { setTeamBId(""); setLineupB(emptyLineup()); }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${leagueFilter === l.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {l.name}{l.season ? ` · ${l.season}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Género</span>
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-card border border-border/60 p-1">
          {([
            { v: "all" as const, label: "Todos" },
            { v: "F" as const, label: "Femenino" },
            { v: "M" as const, label: "Masculino" },
          ]).map((opt) => {
            const active = genderFilter === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => {
                  setGenderFilter(opt.v);
                  const a = teams.find((t) => t.id === teamAId);
                  const b = teams.find((t) => t.id === teamBId);
                  if (opt.v !== "all") {
                    if (a && a.gender !== opt.v) { setTeamAId(""); setLineupA(emptyLineup()); }
                    if (b && b.gender !== opt.v) { setTeamBId(""); setLineupB(emptyLineup()); }
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>


      <div className="grid lg:grid-cols-2 gap-6">
        <TeamPicker label="Equipo local" teams={filteredTeams} excludeId={teamBId} selectedId={teamAId} onSelect={(id) => { setTeamAId(id); setLineupA(emptyLineup()); }} />
        <TeamPicker label="Equipo visitante" teams={filteredTeams} excludeId={teamAId} selectedId={teamBId} onSelect={(id) => { setTeamBId(id); setLineupB(emptyLineup()); }} />
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

      <section className="mt-6 rounded-2xl bg-card border border-border/60 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info className="size-4 text-primary" />
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            Información del partido
          </h2>
        </div>

        {/* Fila 1: Fecha · Categoría · Sets · Puntos */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FieldLabel label="Fecha y hora" required>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
            />
          </FieldLabel>
          <FieldLabel label="Categoría" required>
            <CategoryPicker
              value={category}
              onChange={setCategory}
              options={matchCategories}
              onAddOption={addMatchCategory}
              invalid={!categoryValid}
            />
          </FieldLabel>
          <FieldLabel label="Sets para ganar" required>
            <select
              value={setsToWin}
              onChange={(e) => setSetsToWin(Number(e.target.value))}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value={2}>Al mejor de 3 (2)</option>
              <option value={3}>Al mejor de 5 (3)</option>
            </select>
          </FieldLabel>
          <FieldLabel label="Puntos por set" required>
            <select
              value={pointsPerSet}
              onChange={(e) => setPointsPerSet(Number(e.target.value))}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value={25}>25 puntos</option>
              <option value={21}>21 puntos</option>
              <option value={15}>15 puntos</option>
            </select>
          </FieldLabel>
        </div>

        {/* Fila 2: Árbitro principal · Segundo · Planillero */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          <FieldLabel label="Árbitro principal" required>
            <AutocompleteInput
              value={mainReferee}
              onChange={setMainReferee}
              options={referees}
              placeholder="Seleccionar o escribir árbitro"
              invalid={!mainRefValid}
              listId="referee-list-main"
            />
          </FieldLabel>
          <FieldLabel label="Segundo árbitro" hint="Opcional">
            <AutocompleteInput
              value={secondReferee}
              onChange={setSecondReferee}
              options={referees}
              placeholder="Segundo árbitro"
              listId="referee-list-second"
            />
          </FieldLabel>
          <FieldLabel label="Planillero" required>
            <AutocompleteInput
              value={scorekeeper}
              onChange={setScorekeeper}
              options={scorekeepers}
              placeholder="Seleccionar planillero"
              invalid={!scorekeeperValid}
              listId="scorekeeper-list"
            />
          </FieldLabel>
        </div>


        {/* Fila 3: Saque inicial · Local · Visitante */}
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <FieldLabel label="Saque inicial">
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as const).map((side) => {
                const t = side === "A" ? teamA : teamB;
                const active = servingSide === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setServingSide(side)}
                    className={`px-2 py-2 rounded-md border-2 text-xs font-semibold truncate transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-border text-muted-foreground"}`}
                  >
                    {t?.shortName ?? (side === "A" ? "Local" : "Visitante")}
                  </button>
                );
              })}
            </div>
          </FieldLabel>
          <FieldLabel label="Equipo local">
            <div className="w-full bg-background/60 border border-border/40 rounded-md px-3 py-2 text-sm truncate">
              {teamA?.name ?? <span className="text-muted-foreground">Sin seleccionar</span>}
            </div>
          </FieldLabel>
          <FieldLabel label="Equipo visitante">
            <div className="w-full bg-background/60 border border-border/40 rounded-md px-3 py-2 text-sm truncate">
              {teamB?.name ?? <span className="text-muted-foreground">Sin seleccionar</span>}
            </div>
          </FieldLabel>
        </div>
      </section>

      <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2">
        {(["scheduled", "live"] as const).map((mode) => (
          <Button
            key={mode}
            size="lg"
            variant={mode === "scheduled" ? "secondary" : "default"}
            disabled={!canStart}
            className={mode === "live" ? "bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow" : ""}
            onClick={() => {
              if (!categoryValid) { toast.error("Elegí una categoría."); return; }
              if (!mainRefValid) { toast.error("Falta el árbitro principal."); return; }
              if (!scorekeeperValid) { toast.error("Falta el planillero."); return; }
              // Auto-registrar nombres nuevos para futuros autocompletados
              addMatchCategory(category);
              addReferee(mainReferee);
              if (secondReferee.trim()) addReferee(secondReferee);
              addScorekeeper(scorekeeper);
              const ts = new Date(scheduledAt).getTime();
              const id = createMatch({
                teamAId, teamBId,
                startingLineupA: lineupA.filter((x): x is string => !!x),
                startingLineupB: lineupB.filter((x): x is string => !!x),
                setsToWin, pointsPerSet,
                initialServingSide: servingSide,
                scheduledAt: Number.isFinite(ts) ? ts : Date.now(),
                captainAId: captainA || null,
                captainBId: captainB || null,
                liberoA1Id: liberoA1 || null,
                liberoA2Id: liberoA2 || null,
                liberoB1Id: liberoB1 || null,
                liberoB2Id: liberoB2 || null,
                category: category.trim(),
                mainRefereeName: mainReferee.trim(),
                secondRefereeName: secondReferee.trim() || undefined,
                scorekeeperName: scorekeeper.trim(),
                
              });
              if (mode === "live") startMatch(id);
              navigate({ to: "/matches/$id", params: { id } });
            }}
          >
            {mode === "scheduled" ? "Crear programado" : "Empezar en vivo"}
          </Button>
        ))}
      </div>
    </AppShell>
  );
}

function FieldLabel({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && <span className="normal-case tracking-normal text-[10px] text-muted-foreground/70 font-normal">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function CategoryPicker({
  value, onChange, options, onAddOption, invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onAddOption: (v: string) => void;
  invalid?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  if (adding) {
    return (
      <div className="flex gap-1">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nueva categoría"
          className="flex-1 bg-background border border-input rounded-md px-2 py-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            const v = draft.trim();
            if (!v) { setAdding(false); return; }
            onAddOption(v);
            onChange(v);
            setDraft("");
            setAdding(false);
          }}
        >
          OK
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(""); }}>
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === "__new__") { setAdding(true); return; }
          onChange(e.target.value);
        }}
        className={`flex-1 bg-background border rounded-md px-2 py-2 text-sm ${invalid ? "border-destructive/60" : "border-input"}`}
      >
        <option value="">— Seleccionar —</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value="__new__">＋ Otra…</option>
      </select>
    </div>
  );
}

function AutocompleteInput({
  value, onChange, options, placeholder, invalid, listId,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  invalid?: boolean;
  listId: string;
}) {
  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-background border rounded-md px-3 py-2 text-sm ${invalid ? "border-destructive/60" : "border-input"}`}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
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
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const addTeam = useVolley((s) => s.addTeam);
  const { user } = useIsAdmin();

  const handleAdd = () => {
    if (!newName.trim()) return;
    const teamId = addTeam({
      name: newName.trim(),
      shortName: newName.trim().substring(0, 3).toUpperCase(),
      color: "#64748b",
      ownerId: user?.id,
    });
    // Create 12 generic players (1-12) as requested: "solo con el numero de camiseta"
    const store = useVolley.getState();
    for (let i = 1; i <= 12; i++) {
      store.addPlayer(teamId, {
        name: `Jugador ${i}`,
        number: i,
      });
    }
    onSelect(teamId);
    setNewName("");
    setIsAdding(false);
    toast.success("Equipo creado con 12 jugadores (1-12)");
  };

  return (
    <section className="rounded-2xl bg-card border border-border/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{label}</h2>
        {!isAdding && (
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => setIsAdding(true)}>
            <Plus className="size-3" />
            Crear rápido
          </Button>
        )}
      </div>

      {isAdding ? (
        <div className="flex gap-2 mb-4">
          <input
            autoFocus
            type="text"
            placeholder="Nombre del equipo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 bg-background border border-input rounded-md px-3 py-1 text-sm"
          />
          <Button size="sm" onClick={handleAdd}>OK</Button>
          <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

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
  const liberoPlayers = players.filter((p) => p.position === "libero");
  const renderSelect = (
    value: string,
    onChange: (v: string) => void,
    exclude: string[],
    list: typeof players,
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!team}
      className="w-full bg-background border border-input rounded-md px-2 py-2 text-sm disabled:opacity-50"
    >
      <option value="">— Sin asignar —</option>
      {list.map((p) => (
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
            {renderSelect(captain, setCaptain, [], players)}
          </label>
          <label className="text-sm">
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Líbero 1</span>
            {renderSelect(libero1, setLibero1, [libero2].filter(Boolean), liberoPlayers)}
          </label>
          <label className="text-sm">
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Líbero 2</span>
            {renderSelect(libero2, setLibero2, [libero1].filter(Boolean), liberoPlayers)}
          </label>
        </div>
      )}
    </section>
  );
}



