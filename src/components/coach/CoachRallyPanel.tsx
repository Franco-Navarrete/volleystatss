import { useMemo } from "react";
import { X, ChevronLeft, Undo2 } from "lucide-react";
import type { Match, Team } from "@/lib/volley-store";
import {
  useCoachRally,
  RATING_ORDER,
  RATING_MEANING,
  STATE_LABEL,
  type Rating,
  type RallyState,
  type AttackResultKind,
} from "@/lib/coach/rally-machine";
import { useCoachMode } from "@/lib/coach-mode-store";
import { SET_DISTRIBUTION_TO_ZONE, SET_DISTRIBUTION_LABEL } from "@/lib/coach/effective-lineup";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
}

/**
 * Panel único de Coach Mode: motor de estados guiado.
 * Anclado al lateral derecho (~28% ancho) para no ocultar la cancha.
 * Sólo muestra la información del fundamento actual.
 */
export function CoachRallyPanel({ match, teamA, teamB }: Props) {
  const enabled = useCoachMode((s) => s.enabled);
  const state = useCoachRally((s) => s.state);
  const current = useCoachRally((s) => s.current);
  const outcome = useCoachRally((s) => s.outcome);
  const setPlayer = useCoachRally((s) => s.setPlayer);
  const setOrigin = useCoachRally((s) => s.setOrigin);
  const setTarget = useCoachRally((s) => s.setTarget);
  const setRating = useCoachRally((s) => s.setRating);
  const setAttackResult = useCoachRally((s) => s.setAttackResult);
  const back = useCoachRally((s) => s.back);
  const cancel = useCoachRally((s) => s.cancel);
  const reset = useCoachRally((s) => s.reset);

  const teams = useMemo(() => ({ A: teamA, B: teamB }), [teamA, teamB]);

  if (!enabled || state === "idle") return null;

  const activeSide = current?.side ?? outcome?.scoringSide ?? "A";
  const activeTeam = teams[activeSide];

  return (
    <div className="fixed top-1/2 -translate-y-1/2 right-3 z-[9998] w-[28vw] min-w-[280px] max-w-[380px] pointer-events-auto animate-in fade-in-0 slide-in-from-right-2 duration-200">
      <div className="rounded-2xl border-2 border-primary/40 bg-background/98 backdrop-blur shadow-2xl overflow-hidden">
        {/* Cabecera compacta */}
        <header className="flex items-center justify-between gap-2 bg-primary text-primary-foreground px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[9px] uppercase tracking-widest opacity-80 shrink-0">Coach</span>
            <span className="text-sm font-bold uppercase truncate">{STATE_LABEL[state]}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={back} className="p-1 rounded hover:bg-primary-foreground/20" title="Volver (⌫)">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={cancel} className="p-1 rounded hover:bg-primary-foreground/20" title="Cancelar (Esc)">
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Contexto de equipo */}
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30 truncate">
          {activeTeam.name}
        </div>

        {/* Paso actual */}
        <section className="p-3">
          {state === "fin" ? (
            <FinPanel outcome={outcome} scoringTeam={teams[outcome?.scoringSide ?? "A"]} onNew={reset} />
          ) : current ? (
            <StepView
              current={current}
              teams={teams}
              onPlayer={setPlayer}
              onOrigin={setOrigin}
              onTarget={setTarget}
              onRating={setRating}
            />
          ) : null}
        </section>

        <footer className="px-3 py-1.5 border-t bg-muted/50 flex items-center justify-between text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded bg-background border px-1 font-mono">Esc</kbd>
            <kbd className="rounded bg-background border px-1 font-mono">⌫</kbd>
            <kbd className="rounded bg-background border px-1 font-mono">Ctrl+Z</kbd>
          </span>
        </footer>
      </div>
    </div>
  );
}

interface StepViewProps {
  current: NonNullable<ReturnType<typeof useCoachRally.getState>["current"]>;
  teams: { A: Team; B: Team };
  onPlayer: (id: string) => void;
  onOrigin: (z: 1 | 2 | 3 | 4 | 5 | 6) => void;
  onTarget: (z: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) => void;
  onRating: (r: Rating) => void;
}

function detectedLabel(state: RallyState): string {
  switch (state) {
    case "saque": return "Sacador";
    case "recepcion": return "Receptor";
    case "armado": return "Armador";
    case "ataque": return "Atacante";
    case "contraataque": return "Contraatacante";
    case "bloqueo": return "Bloqueador";
    case "defensa": return "Defensor";
    default: return "Jugador";
  }
}

function PlayerCard({ team, playerId, state, origin }: { team: Team; playerId: string | null | undefined; state: RallyState; origin?: number }) {
  const p = playerId ? team.players.find((x) => x.id === playerId) : null;
  return (
    <div className="mb-3 rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{detectedLabel(state)} detectado</div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <div className="text-sm font-bold truncate">{p ? `#${p.number} ${p.name}` : "—"}</div>
        {origin && (
          <div className="text-[10px] uppercase text-muted-foreground shrink-0">Z<span className="font-bold text-primary">{origin}</span></div>
        )}
      </div>
    </div>
  );
}

function StepView({ current, teams, onPlayer, onTarget, onRating }: StepViewProps) {
  const team = teams[current.side];

  // Selección manual de jugador (sólo si Coach Mode no pudo autodetectar).
  if (current.sub === "player") {
    const onCourt = current.side === "A" ? null : null; // fallback: rara vez ocurre
    void onCourt;
    return (
      <div>
        <div className="text-xs text-muted-foreground mb-2">Seleccionar jugador · {STATE_LABEL[current.state]}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {team.players.slice(0, 12).map((p) => (
            <button
              key={p.id}
              onClick={() => onPlayer(p.id)}
              className="rounded-md border border-primary/30 hover:border-primary hover:bg-primary/10 py-1.5 px-2 text-left text-xs font-bold transition-colors truncate"
            >
              #{p.number} {p.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Armado: distribución (1..5). Armador ya autodetectado.
  if (current.state === "armado" && current.sub === "target") {
    return (
      <div>
        <PlayerCard team={team} playerId={current.playerId} state="armado" />
        <div className="text-xs text-muted-foreground mb-2">¿Hacia qué zona distribuyó?</div>
        <div className="grid grid-cols-3 gap-1.5">
          {([1, 2, 3, 4, 5] as const).map((key) => {
            const zone = SET_DISTRIBUTION_TO_ZONE[key];
            return (
              <button
                key={key}
                onClick={() => onTarget(zone)}
                className="rounded-lg border-2 border-primary/30 hover:border-primary hover:bg-primary/10 py-3 flex flex-col items-center transition-colors"
              >
                <span className="text-[9px] text-muted-foreground">{key}</span>
                <span className="text-sm font-bold">{SET_DISTRIBUTION_LABEL[key]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Saque / Ataque / Contraataque: destino en cancha rival (Q W E / A S D).
  if (current.sub === "target") {
    return (
      <div>
        <PlayerCard team={team} playerId={current.playerId} state={current.state} origin={current.origin} />
        <div className="text-xs text-muted-foreground mb-2">
          {current.state === "saque" ? "Destino del saque" : "Destino del ataque"}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { z: 5 as const, k: "Q" }, { z: 6 as const, k: "W" }, { z: 1 as const, k: "E" },
            { z: 4 as const, k: "A" }, { z: 3 as const, k: "S" }, { z: 2 as const, k: "D" },
          ].map((it) => (
            <button
              key={it.z}
              onClick={() => onTarget(it.z)}
              className="rounded-lg border-2 border-primary/30 hover:border-primary hover:bg-primary/10 py-3 flex flex-col items-center transition-colors"
            >
              <span className="text-[9px] text-muted-foreground">{it.k}</span>
              <span className="text-sm font-bold">Z{it.z}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Rating universal.
  return (
    <div>
      <PlayerCard team={team} playerId={current.playerId} state={current.state} origin={current.origin} />
      <div className="text-xs text-muted-foreground mb-2">Valoración</div>
      <div className="grid grid-cols-3 gap-1.5">
        {RATING_ORDER.map((r) => (
          <button
            key={r}
            onClick={() => onRating(r)}
            className={`rounded-lg border-2 py-2.5 font-mono font-bold text-base transition-colors ${ratingClass(r)}`}
            title={RATING_MEANING[current.state][r] ?? ""}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[9px] text-muted-foreground grid grid-cols-3 gap-1.5 text-center">
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
    <div className="text-center py-3 animate-in fade-in-0 zoom-in-95 duration-200">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Punto</div>
      <div className="text-xl font-bold text-primary mt-1 truncate">{scoringTeam.name}</div>
      <div className="text-xs text-muted-foreground mt-1">{outcome.reason}</div>
      <button
        onClick={onNew}
        className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90"
      >
        <Undo2 className="size-3.5" /> Nuevo rally (S)
      </button>
    </div>
  );
}
