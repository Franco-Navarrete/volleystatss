import type { AttackDirection } from "@/lib/volley-store";

interface Props {
  onPick: (d: AttackDirection) => void;
  value?: AttackDirection | null;
}

/**
 * Grilla 2x3 sobre la cancha rival, siguiendo la solicitud del usuario:
 * Fila superior (cerca de la red): 4 3 2
 * Fila inferior (fondo): 5 6 1
 */
export function AttackDirectionGrid({ onPick, value }: Props) {
  // Fila superior (4, 3, 2) pegada a la red
  // Fila inferior (5, 6, 1) al fondo
  const rows: AttackDirection[][] = [
    [4, 3, 2],
    [5, 6, 1],
  ];

  return (
    <div className="space-y-2">
      <div
        className="relative w-full aspect-[3/2] rounded-lg overflow-hidden border-2 border-foreground/30"
        style={{
          background:
            "repeating-linear-gradient(135deg, oklch(0.72 0.09 60) 0 6px, oklch(0.68 0.1 55) 6px 12px)",
        }}
      >
        {/* Red del rival arriba (la fila 4-3-2 está pegada a la red) */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white shadow" />
        <div className="grid grid-rows-2 h-full">
          {rows.map((row, r) => (
            <div key={r} className="grid grid-cols-3 gap-[2px] p-[2px]">
              {row.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onPick(d)}
                  className={`rounded-md font-black text-xl text-white/90 border-2 transition-all active:scale-95 flex items-center justify-center ${
                    value === d
                      ? "border-primary bg-primary/60"
                      : "border-white/40 bg-black/20 hover:bg-primary/40 hover:border-primary"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-center text-muted-foreground">
        4-3-2 pegado a la red · 5-6-1 al fondo · zonas oficiales de vóley
      </p>
    </div>
  );
}