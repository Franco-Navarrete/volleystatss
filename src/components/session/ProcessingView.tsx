import { useMatchSessionStore } from "@/lib/match-session/store";
import { Loader2, Check, AlertCircle } from "lucide-react";

export function ProcessingView({ sessionId }: { sessionId: string }) {
  const session = useMatchSessionStore((s) => s.sessions[sessionId]);
  const steps = session?.processing ?? [];

  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <h2 className="text-2xl font-extrabold mb-2">Procesando partido</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Estamos preparando el análisis. No cierres esta pestaña.
      </p>
      <ul className="space-y-3">
        {steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3"
          >
            {s.status === "done" ? (
              <Check className="size-4 text-success" />
            ) : s.status === "running" ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : s.status === "error" ? (
              <AlertCircle className="size-4 text-destructive" />
            ) : (
              <span className="size-4 rounded-full border border-border" />
            )}
            <span className="text-sm">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
