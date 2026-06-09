import { cn } from "@/lib/utils";
import type { Team } from "@/lib/volley-store";

export function TeamBadge({
  team,
  size = "md",
  className,
}: {
  team: Pick<Team, "shortName" | "color" | "logoUrl"> | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-7 text-[10px]",
    md: "size-10 text-xs",
    lg: "size-14 text-sm",
  };

  if (team?.logoUrl) {
    return (
      <div
        className={cn(
          "rounded-lg overflow-hidden shrink-0 ring-1 ring-white/10 bg-background flex items-center justify-center",
          sizes[size],
          className,
        )}
      >
        <img src={team.logoUrl} alt={team.shortName ?? "logo"} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center font-bold tracking-wider shrink-0 ring-1 ring-white/10",
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: team?.color ?? "var(--muted)",
        color: "#0b0f1a",
      }}
    >
      {team?.shortName ?? "—"}
    </div>
  );
}
