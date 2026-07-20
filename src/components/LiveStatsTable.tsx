import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Team } from "@/lib/volley-store";

export type LiveStatsRow = {
  playerId: string;
  name: string;
  number: number;
  kills: number;
  attackAttempts: number;
  attackError: number;
  effAtk: number;
  block: number;
  blockError: number;
  effBlk: number;
  ace: number;
  serveError: number;
  total: number;
  recTotal: number;
  recDoublePos: number;
  recPositive: number;
  recNeutral: number;
  recNegative: number;
  recDoubleNeg: number;
  recOverpass: number;
  recPositivity: number;
  recEff: number;
  unforcedErrors: number;
};

export type LiveStatsTeamSummary = {
  attack: number;
  block: number;
  ace: number;
  errors: number;
  recPositivity: number;
  recTotal: number;
};

type Category = "attack" | "reception" | "serve" | "block";
type SortKey =
  | "number" | "name" | "total"
  | "kills" | "attackAttempts" | "effAtk" | "attackError"
  | "recTotal" | "recDoubleNeg" | "recPositivity"
  | "ace" | "serveError"
  | "block" | "blockError";

const CATS: { key: Category; label: string }[] = [
  { key: "attack", label: "Ataque" },
  { key: "reception", label: "Recepción" },
  { key: "serve", label: "Saque" },
  { key: "block", label: "Bloqueo" },
];

const percentTone = (v: number, good = 45, bad = 20) =>
  v >= good ? "text-success" : v <= bad ? "text-destructive" : "text-amber-500 dark:text-amber-400";

const totalTone = (v: number) =>
  v >= 8 ? "text-success" : v <= 2 ? "text-muted-foreground" : "text-primary";

function StorageKey(teamId: string, k: string) {
  return `livestats:${teamId}:${k}`;
}

function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (nv: T) => {
    setV(nv);
    try { localStorage.setItem(key, JSON.stringify(nv)); } catch { /* noop */ }
  };
  return [v, set];
}

export function LiveStatsTable({
  team,
  rows,
  summary,
}: {
  team: Team;
  rows: LiveStatsRow[];
  summary: LiveStatsTeamSummary;
}) {
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useLocalState<Record<Category, boolean>>(
    StorageKey(team.id, "cats"),
    { attack: true, reception: true, serve: true, block: true },
  );
  const [compact, setCompact] = useLocalState<boolean>(StorageKey(team.id, "compact"), false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = rows.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        String(r.number).includes(q),
      );
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = (a as any)[sort.key];
      const bv = (b as any)[sort.key];
      if (typeof av === "string") return av.localeCompare(bv as string) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
  }, [rows, query, sort]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setSortKey = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  };

  const Sortable = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <button
      type="button"
      onClick={() => setSortKey(k)}
      className={`inline-flex items-center gap-0.5 hover:text-foreground transition ${className}`}
    >
      {children}
      {sort.key === k ? (sort.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
    </button>
  );

  const rowPy = compact ? "py-1" : "py-1.5";
  const textSize = compact ? "text-[11px]" : "text-xs";
  const headSize = compact ? "text-[9px]" : "text-[10px]";
  const nameColW = compact ? "min-w-[140px]" : "min-w-[170px]";

  // Column count for colSpan when empty
  const activeCount = (enabled.attack ? 4 : 0) + (enabled.reception ? 3 : 0) + (enabled.serve ? 2 : 0) + (enabled.block ? 2 : 0);

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
      {/* Team header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/60" style={{ background: `${team.color}22` }}>
        <span className="size-6 rounded text-white text-[10px] font-black flex items-center justify-center shrink-0" style={{ background: team.color }}>{team.shortName}</span>
        <h3 className="font-bold text-sm truncate flex-1 min-w-0">{team.name}</h3>
        <span className="scoreboard-digit text-lg font-black text-primary tabular-nums">{summary.attack + summary.block + summary.ace}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-2 bg-secondary/20 border-b border-border/60">
        {[
          { label: "Ataques", value: summary.attack, tone: "text-primary" },
          { label: "Bloqueos", value: summary.block, tone: "text-primary" },
          { label: "Aces", value: summary.ace, tone: "text-primary" },
          { label: "Errores", value: summary.errors, tone: "text-destructive" },
          {
            label: "Recepción",
            value: summary.recTotal > 0 ? `${summary.recPositivity.toFixed(0)}%` : "—",
            tone: summary.recTotal > 0 ? percentTone(summary.recPositivity, 50, 30) : "text-muted-foreground",
          },
        ].map((c) => (
          <div key={c.label} className="rounded-lg bg-background/60 border border-border/40 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{c.label}</p>
            <p className={`scoreboard-digit font-black text-base tabular-nums ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-2 py-2 border-b border-border/60 bg-background/70">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar #, nombre..."
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setEnabled({ ...enabled, [c.key]: !enabled[c.key] })}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border transition ${
                enabled[c.key]
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-muted-foreground border-border/60 hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-secondary/40 px-2 py-1 text-[10px] font-bold uppercase tracking-widest hover:text-foreground">
              <SlidersHorizontal className="size-3" /> Opciones
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`compact-${team.id}`} className="text-xs">Modo compacto</Label>
              <Switch id={`compact-${team.id}`} checked={compact} onCheckedChange={(v) => setCompact(!!v)} />
            </div>
            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Categorías</p>
              {CATS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-xs">
                  <Checkbox checked={enabled[c.key]} onCheckedChange={(v) => setEnabled({ ...enabled, [c.key]: !!v })} />
                  {c.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table with sticky first columns + sticky header */}
      <div className="relative max-h-[60dvh] overflow-auto">
        <table className={`w-full ${textSize} border-separate border-spacing-0`}>
          <thead className={`${headSize} uppercase tracking-widest text-muted-foreground`}>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-secondary/60 backdrop-blur px-1 py-1.5 text-center w-8">
                <span className="sr-only">Expandir</span>
              </th>
              <th className="sticky top-0 left-8 z-30 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center w-12">
                <Sortable k="number">#</Sortable>
              </th>
              <th className={`sticky top-0 left-20 z-30 bg-secondary/60 backdrop-blur px-2 py-1.5 text-left ${nameColW}`}>
                <Sortable k="name">Jugador</Sortable>
              </th>
              {enabled.attack && (
                <>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="attackAttempts">ATK</Sortable></th>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="kills">PTS</Sortable></th>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="effAtk">%</Sortable></th>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="attackError">Err</Sortable></th>
                </>
              )}
              {enabled.reception && (
                <>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="recTotal">Rec</Sortable></th>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="recDoubleNeg">=</Sortable></th>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="recPositivity">%</Sortable></th>
                </>
              )}
              {enabled.serve && (
                <>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="ace">Aces</Sortable></th>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="serveError">Err</Sortable></th>
                </>
              )}
              {enabled.block && (
                <>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="block">Blk</Sortable></th>
                  <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center"><Sortable k="blockError">Err</Sortable></th>
                </>
              )}
              <th className="sticky top-0 z-20 bg-secondary/60 backdrop-blur px-2 py-1.5 text-center text-primary"><Sortable k="total">TOT</Sortable></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isOpen = expanded.has(p.playerId);
              const hasAtk = p.attackAttempts > 0;
              const hasRec = p.recTotal > 0;
              const hasBlk = p.block + p.blockError > 0;
              return (
                <>
                  <tr
                    key={p.playerId}
                    className="border-t border-border/40 hover:bg-secondary/30 cursor-pointer"
                    onClick={() => toggleExpand(p.playerId)}
                  >
                    <td className={`sticky left-0 z-10 bg-card ${rowPy} px-1 text-center`}>
                      {isOpen ? <ChevronDown className="size-3.5 mx-auto text-muted-foreground" /> : <ChevronRight className="size-3.5 mx-auto text-muted-foreground" />}
                    </td>
                    <td className={`sticky left-8 z-10 bg-card ${rowPy} px-2 text-center scoreboard-digit font-bold tabular-nums`}>
                      {p.number}
                    </td>
                    <td className={`sticky left-20 z-10 bg-card ${rowPy} px-2 whitespace-nowrap font-medium ${nameColW}`}>
                      {p.name}
                    </td>
                    {enabled.attack && (
                      <>
                        <td className={`${rowPy} px-2 text-center tabular-nums`}>{p.attackAttempts}</td>
                        <td className={`${rowPy} px-2 text-center tabular-nums font-bold`}>{p.kills}</td>
                        <td className={`${rowPy} px-2 text-center tabular-nums font-bold ${hasAtk ? percentTone(p.effAtk) : "text-muted-foreground"}`}>{hasAtk ? `${p.effAtk.toFixed(0)}%` : "—"}</td>
                        <td className={`${rowPy} px-2 text-center tabular-nums ${p.attackError > 0 ? "text-destructive" : "text-muted-foreground"}`}>{p.attackError}</td>
                      </>
                    )}
                    {enabled.reception && (
                      <>
                        <td className={`${rowPy} px-2 text-center tabular-nums`}>{p.recTotal}</td>
                        <td className={`${rowPy} px-2 text-center tabular-nums ${p.recDoubleNeg > 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>{p.recDoubleNeg}</td>
                        <td className={`${rowPy} px-2 text-center tabular-nums font-bold ${hasRec ? percentTone(p.recPositivity, 50, 30) : "text-muted-foreground"}`}>{hasRec ? `${p.recPositivity.toFixed(0)}%` : "—"}</td>
                      </>
                    )}
                    {enabled.serve && (
                      <>
                        <td className={`${rowPy} px-2 text-center tabular-nums ${p.ace > 0 ? "text-success font-bold" : ""}`}>{p.ace}</td>
                        <td className={`${rowPy} px-2 text-center tabular-nums ${p.serveError > 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>{p.serveError}</td>
                      </>
                    )}
                    {enabled.block && (
                      <>
                        <td className={`${rowPy} px-2 text-center tabular-nums ${p.block > 0 ? "font-bold" : ""}`}>{p.block}</td>
                        <td className={`${rowPy} px-2 text-center tabular-nums ${p.blockError > 0 ? "text-destructive" : "text-muted-foreground"}`}>{p.blockError}</td>
                      </>
                    )}
                    <td className={`${rowPy} px-2 text-center tabular-nums scoreboard-digit font-black ${totalTone(p.total)}`}>{p.total}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-secondary/20 border-t border-border/30">
                      <td className="sticky left-0 bg-secondary/20" />
                      <td colSpan={2 + activeCount + 1} className="px-3 py-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <DetailBlock label="Ataque">
                            <DetailRow k="Intentos" v={p.attackAttempts} />
                            <DetailRow k="Puntos" v={p.kills} good />
                            <DetailRow k="Errores" v={p.attackError} bad />
                            <DetailRow k="Efic." v={hasAtk ? `${p.effAtk.toFixed(0)}%` : "—"} />
                          </DetailBlock>
                          <DetailBlock label="Recepción">
                            <DetailRow k="Total" v={p.recTotal} />
                            <DetailRow k="# / +" v={`${p.recDoublePos} / ${p.recPositive}`} good />
                            <DetailRow k="0 / − / = / ≠" v={`${p.recNeutral} / ${p.recNegative} / ${p.recDoubleNeg} / ${p.recOverpass}`} />
                            <DetailRow k="Efic." v={hasRec ? `${p.recEff.toFixed(0)}%` : "—"} />
                          </DetailBlock>
                          <DetailBlock label="Saque">
                            <DetailRow k="Aces" v={p.ace} good />
                            <DetailRow k="Errores" v={p.serveError} bad />
                          </DetailBlock>
                          <DetailBlock label="Bloqueo">
                            <DetailRow k="Puntos" v={p.block} good />
                            <DetailRow k="Errores" v={p.blockError} bad />
                            <DetailRow k="Efic." v={hasBlk ? `${p.effBlk.toFixed(0)}%` : "—"} />
                          </DetailBlock>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3 + activeCount + 1} className="text-center py-4 text-muted-foreground text-xs">
                  {query ? "Sin resultados." : "Sin puntos aún."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-background/70 border border-border/40 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function DetailRow({ k, v, good, bad }: { k: string; v: React.ReactNode; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`tabular-nums font-bold ${good ? "text-success" : bad ? "text-destructive" : ""}`}>{v}</span>
    </div>
  );
}
