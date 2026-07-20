import { Check } from "lucide-react";
import { RALLY_PHASES, RALLY_PHASE_LABEL, type RallyContext } from "@/lib/rally-phase";

export function RallyProgressBar({ ctx }: { ctx: RallyContext }) {
  return (
    <div className="w-full flex items-center gap-1 md:gap-1.5 px-1.5 py-1 rounded-md bg-card/70 border border-border/50 overflow-x-auto">
      {ctx.finished ? (
        <div className="flex items-center gap-2 text-success font-black text-[11px] md:text-xs uppercase tracking-widest w-full justify-center py-0.5">
          <Check className="size-3.5" /> Rally finalizado — nuevo saque
        </div>
      ) : (
        RALLY_PHASES.map((phase, i) => {
          const isDone = ctx.done.has(phase);
          const isCurrent = ctx.currentPhase === phase && !isDone;
          return (
            <div key={phase} className="flex items-center gap-1 md:gap-1.5 shrink-0">
              <div
                className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-glow animate-pulse"
                    : isDone
                    ? "bg-success/15 text-success"
                    : "bg-transparent text-muted-foreground/70"
                }`}
              >
                <span
                  className={`grid place-items-center size-3.5 md:size-4 rounded-full text-[8px] font-black ${
                    isDone ? "bg-success/25" : isCurrent ? "bg-white/25" : "bg-muted"
                  }`}
                >
                  {isDone ? <Check className="size-2.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{RALLY_PHASE_LABEL[phase]}</span>
                <span className="sm:hidden">{RALLY_PHASE_LABEL[phase].slice(0, 3)}</span>
              </div>
              {i < RALLY_PHASES.length - 1 && (
                <span className={`text-[10px] ${isDone ? "text-success/70" : "text-muted-foreground/40"}`}>→</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
