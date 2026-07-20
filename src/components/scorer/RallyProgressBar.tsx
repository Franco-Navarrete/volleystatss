import { Check } from "lucide-react";
import { RALLY_PHASE_LABEL, type RallyContext, type RallyPhase } from "@/lib/rally-phase";

const PHASE_SHORT: Record<RallyPhase, string> = {
  serve: "Saq",
  reception: "Rec",
  setting: "Arm",
  attack: "Atk",
  defense: "Def",
  counter_attack: "Ctr",
};

/** Fases del K1 en cyan; ciclo de continuidad en naranja. */
function phaseTone(phase: RallyPhase): "base" | "cycle" {
  return phase === "defense" || phase === "counter_attack" ? "cycle" : "base";
}

export function RallyProgressBar({ ctx }: { ctx: RallyContext }) {
  return (
    <div className="w-full flex items-center gap-1 md:gap-1.5 px-1.5 py-1 rounded-md bg-card/70 border border-border/50 overflow-x-auto">
      {ctx.finished ? (
        <div className="flex items-center gap-2 text-success font-black text-[11px] md:text-xs uppercase tracking-widest w-full justify-center py-0.5">
          <Check className="size-3.5" /> Rally finalizado — nuevo saque
        </div>
      ) : (
        ctx.steps.map((step, i) => {
          const done = step.done;
          const current = step.current;
          const tone = phaseTone(step.phase);
          const doneCls = tone === "cycle" ? "bg-orange-500/15 text-orange-600 dark:text-orange-300" : "bg-success/15 text-success";
          const currentCls = tone === "cycle"
            ? "bg-orange-500 text-white shadow-glow animate-pulse"
            : "bg-primary text-primary-foreground shadow-glow animate-pulse";
          const dotDone = tone === "cycle" ? "bg-orange-500/25" : "bg-success/25";
          return (
            <div key={i} className="flex items-center gap-1 md:gap-1.5 shrink-0">
              <div
                className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-md text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all ${
                  current ? currentCls : done ? doneCls : "bg-transparent text-muted-foreground/70"
                }`}
                title={RALLY_PHASE_LABEL[step.phase]}
              >
                <span
                  className={`grid place-items-center size-3.5 md:size-4 rounded-full text-[8px] font-black ${
                    done && !current ? dotDone : current ? "bg-white/25" : "bg-muted"
                  }`}
                >
                  {done && !current ? <Check className="size-2.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{RALLY_PHASE_LABEL[step.phase]}</span>
                <span className="sm:hidden">{PHASE_SHORT[step.phase]}</span>
              </div>
              {i < ctx.steps.length - 1 && (
                <span className={`text-[10px] ${done ? (tone === "cycle" ? "text-orange-500/70" : "text-success/70") : "text-muted-foreground/40"}`}>→</span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
