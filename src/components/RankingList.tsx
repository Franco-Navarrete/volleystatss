import { useState } from "react";
import {
  type PlayerAggregate,
  type RankingMetricDef,
  rankBy,
} from "@/lib/historical-stats";
import { PlayerHistoryDialog } from "./PlayerHistoryDialog";

const MEDALS = ["🥇", "🥈", "🥉"];

interface Props {
  aggregates: PlayerAggregate[];
  metric: RankingMetricDef;
  limit?: number;
}

export function RankingList({ aggregates, metric, limit = 10 }: Props) {
  const ranked = rankBy(aggregates, metric, limit);
  const [openPlayerId, setOpenPlayerId] = useState<string | null>(null);
  const openAgg = openPlayerId ? aggregates.find((a) => a.player.id === openPlayerId) ?? null : null;

  if (ranked.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aún no hay datos suficientes para este ranking.
        {metric.minMatches && metric.minMatches > 1 && (
          <div className="mt-1 text-xs">Mínimo {metric.minMatches} partidos jugados.</div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {ranked.map((agg, idx) => {
          const isPodium = idx < 3;
          return (
            <button
              key={agg.player.id}
              type="button"
              onClick={() => setOpenPlayerId(agg.player.id)}
              className={[
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                isPodium
                  ? "bg-gradient-to-r from-secondary/60 to-secondary/20 border border-border/60 hover:from-secondary/80"
                  : "bg-card/40 hover:bg-card/70 border border-border/40",
              ].join(" ")}
            >
              <div className="w-9 text-center shrink-0">
                {isPodium ? (
                  <span className="text-2xl leading-none">{MEDALS[idx]}</span>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground tabular-nums">#{idx + 1}</span>
                )}
              </div>
              <div
                className="size-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: agg.team.color + "33", color: agg.team.color }}
              >
                {agg.player.photoUrl ? (
                  <img src={agg.player.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>#{agg.player.number}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate text-sm">
                  {agg.player.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {agg.team.shortName} · {agg.matchesPlayed} {agg.matchesPlayed === 1 ? "partido" : "partidos"}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={[
                    "tabular-nums font-black",
                    isPodium ? "text-2xl" : "text-lg",
                  ].join(" ")}
                  style={isPodium ? { color: agg.team.color } : undefined}
                >
                  {metric.format(agg)}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {metric.shortLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <PlayerHistoryDialog
        open={!!openAgg}
        onOpenChange={(o) => !o && setOpenPlayerId(null)}
        aggregate={openAgg}
      />
    </>
  );
}
