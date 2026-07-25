/**
 * Guía compacta de atajos para el registro en Scouting en Vivo.
 * Vive como un cajón lateral colapsable en el borde derecho de la pantalla.
 * Cerrado por defecto (solo muestra una lengüeta) para no molestar.
 * Se abre con el botón o la tecla "?" y se cierra con Esc.
 */
import { useEffect, useState } from "react";
import { Keyboard, ChevronRight } from "lucide-react";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Equipo / Jugadora",
    items: [
      ["Y", "Equipo A (izquierda)"],
      ["X", "Equipo B (derecha)"],
      ["1–9", "Jugadora por dorsal"],
    ],
  },
  {
    title: "Fundamento",
    items: [
      ["S", "Saque"],
      ["R", "Recepción"],
      ["A", "Armado"],
      ["F", "Ataque"],
      ["B", "Bloqueo"],
      ["D", "Defensa"],
      ["G", "Free ball"],
      ["C", "Cobertura"],
      ["P", "Pase"],
      ["E", "Error"],
      ["Q", "Punto"],
    ],
  },
  {
    title: "Resultado",
    items: [
      ["!", "Excelente"],
      ["+", "Positivo"],
      ["0", "Neutro"],
      ["−", "Negativo"],
      ["=", "Error / punto rival"],
    ],
  },
  {
    title: "Control",
    items: [
      ["Ctrl+Z", "Deshacer"],
      ["Esc", "Cancelar selección"],
      ["?", "Abrir / cerrar esta guía"],
    ],
  },
];

interface Props {
  /** Posición vertical del botón (top offset). Default: top-24. */
  topClass?: string;
}

export function ScoutShortcutsDrawer({ topClass = "top-24" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Botón discreto en la esquina inferior izquierda */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Guía de atajos (?)"
          className="fixed bottom-3 left-3 z-40 flex items-center gap-1.5 rounded-full bg-card/80 hover:bg-card border border-border text-foreground/80 px-2.5 py-1.5 shadow-sm text-[10px] font-semibold backdrop-blur"
        >
          <Keyboard className="size-3" />
          Atajos
          <kbd className="px-1 py-0.5 rounded bg-background/60 text-[9px] font-mono">?</kbd>
        </button>
      )}

      {/* Cajón que emerge desde la esquina inferior izquierda, no tapa la cancha ni el panel de resultado */}
      <aside
        className={`fixed bottom-3 left-3 z-40 w-60 max-h-[70vh] overflow-auto bg-card/95 backdrop-blur border border-border rounded-lg shadow-elevated transition-all duration-200 origin-bottom-left ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="sticky top-0 flex items-center justify-between px-3 py-2 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <Keyboard className="size-3.5 text-primary" />
            <span className="text-xs font-bold">Atajos de registro</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-secondary/50"
            title="Ocultar (Esc)"
          >
            <ChevronRight className="size-4 rotate-180" />
          </button>
        </div>
        <div className="p-3 space-y-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
                {g.title}
              </div>
              <ul className="space-y-0.5">
                {g.items.map(([k, desc]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between gap-2 text-[11px] py-0.5"
                  >
                    <span className="text-foreground/90 truncate">{desc}</span>
                    <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] whitespace-nowrap">
                      {k}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/60">
            Secuencia: equipo → jugadora → fundamento → resultado.
            Ej: <span className="font-mono">Y 7 F +</span>
          </div>
        </div>
      </aside>
    </>
  );
}
