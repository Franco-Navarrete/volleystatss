import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { ACTION_LABEL, useCoachMode } from "@/lib/coach-mode-store";
import type { CoachSeqDetail } from "@/hooks/use-coach-shortcuts";

/**
 * HUD flotante que muestra el paso actual del atajo en curso.
 * Sólo visible cuando Coach Mode está activo y hay una secuencia.
 */
export function CoachHUD() {
  const enabled = useCoachMode((s) => s.enabled);
  const [seq, setSeq] = useState<CoachSeqDetail>({});

  useEffect(() => {
    if (!enabled) {
      setSeq({});
      return;
    }
    const onSeq = (e: Event) => {
      const detail = (e as CustomEvent<CoachSeqDetail>).detail ?? {};
      setSeq(detail);
    };
    window.addEventListener("coach:seq", onSeq as EventListener);
    return () => window.removeEventListener("coach:seq", onSeq as EventListener);
  }, [enabled]);

  if (!enabled) return null;
  const empty = !seq.action && !seq.playerNumber && !seq.zone && !seq.rating;
  if (empty) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none animate-in fade-in slide-in-from-bottom-2">
      <div className="pointer-events-auto rounded-xl border border-primary/40 bg-background/95 backdrop-blur shadow-2xl px-4 py-3 min-w-[240px] max-w-xs">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-primary font-bold mb-2">
          <Keyboard className="size-3.5" /> Coach Mode
        </div>
        <div className="space-y-1 text-sm font-mono">
          {seq.action && (
            <Row k={ACTION_LABEL[seq.action]} v="→ Selecciona jugador" done />
          )}
          {seq.playerNumber != null && (
            <Row k={`#${seq.playerNumber}`} v="→ Selecciona zona" done />
          )}
          {seq.zone != null && <Row k={`Z${seq.zone}`} v="→ Resultado" done />}
          {seq.rating && (
            <Row k={seq.rating} v="→ Enter para confirmar" done />
          )}
          {seq.hint && !seq.rating && (
            <div className="text-[11px] text-muted-foreground mt-1">{seq.hint}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, done }: { k: string; v: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block min-w-[32px] text-center rounded-md px-1.5 py-0.5 text-xs font-bold ${
          done ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"
        }`}
      >
        {k}
      </span>
      <span className="text-xs text-muted-foreground">{v}</span>
    </div>
  );
}
