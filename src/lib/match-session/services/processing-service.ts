/**
 * ProcessingService — orquesta la fase Procesando entre "en vivo" y
 * "análisis". Los pasos son livianos: los datos ya viven en los stores
 * existentes; aquí sólo simulamos secuencia y damos feedback visual.
 */
import { useMatchSessionStore } from "../store";
import { MatchSessionService } from "./match-session-service";
import type { ProcessingStep } from "../types";

const DEFAULT_STEPS: ProcessingStep[] = [
  { id: "sync", label: "Sincronizando video con scouting", status: "pending" },
  { id: "index", label: "Generando índices de rallies", status: "pending" },
  { id: "stats", label: "Calculando estadísticas", status: "pending" },
  { id: "clips", label: "Preparando clips virtuales", status: "pending" },
  { id: "analysis", label: "Preparando análisis", status: "pending" },
];

export const ProcessingService = {
  async run(sessionId: string) {
    const store = useMatchSessionStore.getState();
    store.setProcessing(sessionId, DEFAULT_STEPS.map((s) => ({ ...s })));
    MatchSessionService.setStatus(sessionId, "processing");

    for (const step of DEFAULT_STEPS) {
      store.updateStep(sessionId, step.id, "running");
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 500));
      store.updateStep(sessionId, step.id, "done");
    }

    MatchSessionService.setStatus(sessionId, "analysis");
  },
};
