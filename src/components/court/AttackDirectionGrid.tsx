import type { AttackDirection } from "@/lib/volley-store";

interface Props {
  onPick: (d: AttackDirection) => void;
  value?: AttackDirection | null;
}

/**
 * Grilla 3×3 sobre la cancha rival. Numeración:
 *   7 8 9  (fondo rival)
 *   4 5 6  (centro)
 *   1 2 3  (cerca de la red)
 * El atacante mira hacia la red del rival ⇒ 1..3 = red, 7..9 = fondo.
 */
export function AttackDirectionGrid({ onPick, value }: Props) {
  // Renderizamos de arriba (fondo) hacia abajo (red) visualmente.
  const rows: AttackDirection[][] = [
    [7, 8, 9],
    [4, 5, 6],
    [1, 2, 3],
  ];
  return (
    <div className="space-y-2">
      <div
        className="relative w-full aspect-[3/2] rounded-lg overflow-hidden border-2 border-foreground/30"
        style={{
          background:
            "repeating-linear-gradient(135deg, oklch(0.72 0.09 60) 0 12px, oklch(0.68 0.1 55) 12px 24px)",
        }}
      >
        {/* Red del rival (abajo, la más cercana al atacante) */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white shadow" />
        <div className="grid grid-rows-3 h-full">
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
        1-2-3 pegado a la red · 7-8-9 al fondo · desde la perspectiva del atacante
      </p>
    </div>
  );
}
