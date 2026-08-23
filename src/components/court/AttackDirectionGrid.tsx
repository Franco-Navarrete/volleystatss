import { useEffect, useState } from "react";
import type { AttackDirection, AttackSubzone } from "@/lib/volley-store";

interface Props {
  onPick: (d: AttackDirection, sub?: AttackSubzone) => void;
  value?: AttackDirection | null;
  subValue?: AttackSubzone | null;
}

/**
 * Grilla 3x3 sobre la cancha rival (zonas oficiales + zonas medias):
 *   4 3 2
 *   7 8 9
 *   5 6 1
 * Cada zona se subdivide en 4 cuadrantes:
 *   C | B
 *   D | A
 * Flujo: primero se elige la zona (1-9), luego el cuadrante (a-d).
 */
const SUB_ROWS: AttackSubzone[][] = [
  ["c", "b"],
  ["d", "a"],
];

export function AttackDirectionGrid({ onPick, value, subValue }: Props) {
  const rows: AttackDirection[][] = [
    [4, 3, 2],
    [7, 8, 9],
    [5, 6, 1],
  ];

  const [pending, setPending] = useState<AttackDirection | null>(value ?? null);
  useEffect(() => { setPending(value ?? null); }, [value]);

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
        <div className="grid grid-rows-3 h-full">
          {rows.map((row, r) => (
            <div key={r} className="grid grid-cols-3 gap-[2px] p-[2px]">
              {row.map((d) => {
                const isPending = pending === d;
                if (isPending) {
                  return (
                    <div
                      key={d}
                      className="relative rounded-md border-2 border-primary bg-primary/30 overflow-hidden"
                    >
                      <span className="absolute top-0.5 left-1 text-[10px] font-black text-white/80">{d}</span>
                      <div className="grid grid-rows-2 h-full">
                        {SUB_ROWS.map((srow, si) => (
                          <div key={si} className="grid grid-cols-2 gap-[2px] p-[2px]">
                            {srow.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => onPick(d, s)}
                                className={`rounded-sm font-black text-xs sm:text-sm uppercase text-white border transition-all active:scale-95 flex items-center justify-center ${
                                  subValue === s && value === d
                                    ? "border-white bg-primary"
                                    : "border-white/50 bg-black/25 hover:bg-primary/60"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPending(d)}
                    className={`rounded-md font-black text-lg sm:text-xl text-white/90 border-2 transition-all active:scale-95 flex items-center justify-center ${
                      value === d
                        ? "border-primary bg-primary/60"
                        : "border-white/40 bg-black/20 hover:bg-primary/40 hover:border-primary"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-center text-muted-foreground">
        {pending
          ? `Zona ${pending}: elegí el cuadrante (C·B arriba / D·A abajo) · teclas A-D`
          : "4-3-2 pegado a la red · 7-8-9 zona media · 5-6-1 al fondo"}
      </p>
    </div>
  );
}
