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
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground italic">
            <strong>Tip defensivo:</strong> Tengamos en cuenta que el Líbero y/o Central siempre en la defensa luego de la recepción se va a posición cinco. El punta zaguero a P6 y el armador/opuesto a P1.
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground italic">
            <strong>Regla del saque:</strong> Tengamos en cuenta que el central cuando tiene que ir al saque, saca y hasta que ese punto no termine (en caso de que no sea de su mismo equipo) sale por el líbero y si el punto es de su mismo equipo tiene que seguir sacando.
          </p>
          <div className="text-[11px] leading-relaxed text-muted-foreground space-y-2 border-t border-primary/10 pt-2">
            <p className="font-bold text-primary/80 not-italic">Rotación Central/Líbero (Advice S18):</p>
            <p className="italic">
              La rotación del central con el líbero puede parecer complicada al principio, pero siempre sigue el mismo patrón:
            </p>
            <ul className="list-disc pl-4 space-y-1 italic">
              <li>Cuando el central 1 termina de sacar, sale por el líbero.</li>
              <li>El líbero permanece en las posiciones de zaga (1, 6, 5) hasta que el central 2 (que está adelante) rota a la posición 4.</li>
              <li>En ese momento, el central 2 sale de la cancha y entra el líbero por él, mientras que el central 1 (que estaba afuera) entra a la posición 4 para jugar en la red.</li>
              <li>Si al central le toca sacar y está el líbero en su lugar, el líbero sale, entra el central, saca, y al perder el saque vuelve a entrar el líbero.</li>
            </ul>
            <p className="italic">
              <strong>Regla rápida:</strong> Central adelante, líbero atrás. Solo se cruzan en el saque o cuando el central de adelante pasa a ser zaguero. Recordá que el líbero tiene prohibido atacar sobre el borde superior de la red y no puede saltar dentro de los 3 metros para ir a la defensa o armar de dedos.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
