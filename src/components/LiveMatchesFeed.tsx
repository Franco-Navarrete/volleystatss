import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { listLivePublicMatches } from "@/lib/public-match.functions";
import type { MatchSet } from "@/lib/volley-store";

/**
 * Feed de partidos EN VIVO compartidos públicamente.
 * Visible para todos los roles autenticados — incluso quienes no tienen
 * acceso al partido en su propio store pueden abrir la vista pública `/m/$slug`.
 */
export function LiveMatchesFeed() {
  const fetchLive = useServerFn(listLivePublicMatches);
  const { data, isLoading } = useQuery({
    queryKey: ["live-public-matches"],
    queryFn: () => fetchLive(),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const items = data ?? [];
  if (isLoading && items.length === 0) return null;
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden mb-8">
      <header className="px-5 py-3 border-b border-border/60 flex items-center gap-2">
        <Radio className="size-4 text-destructive animate-pulse" />
        <h2 className="font-bold text-sm uppercase tracking-widest">
          Partidos en vivo · {items.length}
        </h2>
      </header>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        {items.map((m) => {
          const sets = (m.sets ?? []) as MatchSet[];
          let setsA = 0;
          let setsB = 0;
          for (const s of sets) {
            if (!s.finished) continue;
            if (s.scoreA > s.scoreB) setsA++;
            else if (s.scoreB > s.scoreA) setsB++;
          }
          const current = sets[sets.length - 1];
          return (
            <li key={m.slug}>
              <Link
                to="/m/$slug"
                params={{ slug: m.slug }}
                className="block rounded-xl border border-border/60 bg-background/40 p-3 hover:border-destructive/60 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-destructive font-bold flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
                    En vivo
                  </span>
                  {m.leagueName && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground truncate max-w-[50%]">
                      {m.leagueName}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate text-sm">{m.teamA.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.teamB.name}</div>
                  </div>
                  <div className="text-right scoreboard-digit">
                    <div className="text-xl font-extrabold tabular-nums">
                      <span className={setsA >= setsB ? "text-primary" : "text-muted-foreground"}>{setsA}</span>
                      <span className="text-muted-foreground mx-1">-</span>
                      <span className={setsB >= setsA ? "text-primary" : "text-muted-foreground"}>{setsB}</span>
                    </div>
                    {current && (
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                        Set {sets.length} · {current.scoreA}-{current.scoreB}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
