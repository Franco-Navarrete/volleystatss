import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Coach Mode — atajos de teclado configurables para entrenadores/admin.
 * Persistido en localStorage por dispositivo/usuario.
 */

export type CoachAction =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "contraataque"
  | "timeout"
  | "cambio"
  | "libero"
  | "sancion"
  | "undo"
  | "redo"
  | "confirm"
  | "cancel"
  | "back"
  | "help";

export interface Binding {
  /** KeyboardEvent.code preferido (e.g. "KeyA", "Digit1", "F1"). */
  code: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** Etiqueta legible ya formateada (opcional). */
  label?: string;
}

export type MacroStep =
  | { kind: "action"; action: CoachAction }
  | { kind: "note"; text: string };

export interface Macro {
  id: string;
  label: string;
  binding: Binding;
  steps: MacroStep[];
}

interface CoachModeState {
  enabled: boolean;
  bindings: Record<CoachAction, Binding>;
  macros: Macro[];
  setEnabled: (v: boolean) => void;
  setBinding: (action: CoachAction, binding: Binding) => void;
  resetDefaults: () => void;
  addMacro: (m: Macro) => void;
  updateMacro: (id: string, patch: Partial<Macro>) => void;
  removeMacro: (id: string) => void;
}

const b = (
  code: string,
  extra: Partial<Binding> = {},
): Binding => ({ code, ...extra });

export const DEFAULT_BINDINGS: Record<CoachAction, Binding> = {
  saque: b("KeyS"),
  recepcion: b("KeyR"),
  armado: b("KeyL"),
  ataque: b("KeyA"),
  bloqueo: b("KeyB"),
  defensa: b("KeyD"),
  contraataque: b("KeyC"),
  timeout: b("KeyT"),
  cambio: b("KeyM"),
  libero: b("KeyI"),
  sancion: b("KeyX"),
  undo: b("KeyZ", { ctrl: true }),
  redo: b("KeyY", { ctrl: true }),
  confirm: b("Enter"),
  cancel: b("Escape"),
  back: b("Backspace"),
  help: b("F1"),
};

const DEFAULT_MACROS: Macro[] = [
  {
    id: "m1",
    label: "Saque flotado",
    binding: { code: "Digit1", ctrl: true },
    steps: [{ kind: "action", action: "saque" }, { kind: "note", text: "flotado" }],
  },
  {
    id: "m2",
    label: "Saque potencia",
    binding: { code: "Digit2", ctrl: true },
    steps: [{ kind: "action", action: "saque" }, { kind: "note", text: "potencia" }],
  },
  {
    id: "m3",
    label: "Ataque Pipe",
    binding: { code: "Digit3", ctrl: true },
    steps: [{ kind: "action", action: "ataque" }, { kind: "note", text: "Pipe" }],
  },
];

export const ACTION_LABEL: Record<CoachAction, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  armado: "Armado",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  contraataque: "Contraataque",
  timeout: "Time Out",
  cambio: "Cambio",
  libero: "Líbero",
  sancion: "Sanción",
  undo: "Deshacer",
  redo: "Rehacer",
  confirm: "Confirmar",
  cancel: "Cancelar",
  back: "Volver",
  help: "Ayuda",
};

export const useCoachMode = create<CoachModeState>()(
  persist(
    (set) => ({
      enabled: false,
      bindings: { ...DEFAULT_BINDINGS },
      macros: DEFAULT_MACROS,
      setEnabled: (v) => set({ enabled: v }),
      setBinding: (action, binding) =>
        set((s) => ({ bindings: { ...s.bindings, [action]: binding } })),
      resetDefaults: () =>
        set({ bindings: { ...DEFAULT_BINDINGS }, macros: DEFAULT_MACROS }),
      addMacro: (m) => set((s) => ({ macros: [...s.macros, m] })),
      updateMacro: (id, patch) =>
        set((s) => ({
          macros: s.macros.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      removeMacro: (id) =>
        set((s) => ({ macros: s.macros.filter((m) => m.id !== id) })),
    }),
    { name: "rally.coachMode.v1" },
  ),
);

/** Devuelve una etiqueta legible del binding (Ctrl+Z, A, F1, ...). */
export function formatBinding(binding: Binding): string {
  if (!binding?.code) return "—";
  const mods: string[] = [];
  if (binding.ctrl) mods.push("Ctrl");
  if (binding.alt) mods.push("Alt");
  if (binding.shift) mods.push("Shift");
  let key = binding.code;
  if (key.startsWith("Key")) key = key.slice(3);
  else if (key.startsWith("Digit")) key = key.slice(5);
  else if (key === "Escape") key = "Esc";
  else if (key === "Backspace") key = "⌫";
  else if (key === "Enter") key = "Enter";
  return [...mods, key].join("+");
}

export function bindingMatches(binding: Binding, e: KeyboardEvent): boolean {
  if (!binding?.code) return false;
  if (binding.code !== e.code) return false;
  if (!!binding.ctrl !== (e.ctrlKey || e.metaKey)) return false;
  if (!!binding.alt !== e.altKey) return false;
  if (!!binding.shift !== e.shiftKey) return false;
  return true;
}
