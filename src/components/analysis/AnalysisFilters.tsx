/**
 * Barra de filtros combinables. Actualiza `useFilterStore`, que a su vez
 * es leído por ClipsLibrary, StatsPanelInteractive, PlaylistsPanel, etc.
 */
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Star, MapPin } from "lucide-react";
import { MARK_LABEL, type VideoMarkKind } from "@/lib/video-marks";
import { useFilterStore, FilterService } from "@/lib/analysis/filter-service";
import type { Clip } from "@/lib/analysis/clip-service";

interface Props {
  clips: Clip[];
  playlists: { id: string; name: string }[];
}

export function AnalysisFilters({ clips, playlists }: Props) {
  const filters = useFilterStore((s) => s.filters);
  const patch = useFilterStore((s) => s.patch);
  const toggleFundamento = useFilterStore((s) => s.toggleFundamento);
  const toggleSet = useFilterStore((s) => s.toggleSet);
  const toggleTag = useFilterStore((s) => s.toggleTag);
  const reset = useFilterStore((s) => s.reset);

  const options = useMemo(() => {
    const fundamentos = Array.from(new Set(clips.map((c) => c.kind))) as VideoMarkKind[];
    const sets = Array.from(new Set(clips.map((c) => c.setNumber))).sort();
    const players = Array.from(
      new Map(
        clips
          .filter((c) => c.playerId)
          .map((c) => [c.playerId!, `#${c.playerNumber ?? "?"} ${c.playerName ?? ""}`]),
      ).entries(),
    );
    const tags = Array.from(new Set(clips.flatMap((c) => c.meta.tags ?? []))).sort();
    const zones = Array.from(new Set(clips.map((c) => c.zone).filter((z): z is number => z != null))).sort();
    return { fundamentos, sets, players, tags, zones };
  }, [clips]);

  const isEmpty = FilterService.isEmpty(filters);

  return (
    <div className="bg-card/40 border border-border rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          placeholder="Buscar (jugadora, tag, resultado...)"
          className="h-8 text-sm"
        />
        <Button size="sm" variant="ghost" onClick={reset} disabled={isEmpty}>
          <X className="size-3 mr-1" /> Limpiar
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={filters.team === "A" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => patch({ team: filters.team === "A" ? null : "A" })}
        >
          Equipo A
        </Badge>
        <Badge
          variant={filters.team === "B" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => patch({ team: filters.team === "B" ? null : "B" })}
        >
          Equipo B
        </Badge>
        <Badge
          variant={filters.favoritesOnly ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => patch({ favoritesOnly: !filters.favoritesOnly })}
        >
          <Star className="size-3 mr-1" /> Favoritos
        </Badge>
        <Badge
          variant={filters.markersOnly ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => patch({ markersOnly: !filters.markersOnly })}
        >
          <MapPin className="size-3 mr-1" /> Marcadores
        </Badge>
      </div>

      {options.fundamentos.length > 0 && (
        <FilterRow label="Fundamento">
          {options.fundamentos.map((k) => (
            <Chip
              key={k}
              active={filters.fundamentos.includes(k)}
              onClick={() => toggleFundamento(k)}
            >
              {MARK_LABEL[k]}
            </Chip>
          ))}
        </FilterRow>
      )}

      {options.sets.length > 1 && (
        <FilterRow label="Set">
          {options.sets.map((n) => (
            <Chip key={n} active={filters.sets.includes(n)} onClick={() => toggleSet(n)}>
              Set {n}
            </Chip>
          ))}
        </FilterRow>
      )}

      {options.zones.length > 0 && (
        <FilterRow label="Zona">
          {options.zones.map((z) => (
            <Chip
              key={z}
              active={filters.zoneOrigin === z}
              onClick={() => patch({ zoneOrigin: filters.zoneOrigin === z ? null : z })}
            >
              Z{z}
            </Chip>
          ))}
        </FilterRow>
      )}

      {options.players.length > 0 && (
        <FilterRow label="Jugadora">
          <select
            className="bg-background/60 border border-border rounded px-2 py-1 text-xs"
            value={filters.playerId ?? ""}
            onChange={(e) => patch({ playerId: e.target.value || null })}
          >
            <option value="">Todas</option>
            {options.players.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </FilterRow>
      )}

      {options.tags.length > 0 && (
        <FilterRow label="Tags">
          {options.tags.map((t) => (
            <Chip key={t} active={filters.tags.includes(t)} onClick={() => toggleTag(t)}>
              #{t}
            </Chip>
          ))}
        </FilterRow>
      )}

      {playlists.length > 0 && (
        <FilterRow label="Playlist">
          <select
            className="bg-background/60 border border-border rounded px-2 py-1 text-xs"
            value={filters.playlistId ?? ""}
            onChange={(e) => patch({ playlistId: e.target.value || null })}
          >
            <option value="">Todas</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FilterRow>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background/60 border-border text-muted-foreground hover:border-primary/60"
      }`}
    >
      {children}
    </button>
  );
}
