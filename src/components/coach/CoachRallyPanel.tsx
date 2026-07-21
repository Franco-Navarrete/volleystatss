import { useMemo } from "react";
import { X, ChevronLeft, Undo2 } from "lucide-react";
import type { Match, Team } from "@/lib/volley-store";
import {
  useCoachRally,
  RATING_ORDER,
  RATING_MEANING,
  STATE_LABEL,
  FLOW_STATES,
  type Rating,
  type RallyState,
} from "@/lib/coach/rally-machine";
import { useCoachMode } from "@/lib/coach-mode-store";
import { playerLabel, getEffectiveOnCourt } from "@/lib/coach/effective-lineup";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
}

/**
 * Panel único de Coach Mode: motor de estados guiado.
 * Todo el flujo del rally (Saque → Recepción → Armado → Ataque → ...) vive
 * dentro de este panel flotante. No abre ventanas ni modales adicionales.
 */
export function CoachRallyPanel({ match, teamA, teamB }: Props) {
  const enabled = useCoachMode((s) => s.enabled);
  const state = useCoachRally((s) => s.state);
  const current = useCoachRally((s) => s.current);
  const history = useCoachRally((s) => s.history);
  const outcome = useCoachRally((s) => s.outcome);
  const setPlayer = useCoachRally((s) => s.setPlayer);
  const setOrigin = useCoachRally((s) => s.setOrigin);
  const setTarget = useCoachRally((s) => s.setTarget);
  const setRating = useCoachRally((s) => s.setRating);
  const back = useCoachRally((s) => s.back);
  const cancel = useCoachRally((s) => s.cancel);
  const reset = useCoachRally((s) => s.reset);

  const teams = useMemo(() => ({ A: teamA, B: teamB }), [teamA, teamB]);

  if (!enabled || state === "idle") return null;

  const activeSide = current?.side ?? outcome?.scoringSide ?? "A";
  const activeTeam = teams[activeSide];
  const otherTeam = teams[activeSide === "A" ? "B" : "A"];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9998] w-[min(680px,96vw)] pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <div className="rounded-2xl border-2 border-primary/40 bg-background/98 backdrop-blur shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <header className="flex items-center justify-between gap-2 bg-primary text-primary-foreground px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-[10px] uppercase tracking-widest opacity-80">Coach Mode</span>
            <span className="opacity-60">·</span>
            <span>{activeTeam.name}</span>
            <span className="opacity-60">·</span>
            <span className="uppercase text-xs">{STATE_LABEL[state]}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={back} className="p-1 rounded hover:bg-primary-foreground/20" title="Volver (⌫)">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={cancel} className="p-1 rounded hover:bg-primary-foreground/20" title="Cancelar (Esc)">
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Progress bar */}
        <StateProgress current={state} history={history} />

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-0">
          {/* Paso actual */}
          <section className="p-4 min-h-[220px]">
            {state === "fin" ? (
              <FinPanel outcome={outcome} scoringTeam={teams[outcome?.scoringSide ?? "A"]} onNew={reset} />
            ) : current ? (
              <StepView
                current={current}
                match={match}
                teams={teams}
                onPlayer={setPlayer}
                onOrigin={setOrigin}
                onTarget={setTarget}
                onRating={setRating}
              />
            ) : null}
          </section>

          {/* Resumen lateral */}
          <aside className="border-t md:border-t-0 md:border-l bg-muted/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Resumen del rally</div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {history.length === 0 && (
                <div className="text-xs text-muted-foreground italic">Sin acciones registradas.</div>
              )}
              {history.map((h, i) => (
                <div key={i} className="text-xs bg-background rounded-md px-2 py-1.5 border">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-primary uppercase text-[10px]">{STATE_LABEL[h.state]}</span>
                    <span className="font-mono text-[11px] font-bold">{h.rating ?? "?"}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {playerLabel(teams[h.side], h.playerId)}
                    {h.origin ? ` · O:Z${h.origin}` : ""}
                    {h.target ? ` · D:Z${h.target}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <footer className="px-3 py-1.5 border-t bg-muted/50 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <kbd className="rounded bg-background border px-1 font-mono">Esc</kbd> cancelar
            <kbd className="rounded bg-background border px-1 font-mono">⌫</kbd> volver
            <kbd className="rounded bg-background border px-1 font-mono">Ctrl+Z</kbd> deshacer
          </span>
          <span className="uppercase font-bold">vs {otherTeam.name}</span>
        </footer>
      </div>
    </div>
  );
}

function StateProgress({ current, history }: { current: RallyState; history: { state: RallyState }[] }) {
  const done = new Set(history.map((h) => h.state));
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/20 overflow-x-auto">
      {FLOW_STATES.map((s, i) => {
        const isActive = s === current;
        const isDone = done.has(s) && !isActive;
        return (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div
              className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-primary/20 text-primary"
                    : "bg-transparent text-muted-foreground/60"
              }`}
            >
              {s === "recepcion" ? "REC" : s === "contraataque" ? "C-ATK" : STATE_LABEL[s].slice(0, 4)}
            </div>
            {i < FLOW_STATES.length - 1 && <span className="text-muted-foreground/40 text-[10px]">›</span>}
          </div>
        );
      })}
    </div>
  );
}

interface StepViewProps {
  current: NonNullable<ReturnType<typeof useCoachRally.getState>["current"]>;
  match: Match;
  teams: { A: Team; B: Team };
  onPlayer: (id: string) => void;
  onOrigin: (z: 1 | 2 | 3 | 4 | 5 | 6) => void;
  onTarget: (z: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) => void;
  onRating: (r: Rating) => void;
}

function StepView({ current, match, teams, onPlayer, onOrigin, onTarget, onRating }: StepViewProps) {
  const team = teams[current.side];

  if (current.sub === "origin") {
    return (
      <div>
        <div className="text-xs text-muted-foreground mb-2">Zona de origen · {STATE_LABEL[current.state]}</div>
        <div className="grid grid-cols-5 gap-2">
          {[
            { z: 4 as const, label: "1 · Z4" },
            { z: 3 as const, label: "2 · Z3" },
            { z: 2 as const, label: "3 · Z2" },
            { z: 6 as const, label: "4 · Pipe" },
            { z: 1 as const, label: "5 · Zag." },
          ].map((it) => (
            <button
              key={it.z}
              onClick={() => onOrigin(it.z)}
              className="rounded-lg border-2 border-primary/30 hover:border-primary hover:bg-primary/10 py-3 text-sm font-bold transition-colors"
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (current.sub === "player") {
    const onCourt = getEffectiveOnCourt(match, current.side);
    return (
      <div>
        <div className="text-xs text-muted-foreground mb-2">Jugador · {STATE_LABEL[current.state]}</div>
        <div className="grid grid-cols-3 gap-2">
          {onCourt.map((pid, idx) => {
            const p = team.players.find((x) => x.id === pid);
            if (!p) return null;
            const zone = idx + 1;
            return (
              <button
                key={pid}
                onClick={() => onPlayer(pid)}
                className="rounded-lg border-2 border-primary/30 hover:border-primary hover:bg-primary/10 py-2 px-2 text-left transition-colors"
              >
                <div className="text-[10px] text-muted-foreground">Z{zone}</div>
                <div className="text-sm font-bold">#{p.number} {p.name.split(" ")[0]}</div>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Pista: los números 1..9 seleccionan por número de camiseta.
        </p>
      </div>
    );
  }

  if (current.sub === "target") {
    const auto = current.playerId ? team.players.find((p) => p.id === current.playerId) : null;
    return (
      <div>
        {auto && (
          <div className="mb-3 rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {current.state === "saque" ? "Sacador detectado" : "Jugador detectado"}
              </div>
              <div className="text-sm font-bold">#{auto.number} {auto.name}</div>
            </div>
            {current.origin && (
              <div className="text-[10px] uppercase text-muted-foreground">Zona <span className="font-bold text-primary">Z{current.origin}</span></div>
            )}
          </div>
        )}
        <div className="text-xs text-muted-foreground mb-2">
          {current.state === "saque" ? "Destino del saque en cancha rival" : "Zona destino en cancha rival"}
        </div>
        <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
          {[
            { z: 5 as const, k: "Q" }, { z: 6 as const, k: "W" }, { z: 1 as const, k: "E" },
            { z: 4 as const, k: "A" }, { z: 3 as const, k: "S" }, { z: 2 as const, k: "D" },
          ].map((it) => (
            <button
              key={it.z}
              onClick={() => onTarget(it.z)}
              className="rounded-lg border-2 border-primary/30 hover:border-primary hover:bg-primary/10 py-4 text-sm font-bold flex flex-col items-center transition-colors"
            >
              <span className="text-[10px] text-muted-foreground">{it.k}</span>
              Z{it.z}
            </button>
          ))}
        </div>
      </div>
    );
  }


  // rating
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">
        Valoración · {STATE_LABEL[current.state]}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {RATING_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => onRating(r)}
            className={`rounded-lg border-2 py-3 font-mono font-bold text-lg transition-colors ${
              ratingClass(r)
            }`}
            title={RATING_MEANING[current.state][r] ?? ""}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground grid grid-cols-6 gap-2 text-center">
        {RATING_ORDER.map((r) => (
          <div key={r} className="truncate">{RATING_MEANING[current.state][r]}</div>
        ))}
      </div>
    </div>
  );
}

function ratingClass(r: Rating): string {
  switch (r) {
    case "#": case "+": return "border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "0": return "border-amber-500/50 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "-": return "border-orange-500/50 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "=": case "≠": return "border-red-500/50 hover:bg-red-500/10 text-red-600 dark:text-red-400";
  }
}

function FinPanel({ outcome, scoringTeam, onNew }: { outcome: { scoringSide: "A" | "B"; reason: string } | null; scoringTeam: Team; onNew: () => void }) {
  if (!outcome) return null;
  return (
    <div className="text-center py-4 animate-in fade-in-0 zoom-in-95 duration-200">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Punto</div>
      <div className="text-2xl font-bold text-primary mt-1">{scoringTeam.name}</div>
      <div className="text-sm text-muted-foreground mt-1">{outcome.reason}</div>
      <button
        onClick={onNew}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90"
      >
        <Undo2 className="size-4" /> Nuevo rally (S)
      </button>
    </div>
  );
}
