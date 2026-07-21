import { Keyboard } from "lucide-react";
import { formatBinding, useCoachMode } from "@/lib/coach-mode-store";

/**
 * Barra discreta permanente en la parte inferior de la pantalla mientras
 * Coach Mode está activo. Recuerda los atajos principales sin ocupar espacio.
 */
export function CoachHelpBar() {
  const enabled = useCoachMode((s) => s.enabled);
  const bindings = useCoachMode((s) => s.bindings);
  if (!enabled) return null;

  const items: { label: string; action: keyof typeof bindings }[] = [
    { label: "Ataque", action: "ataque" },
    { label: "Saque", action: "saque" },
    { label: "Recepción", action: "recepcion" },
    { label: "Bloqueo", action: "bloqueo" },
    { label: "Armado", action: "armado" },
    { label: "Defensa", action: "defensa" },
    { label: "Ayuda", action: "help" },
  ];

  return (
    <div className="fixed bottom-1 left-1/2 -translate-x-1/2 z-[9997] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/30 bg-background/85 backdrop-blur px-3 py-1 text-[10px] font-medium shadow-sm">
        <span className="flex items-center gap-1 text-primary font-bold uppercase tracking-wider">
          <Keyboard className="size-3" /> Coach
        </span>
        {items.map((it) => (
          <span key={it.action} className="flex items-center gap-1 text-muted-foreground">
            <kbd className="rounded bg-secondary text-foreground px-1 py-0.5 font-mono text-[10px]">
              {formatBinding(bindings[it.action])}
            </kbd>
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}
