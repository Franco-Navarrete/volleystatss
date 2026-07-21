import { useState } from "react";
import { Keyboard, RotateCcw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  ACTION_LABEL,
  DEFAULT_BINDINGS,
  formatBinding,
  useCoachMode,
  type Binding,
  type CoachAction,
  type Macro,
} from "@/lib/coach-mode-store";

/**
 * Sección de Ajustes para configurar Coach Mode: switch,
 * bindings de todas las acciones y macros personalizadas.
 */
export function CoachModeSettings() {
  const {
    enabled,
    bindings,
    macros,
    setEnabled,
    setBinding,
    resetDefaults,
    addMacro,
    updateMacro,
    removeMacro,
  } = useCoachMode();

  const [capturing, setCapturing] = useState<
    | { kind: "action"; action: CoachAction }
    | { kind: "macro"; id: string }
    | null
  >(null);

  const startCapture = (
    target: { kind: "action"; action: CoachAction } | { kind: "macro"; id: string },
  ) => {
    setCapturing(target);
    const onKey = (e: KeyboardEvent) => {
      // Ignorar teclas modificadoras solas
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const binding: Binding = {
        code: e.code,
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
      };
      if (target.kind === "action") {
        setBinding(target.action, binding);
        toast.success(`${ACTION_LABEL[target.action]} → ${formatBinding(binding)}`);
      } else {
        updateMacro(target.id, { binding });
        toast.success(`Macro actualizada → ${formatBinding(binding)}`);
      }
      window.removeEventListener("keydown", onKey, true);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
  };

  const conflicts = detectConflicts(bindings, macros);

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Keyboard className="size-4 text-primary" />
            Coach Mode
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Registrá acciones del partido con el teclado. Convive con el mouse;
            los atajos se ignoran cuando estás escribiendo en un campo.
            Presioná <kbd className="font-mono px-1 rounded bg-secondary">F1</kbd> durante el partido para ver todos los atajos.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium">{enabled ? "ON" : "OFF"}</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(DEFAULT_BINDINGS) as CoachAction[]).map((a) => {
              const conflict = conflicts.has(bindingKey(bindings[a]));
              const isCapturing = capturing?.kind === "action" && capturing.action === a;
              return (
                <div
                  key={a}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    conflict ? "border-destructive/60 bg-destructive/5" : "border-border/60 bg-background/40"
                  }`}
                >
                  <span className="text-sm">{ACTION_LABEL[a]}</span>
                  <Button
                    size="sm"
                    variant={isCapturing ? "default" : "outline"}
                    onClick={() => startCapture({ kind: "action", action: a })}
                    className="h-7 min-w-[80px] font-mono text-xs"
                  >
                    {isCapturing ? "Presioná…" : formatBinding(bindings[a])}
                  </Button>
                </div>
              );
            })}
          </div>

          {conflicts.size > 0 && (
            <p className="text-xs text-destructive">
              Hay atajos duplicados. Los que se repiten aparecen resaltados.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                resetDefaults();
                toast.success("Atajos restaurados a los valores por defecto");
              }}
            >
              <RotateCcw className="size-3.5" />
              Restaurar valores por defecto
            </Button>
          </div>

          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Macros</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const id = `m${Date.now()}`;
                  addMacro({
                    id,
                    label: "Nueva macro",
                    binding: { code: "Digit9", ctrl: true },
                    steps: [],
                  });
                }}
              >
                <Plus className="size-3.5" /> Nueva
              </Button>
            </div>
            <div className="space-y-2">
              {macros.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay macros configuradas.
                </p>
              )}
              {macros.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <Input
                    value={m.label}
                    onChange={(e) => updateMacro(m.id, { label: e.target.value })}
                    className="h-7 text-sm max-w-[180px]"
                  />
                  <Button
                    size="sm"
                    variant={capturing?.kind === "macro" && capturing.id === m.id ? "default" : "outline"}
                    onClick={() => startCapture({ kind: "macro", id: m.id })}
                    className="h-7 min-w-[80px] font-mono text-xs"
                  >
                    {capturing?.kind === "macro" && capturing.id === m.id
                      ? "Presioná…"
                      : formatBinding(m.binding)}
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    {describeMacro(m)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMacro(m.id)}
                    className="h-7 w-7 p-0 ml-auto text-destructive"
                    aria-label="Eliminar macro"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function bindingKey(b: Binding): string {
  return `${b.ctrl ? "C" : ""}${b.alt ? "A" : ""}${b.shift ? "S" : ""}:${b.code}`;
}

function detectConflicts(
  bindings: Record<CoachAction, Binding>,
  macros: Macro[],
): Set<string> {
  const seen = new Map<string, number>();
  const add = (b: Binding) => {
    const k = bindingKey(b);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  };
  Object.values(bindings).forEach(add);
  macros.forEach((m) => add(m.binding));
  return new Set(
    Array.from(seen.entries())
      .filter(([, n]) => n > 1)
      .map(([k]) => k),
  );
}

function describeMacro(m: Macro): string {
  if (!m.steps.length) return "sin pasos";
  return m.steps
    .map((s) => (s.kind === "action" ? ACTION_LABEL[s.action] : s.text))
    .join(" · ");
}
