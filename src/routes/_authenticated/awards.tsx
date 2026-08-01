import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Award, Crown, Shield, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useVolley,
  TEAM_CATEGORIES,
  TEAM_CATEGORY_LABEL,
  type TeamCategory,
} from "@/lib/volley-store";
import { computeHistoricalStats } from "@/lib/historical-stats";
import { computeAwards, DEFAULT_WEIGHTS, type AwardPick } from "@/lib/awards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/awards")({
  head: () => ({ meta: [{ title: "Premios Rally · RALLY" }] }),
  component: AwardsPage,
});

function AwardsPage() {
  const { user } = useAuthUser();
  const { isAdmin } = useIsAdmin();
  const matches = useVolley((s) => s.matches);
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);

  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "F" | "M">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | TeamCategory>("all");
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

  // If coach and no league selected, try to find their club's league
  useEffect(() => {
    if (!isAdmin && user && leagueFilter === "all" && leagues.length > 0) {
      const myTeams = teams.filter((t) => t.ownerId === user.id);
      const myLeagueIds = Array.from(new Set(myTeams.map((t) => t.leagueId).filter(Boolean)));
      if (myLeagueIds.length > 0) {
        setLeagueFilter(myLeagueIds[0] as string);
      }
    }
  }, [isAdmin, user, teams, leagues, leagueFilter]);

  // Filter teams first to scope which players count.
  const scopedTeams = useMemo(() => {
    return teams.filter((t) => {
      // Restricción Coach: solo ver premios relacionados a su club (sus equipos propiedad)
      if (!isAdmin && user) {
        if (t.ownerId !== user.id) return false;
      }

      if (leagueFilter !== "all" && t.leagueId !== leagueFilter) return false;
      if (genderFilter !== "all" && t.gender !== genderFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [teams, leagueFilter, genderFilter, categoryFilter, isAdmin, user]);

  const scopedTeamIds = useMemo(() => new Set(scopedTeams.map((t) => t.id)), [scopedTeams]);

  const scopedMatches = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.status === "finished" &&
          scopedTeamIds.has(m.teamAId) &&
          scopedTeamIds.has(m.teamBId),
      ),
    [matches, scopedTeamIds],
  );

  const aggregates = useMemo(
    () => computeHistoricalStats(scopedMatches, scopedTeams),
    [scopedMatches, scopedTeams],
  );

  const awards = useMemo(() => computeAwards(aggregates, weights), [aggregates, weights]);

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Award className="size-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">Premios Rally</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Equipo ideal y premios individuales calculados con partidos finalizados.
            </p>
          </div>
          <WeightsSheet weights={weights} setWeights={setWeights} />
        </header>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <FilterSelect
            label="Liga"
            value={leagueFilter}
            onChange={setLeagueFilter}
            options={[
              { value: "all", label: "Todas las ligas" },
              ...leagues.map((l) => ({
                value: l.id,
                label: l.name + (l.season ? ` · ${l.season}` : ""),
              })),
            ]}
          />
          <FilterSelect
            label="Categoría"
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v as "all" | TeamCategory)}
            options={[
              { value: "all", label: "Todas" },
              ...TEAM_CATEGORIES.map((c) => ({ value: c, label: TEAM_CATEGORY_LABEL[c] })),
            ]}
          />
          <FilterSelect
            label="Género"
            value={genderFilter}
            onChange={(v) => setGenderFilter(v as "all" | "F" | "M")}
            options={[
              { value: "all", label: "Todos" },
              { value: "F", label: "Femenino" },
              { value: "M", label: "Masculino" },
            ]}
          />
        </div>

        {scopedMatches.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No hay partidos finalizados que coincidan con los filtros.
          </div>
        ) : (
          <>
            {/* Equipo Ideal */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Equipo Ideal
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <IdealSlot label="Armadora" picks={awards.ideal.armador ? [awards.ideal.armador] : []} highlight />
                <IdealSlot label="Puntas" picks={awards.ideal.puntas} expectCount={2} />
                <IdealSlot label="Centrales" picks={awards.ideal.centrales} expectCount={2} />
                <IdealSlot label="Opuesta" picks={awards.ideal.opuesto ? [awards.ideal.opuesto] : []} />
                <IdealSlot label="Líbero" picks={awards.ideal.libero ? [awards.ideal.libero] : []} />
              </div>
            </section>

            {/* Premios individuales */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
                Premios individuales
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <AwardCard icon={Crown} title="MVP del torneo" pick={awards.mvp} accent />
                <AwardCard icon={Zap} title="Máxima anotadora" pick={awards.topScorer} />
                <AwardCard icon={Target} title="Mejor atacante" pick={awards.bestAttacker} />
                <AwardCard icon={Shield} title="Mejor bloqueadora" pick={awards.bestBlocker} />
                <AwardCard icon={Trophy} title="Mejor sacadora" pick={awards.bestServer} />
                <AwardCard icon={Star} title="Mejor receptora" pick={awards.bestReceiver} />
                <AwardCard icon={Sparkles} title="Revelación" pick={awards.revelation} />
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function IdealSlot({
  label, picks, expectCount = 1, highlight = false,
}: {
  label: string;
  picks: AwardPick[];
  expectCount?: number;
  highlight?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-2xl border bg-card overflow-hidden",
        highlight ? "border-primary/40 shadow-glow" : "border-border/60",
      ].join(" ")}
    >
      <header className="px-4 py-2 border-b border-border/60 bg-secondary/30">
        <h3 className="text-xs font-bold uppercase tracking-widest">{label}</h3>
      </header>
      <ul className="divide-y divide-border/40">
        {picks.map((p) => (
          <PlayerRow key={p.aggregate.player.id} pick={p} />
        ))}
        {Array.from({ length: Math.max(0, expectCount - picks.length) }).map((_, i) => (
          <li key={`empty-${i}`} className="px-4 py-4 text-xs text-muted-foreground italic">
            Sin candidatas suficientes
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayerRow({ pick }: { pick: AwardPick }) {
  const { aggregate: a } = pick;
  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <span className="size-2.5 rounded-full shrink-0" style={{ background: a.team.color }} />
      <span className="size-7 rounded scoreboard-digit font-bold bg-background border border-border/60 flex items-center justify-center text-xs shrink-0">
        {a.player.number}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{a.player.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {a.team.name} · {pick.detail}
        </div>
      </div>
      <span className="scoreboard-digit font-black text-lg text-primary tabular-nums">
        {pick.score.toFixed(0)}
      </span>
    </li>
  );
}

function AwardCard({
  icon: Icon, title, pick, accent = false,
}: {
  icon: typeof Trophy;
  title: string;
  pick: AwardPick | null;
  accent?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-2xl border bg-card p-4",
        accent ? "border-primary/50 bg-gradient-surface shadow-glow" : "border-border/60",
      ].join(" ")}
    >
      <header className="flex items-center gap-2 mb-2">
        <Icon className={`size-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        <h3 className="text-[10px] font-bold uppercase tracking-widest">{title}</h3>
      </header>
      {pick ? (
        <>
          <div className="font-extrabold text-sm truncate">{pick.aggregate.player.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{pick.aggregate.team.name}</div>
          <div className="mt-1 text-xs text-foreground/80">{pick.detail}</div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground italic">Sin datos</div>
      )}
    </section>
  );
}

function WeightsSheet({
  weights, setWeights,
}: {
  weights: typeof DEFAULT_WEIGHTS;
  setWeights: (w: typeof DEFAULT_WEIGHTS) => void;
}) {
  const update = <K extends keyof typeof DEFAULT_WEIGHTS>(key: K, v: number) =>
    setWeights({ ...weights, [key]: v });
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">Ajustar fórmula</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] sm:w-[380px]">
        <SheetHeader>
          <SheetTitle>Pesos de la fórmula</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-6">
          <WeightSlider label="Mínimo partidos" value={weights.minMatches} max={10} step={1} onChange={(v) => update("minMatches", v)} />
          <WeightSlider label="Ataque" value={weights.attack} max={3} step={0.1} onChange={(v) => update("attack", v)} />
          <WeightSlider label="Bloqueo" value={weights.block} max={3} step={0.1} onChange={(v) => update("block", v)} />
          <WeightSlider label="Ace" value={weights.ace} max={3} step={0.1} onChange={(v) => update("ace", v)} />
          <WeightSlider label="MVP" value={weights.mvp} max={5} step={0.5} onChange={(v) => update("mvp", v)} />
          <WeightSlider label="Recepción" value={weights.reception} max={2} step={0.1} onChange={(v) => update("reception", v)} />
          <WeightSlider label="Penalidad por error" value={weights.errorPenalty} max={2} step={0.1} onChange={(v) => update("errorPenalty", v)} />
          <Button variant="ghost" size="sm" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
            Restaurar por defecto
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WeightSlider({
  label, value, max, step, onChange,
}: {
  label: string; value: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Slider value={[value]} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}
