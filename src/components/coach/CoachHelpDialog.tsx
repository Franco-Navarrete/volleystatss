import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ACTION_LABEL,
  formatBinding,
  useCoachMode,
  type CoachAction,
} from "@/lib/coach-mode-store";

const GROUPS: { title: string; actions: CoachAction[] }[] = [
  {
    title: "Fundamentos",
    actions: ["saque", "recepcion", "armado", "ataque", "bloqueo", "defensa", "contraataque"],
  },
  { title: "Gestión de set", actions: ["timeout", "cambio", "libero", "sancion"] },
  {
    title: "Navegación",
    actions: ["confirm", "cancel", "back", "undo", "redo", "help"],
  },
];

/**
 * Panel de ayuda activado con F1: lista todos los atajos activos + macros.
 */
export function CoachHelpDialog() {
  const bindings = useCoachMode((s) => s.bindings);
  const macros = useCoachMode((s) => s.macros);
  const enabled = useCoachMode((s) => s.enabled);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("coach:help:open", onOpen);
    return () => window.removeEventListener("coach:help:open", onOpen);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onAction = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: CoachAction }>).detail;
      if (detail?.action === "help") setOpen((v) => !v);
      if (detail?.action === "cancel") setOpen(false);
    };
    window.addEventListener("coach:action", onAction as EventListener);
    return () => window.removeEventListener("coach:action", onAction as EventListener);
  }, [enabled]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ⌨️ Atajos de Coach Mode
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                {g.title}
              </div>
              <div className="space-y-1">
                {g.actions.map((a) => (
                  <div
                    key={a}
                    className="flex items-center justify-between text-sm rounded-md px-2 py-1 hover:bg-secondary/40"
                  >
                    <span>{ACTION_LABEL[a]}</span>
                    <kbd className="text-xs font-mono rounded bg-secondary px-1.5 py-0.5">
                      {formatBinding(bindings[a])}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {macros.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5 mt-2">
              Macros
            </div>
            <div className="space-y-1">
              {macros.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm rounded-md px-2 py-1 hover:bg-secondary/40"
                >
                  <span>{m.label}</span>
                  <kbd className="text-xs font-mono rounded bg-secondary px-1.5 py-0.5">
                    {formatBinding(m.binding)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Los atajos se ignoran automáticamente cuando estás escribiendo en un
          campo. Presioná <kbd className="font-mono">F1</kbd> para abrir/cerrar
          este panel.
        </p>
      </DialogContent>
    </Dialog>
  );
}
