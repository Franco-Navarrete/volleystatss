import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ScoutMode = "rapido" | "completo";

export type ScoutFundamento =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "freeball"
  | "cobertura"
  | "pase"
  | "error"
  | "punto";

export type ScoutResultado = "excelente" | "positivo" | "neutro" | "negativo" | "error";

export const FUND_LABEL: Record<ScoutFundamento, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  armado: "Armado",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  freeball: "Free ball",
  cobertura: "Cobertura",
  pase: "Pase",
  error: "Error",
  punto: "Punto",
};

export const FUND_COLOR: Record<ScoutFundamento, string> = {
  saque: "oklch(0.72 0.19 38)",
  recepcion: "oklch(0.72 0.14 220)",
  armado: "oklch(0.78 0.16 195)",
  ataque: "oklch(0.62 0.24 25)",
  bloqueo: "oklch(0.65 0.22 300)",
  defensa: "oklch(0.72 0.17 155)",
  freeball: "oklch(0.82 0.16 85)",
  cobertura: "oklch(0.68 0.10 260)",
  pase: "oklch(0.72 0.09 200)",
  error: "oklch(0.55 0.05 250)",
  punto: "oklch(0.78 0.20 145)",
};

export const FUND_KEY: Record<string, ScoutFundamento> = {
  s: "saque",
  r: "recepcion",
  a: "armado",
  f: "ataque",
  b: "bloqueo",
  d: "defensa",
  g: "freeball",
  c: "cobertura",
  p: "pase",
  e: "error",
  q: "punto",
};

export const RESULT_KEY: Record<string, ScoutResultado> = {
  "!": "excelente",
  "+": "positivo",
  "0": "neutro",
  "-": "negativo",
  "=": "error",
};

export const RESULT_LABEL: Record<ScoutResultado, string> = {
  excelente: "! Excelente",
  positivo: "+ Positivo",
  neutro: "0 Neutro",
  negativo: "- Negativo",
  error: "= Error",
};

export const RESULT_COLOR: Record<ScoutResultado, string> = {
  excelente: "oklch(0.72 0.17 155)",
  positivo: "oklch(0.72 0.14 165)",
  neutro: "oklch(0.72 0.02 250)",
  negativo: "oklch(0.75 0.14 60)",
  error: "oklch(0.62 0.24 25)",
};

interface ScoutState {
  mode: ScoutMode;
  autoPauseMs: number;
  setMode: (m: ScoutMode) => void;
  setAutoPauseMs: (ms: number) => void;
}

export const useScoutStore = create<ScoutState>()(
  persist(
    (set) => ({
      mode: "rapido",
      autoPauseMs: 1500,
      setMode: (m) => set({ mode: m }),
      setAutoPauseMs: (ms) => set({ autoPauseMs: ms }),
    }),
    { name: "rally-video-scout" },
  ),
);
