import { Search, Filter, Star, ArrowDownWideNarrow } from "lucide-react";
import { Input } from "@/components/ui/input";

export type StatusKey = "all" | "preparation" | "live" | "processing" | "analysis" | "finished";
export type VideoKey = "all" | "with" | "without" | "synced";
export type ScoutKey = "all" | "idle" | "progress" | "done";
export type SortKey = "recent" | "actions" | "analyzed";

export interface Filters {
  q: string;
  status: StatusKey;
  video: VideoKey;
  scout: ScoutKey;
  onlyFav: boolean;
  competition: string;
  category: string;
  teamId: string;
  sort: SortKey;
}

interface Props {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  competitions: string[];
  categories: string[];
  teams: { id: string; name: string }[];
}

export function MatchSessionFilters({ value, onChange, competitions, categories, teams }: Props) {
  return (
    <div className="bg-card/40 border border-border rounded-xl p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={value.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Buscar equipo, rival, competencia, categoría…"
            className="pl-8"
          />
        </div>

        <Select
          label="Competencia"
          value={value.competition}
          onChange={(v) => onChange({ competition: v })}
          options={[{ value: "all", label: "Todas" }, ...competitions.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          label="Categoría"
          value={value.category}
          onChange={(v) => onChange({ category: v })}
          options={[{ value: "all", label: "Todas" }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          label="Equipo"
          value={value.teamId}
          onChange={(v) => onChange({ teamId: v })}
          options={[{ value: "all", label: "Todos" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
        />

        <button
          onClick={() => onChange({ onlyFav: !value.onlyFav })}
          className={`px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1 border transition-colors ${value.onlyFav ? "bg-primary/15 text-primary border-primary/40" : "border-border text-muted-foreground hover:bg-secondary/50"}`}
        >
          <Star className={`size-3.5 ${value.onlyFav ? "fill-primary text-primary" : ""}`} /> Favoritos
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipGroup
          label="Estado"
          icon={<Filter className="size-3.5" />}
          value={value.status}
          onChange={(v) => onChange({ status: v as StatusKey })}
          options={[
            { value: "all", label: "Todos" },
            { value: "preparation", label: "Preparación" },
            { value: "live", label: "En vivo" },
            { value: "processing", label: "Procesando" },
            { value: "analysis", label: "Análisis" },
            { value: "finished", label: "Finalizados" },
          ]}
        />
        <ChipGroup
          label="Video"
          value={value.video}
          onChange={(v) => onChange({ video: v as VideoKey })}
          options={[
            { value: "all", label: "Todos" },
            { value: "with", label: "Con video" },
            { value: "synced", label: "Sincronizados" },
            { value: "without", label: "Sin video" },
          ]}
        />
        <ChipGroup
          label="Scout"
          value={value.scout}
          onChange={(v) => onChange({ scout: v as ScoutKey })}
          options={[
            { value: "all", label: "Todos" },
            { value: "idle", label: "Sin iniciar" },
            { value: "progress", label: "En progreso" },
            { value: "done", label: "Finalizados" },
          ]}
        />

        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowDownWideNarrow className="size-3.5" />
          <select
            value={value.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
            className="bg-input border border-border rounded px-2 py-1 text-xs"
          >
            <option value="recent">Más recientes</option>
            <option value="actions">Más acciones</option>
            <option value="analyzed">Últimos analizados</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-xs text-muted-foreground flex items-center gap-1">
      <span className="hidden sm:inline">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-input border border-border rounded px-2 py-1 text-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function ChipGroup({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-1 flex items-center gap-1">
        {icon} {label}
      </span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 rounded-md ${value === o.value ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50 text-muted-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
