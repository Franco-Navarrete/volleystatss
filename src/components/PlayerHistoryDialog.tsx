import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlayerAggregate } from "@/lib/historical-stats";
import { Trophy, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aggregate: PlayerAggregate | null;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PlayerHistoryDialog({ open, onOpenChange, aggregate }: Props) {
  if (!aggregate) return null;
  const { player, team, totals, averages, records, lastMatches, matchesPlayed } = aggregate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="size-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: team.color + "33", color: team.color }}
            >
              {player.photoUrl ? (
                <img src={player.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>#{player.number}</span>
              )}
            </div>
            <div className="text-left min-w-0">
              <div className="text-base font-bold truncate">{player.name}</div>
              <div className="text-xs text-muted-foreground font-normal truncate">
                {team.name} · #{player.number}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Totales */}
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
              Acumulado · {matchesPlayed} {matchesPlayed === 1 ? "partido" : "partidos"}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Puntos" value={totals.points} accent />
              <Stat label="Ataques" value={totals.attack} />
              <Stat label="Bloqueos" value={totals.block} />
              <Stat label="Aces" value={totals.ace} />
              <Stat label="Contra" value={totals.counterAttack} />
              <Stat label="MVP" value={totals.mvp} />
            </div>
          </section>

          {/* Promedios */}
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
              Promedios por partido
            </h3>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Puntos" value={averages.points.toFixed(1)} accent />
              <Stat label="Ataques" value={averages.attack.toFixed(1)} />
              <Stat label="Bloqueos" value={averages.block.toFixed(1)} />
              <Stat label="Aces" value={averages.ace.toFixed(1)} />
            </div>
          </section>

          {/* Récords */}
          {(records.points || records.block || records.ace) && (
            <section>
              <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-1">
                <Trophy className="size-3" /> Récords personales
              </h3>
              <div className="space-y-1.5">
                {records.points && (
                  <RecordRow label="Puntos en un partido" record={records.points} unit="puntos" />
                )}
                {records.block && (
                  <RecordRow label="Bloqueos en un partido" record={records.block} unit="bloqueos" />
                )}
                {records.ace && (
                  <RecordRow label="Aces en un partido" record={records.ace} unit="aces" />
                )}
              </div>
            </section>
          )}

          {/* Últimos 5 */}
          {lastMatches.length > 0 && (
            <section>
              <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                Últimos {lastMatches.length} {lastMatches.length === 1 ? "partido" : "partidos"}
              </h3>
              <div className="space-y-1">
                {lastMatches.map((m) => (
                  <div
                    key={m.matchId}
                    className="flex items-center gap-2 text-sm bg-card/40 border border-border/40 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        vs {m.opponentName}
                        {m.wasMvp && <Sparkles className="size-3 text-primary shrink-0" />}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{formatDate(m.date)}</div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <div className="font-bold">{m.points} pts</div>
                      <div className="text-[10px] text-muted-foreground">
                        {m.attack}A · {m.block}B · {m.ace}S
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="bg-card/50 border border-border/40 rounded-lg px-2 py-2 text-center">
      <div className={["tabular-nums font-black text-xl", accent ? "text-primary" : ""].join(" ")}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function RecordRow({ label, record, unit }: { label: string; record: { value: number; opponentName: string; date: number }; unit: string }) {
  return (
    <div className="flex items-center gap-3 bg-card/40 border border-border/40 rounded-lg px-3 py-2">
      <Trophy className="size-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          vs {record.opponentName} · {formatDate(record.date)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-black text-lg tabular-nums">{record.value}</div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{unit}</div>
      </div>
    </div>
  );
}
