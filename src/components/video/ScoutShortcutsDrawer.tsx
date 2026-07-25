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
      {/* Lengüeta siempre visible */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Guía de atajos (?)"
          className={`fixed right-0 ${topClass} z-40 flex items-center gap-1.5 rounded-l-md bg-primary/90 hover:bg-primary text-primary-foreground px-2 py-2 shadow-elevated text-[11px] font-semibold`}
        >
          <Keyboard className="size-3.5" />
          Atajos
          <kbd className="px-1 py-0.5 rounded bg-black/25 text-[9px] font-mono">?</kbd>
        </button>
      )}

      {/* Cajón lateral */}
      <aside
        className={`fixed right-0 ${topClass} z-40 w-64 max-h-[calc(100vh-8rem)] overflow-auto bg-card/95 backdrop-blur border border-border rounded-l-lg shadow-elevated transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
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
            <ChevronRight className="size-4" />
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
