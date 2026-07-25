/**
 * Guía compacta de atajos para el registro en Scouting en Vivo.
 * Vive como un cajón lateral colapsable en el borde derecho de la pantalla.
 * Cerrado por defecto (solo muestra una lengüeta) para no molestar.
 * Se abre con el botón o la tecla "?" y se cierra con Esc.
 */
import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Equipo / Jugadora",
    items: [
      ["Y", "Equipo A (izquierda)"],
      ["X", "Equipo B (derecha)"],
      ["1–9", "Jugadora por dorsal"],
      ["M", "Pasar por X y Y"],
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
      {/* Icono minimalista: solo "?" en la esquina inferior izquierda */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Guía de atajos (?)"
        aria-label="Guía de atajos"
        className="fixed bottom-3 left-3 z-40 size-7 grid place-items-center rounded-full bg-card/60 hover:bg-card border border-border/60 text-muted-foreground hover:text-foreground text-[11px] font-mono backdrop-blur transition-opacity opacity-60 hover:opacity-100"
      >
        ?
      </button>

      {/* Popover compacto */}
      <aside
        className={`fixed bottom-12 left-3 z-40 w-56 max-h-[65vh] overflow-auto bg-card/95 backdrop-blur border border-border rounded-lg shadow-elevated transition-all duration-150 origin-bottom-left ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="px-3 py-2 border-b border-border/60">
          <div className="flex items-center gap-1.5">
            <Keyboard className="size-3 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Atajos</span>
          </div>
        </div>
        <div className="p-3 space-y-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground/70 mb-1">
                {g.title}
              </div>
              <ul className="space-y-0.5">
                {g.items.map(([k, desc]) => (
                  <li
                    key={k}
                    className="flex items-center justify-between gap-2 text-[11px] py-0.5"
                  >
                    <span className="text-foreground/85 truncate">{desc}</span>
                    <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-background/70 border border-border/60 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                      {k}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="text-[10px] text-muted-foreground/80 pt-2 border-t border-border/50">
            equipo → jugadora → fundamento → resultado
            <div className="font-mono mt-0.5">Ej: Y 7 F +</div>
          </div>
        </div>
      </aside>
    </>
  );
}
