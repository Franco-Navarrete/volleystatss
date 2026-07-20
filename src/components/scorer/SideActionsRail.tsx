import { ArrowLeftRight, Shirt, Hourglass, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  side: "left" | "right";
  disabled: boolean;
  timeoutsUsed: number;
  onCambio: () => void;
  onLibero: () => void;
  onTiempo: () => void;
  onSancion: () => void;
}

/**
 * Columna compacta de botones cuadrados (icono + tooltip) usada
 * a los costados de la cancha. Optimizada para que un entrenador
 * pueda accionar sin quitar la mirada de la cancha.
 */
export function SideActionsRail({
  side,
  disabled,
  timeoutsUsed,
  onCambio,
  onLibero,
  onTiempo,
  onSancion,
}: Props) {
  const items = [
    { key: "cambio", label: "Cambio", icon: <ArrowLeftRight className="size-4 md:size-5" />, onClick: onCambio, disabled },
    { key: "libero", label: "Líbero", icon: <Shirt className="size-4 md:size-5" />, onClick: onLibero, disabled },
    { key: "tiempo", label: `Tiempo (${timeoutsUsed}/2)`, icon: <Hourglass className="size-4 md:size-5" />, onClick: onTiempo, disabled: disabled || timeoutsUsed >= 2, badge: `${timeoutsUsed}/2` },
    { key: "sancion", label: "Sanción", icon: <AlertTriangle className="size-4 md:size-5" />, onClick: onSancion, disabled, danger: true },
  ] as const;
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`flex flex-col gap-1.5 md:gap-2 w-[44px] sm:w-[48px] md:w-[56px] shrink-0 justify-center`}
        data-side={side}
      >
        {items.map((it) => (
          <Tooltip key={it.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={it.onClick}
                disabled={it.disabled}
                aria-label={it.label}
                className={`relative grid place-items-center aspect-square w-full rounded-lg border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                  (it as any).danger
                    ? "bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20"
                    : "bg-card border-border/60 text-foreground/80 hover:text-primary hover:border-primary/60 hover:bg-primary/5"
                }`}
              >
                {it.icon}
                {"badge" in it && it.badge && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-background border border-border/60 px-1 text-[8px] font-black scoreboard-digit tabular-nums leading-none py-[1px]">
                    {it.badge}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side={side === "left" ? "right" : "left"} className="text-xs">
              {it.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
