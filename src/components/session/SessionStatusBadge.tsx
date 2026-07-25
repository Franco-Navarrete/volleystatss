import type { SessionStatus } from "@/lib/match-session/types";
import { Radio, Settings2, Cog, BarChart3, CheckCircle2 } from "lucide-react";

const MAP: Record<SessionStatus, { label: string; className: string; Icon: typeof Radio }> = {
  preparation: { label: "Preparación", className: "text-muted-foreground border-border", Icon: Settings2 },
  live: { label: "En vivo", className: "text-destructive border-destructive/50 bg-destructive/10", Icon: Radio },
  processing: { label: "Procesando", className: "text-amber-500 border-amber-500/50 bg-amber-500/10", Icon: Cog },
  analysis: { label: "Análisis", className: "text-primary border-primary/50 bg-primary/10", Icon: BarChart3 },
  finished: { label: "Finalizado", className: "text-success border-success/50 bg-success/10", Icon: CheckCircle2 },
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { label, className, Icon } = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-widest font-bold ${className}`}>
      <Icon className="size-3" /> {label}
    </span>
  );
}
