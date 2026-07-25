/**
 * Panel flotante con los atajos de teclado disponibles en Modo Análisis.
 * Se abre con "?" o con el botón. Se cierra con Esc / clic fuera / botón X.
 */
import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

interface Props {
  /** Si es false, el panel no se monta (ni siquiera el botón). */
  active: boolean;
}

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Reproducción",
    items: [
      ["Espacio / K", "Play / Pausa"],
      ["← / →", "Retroceder / Adelantar 5s"],
      [", / .", "Frame anterior / siguiente"],
    ],
  },
  {
    title: "Navegación de jugadas",
    items: [
      ["J", "Evento anterior"],
      ["L", "Evento siguiente"],
      ["Enter", "Reproducir clip seleccionado"],
      ["I / O", "Inicio / fin del rally"],
    ],
  },
  {
    title: "Timeline",
    items: [
      ["Rueda del mouse", "Zoom in / out"],
      ["Arrastrar", "Mover línea de tiempo"],
      ["R", "Reset zoom (ver todo)"],
      ["Click", "Saltar a ese tiempo"],
    ],
  },
  {
    title: "Marcadores",
    items: [
      ["S", "⭐ Jugada importante"],
      ["F", "🔥 Rally destacado"],
      ["W", "⚠ Error arbitral"],
      ["N", "📝 Nota"],
    ],
  },
  {
    title: "Ayuda",
    items: [
      ["?", "Mostrar / ocultar este panel"],
      ["Esc", "Cerrar panel / deseleccionar"],
    ],
  },
];

export function KeyboardShortcutsPanel({ active }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active) { setOpen(false); return; }
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
  }, [active]);

  if (!active) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Atajos de teclado (?)"
        className="fixed bottom-4 right-4 z-40 h-11 px-3 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-elevated hover:brightness-110 text-xs font-semibold"
      >
        <Keyboard className="size-4" />
        Atajos
        <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/25 text-[10px] font-mono">?</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-auto bg-card border border-border rounded-xl shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
              <div className="flex items-center gap-2">
                <Keyboard className="size-4 text-primary" />
                <h2 className="text-sm font-bold">Atajos de teclado — Modo Análisis</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-secondary/50"
                title="Cerrar (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    {g.title}
                  </div>
                  <ul className="space-y-1">
                    {g.items.map(([k, desc]) => (
                      <li key={k} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-border/40 last:border-0">
                        <span className="text-foreground/90">{desc}</span>
                        <kbd className="px-2 py-0.5 rounded bg-background/80 border border-border font-mono text-[11px] whitespace-nowrap">
                          {k}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground bg-background/40">
              Presioná <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono">?</kbd> en cualquier momento para volver a abrir este panel.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
