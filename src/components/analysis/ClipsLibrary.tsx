/**
 * ClipsLibrary — tarjetas navegables con miniatura, metadata y acciones.
 * Virtualiza mediante "página" simple (chunk incremental) para partidos largos.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Star, Play, Plus, Tag as TagIcon, Pencil, Trash2 } from "lucide-react";
import type { Clip } from "@/lib/analysis/clip-service";
import { useClipMetaStore } from "@/lib/analysis/clip-service";
import { MARK_COLORS, MARK_LABEL } from "@/lib/video-marks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  matchId: string;
  clips: Clip[];
  videoSrc: string | null;
  isYouTube: boolean;
  currentMs: number;
  onPlay: (c: Clip) => void;
  onAddToPlaylist: (c: Clip) => void;
}

const PAGE = 24;

export function ClipsLibrary({
  matchId,
  clips,
  videoSrc,
  isYouTube,
  currentMs,
  onPlay,
  onAddToPlaylist,
}: Props) {
  const [limit, setLimit] = useState(PAGE);
  const setName = useClipMetaStore((s) => s.setName);
  const toggleFav = useClipMetaStore((s) => s.toggleFavorite);
  const addTag = useClipMetaStore((s) => s.addTag);
  const removeTag = useClipMetaStore((s) => s.removeTag);

  const shown = useMemo(() => clips.slice(0, limit), [clips, limit]);

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-muted-foreground">
        {clips.length} clip{clips.length === 1 ? "" : "s"} en biblioteca
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {shown.map((c) => (
          <ClipCard
            key={c.id}
            clip={c}
            videoSrc={videoSrc}
            isYouTube={isYouTube}
            active={Math.abs(currentMs - c.tMs) < 500}
            onPlay={() => onPlay(c)}
            onToggleFav={() => toggleFav(matchId, c.id)}
            onRename={(name) => setName(matchId, c.id, name)}
            onAddTag={(t) => addTag(matchId, c.id, t)}
            onRemoveTag={(t) => removeTag(matchId, c.id, t)}
            onAddToPlaylist={() => onAddToPlaylist(c)}
          />
        ))}
      </div>
      {clips.length > limit && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
            Cargar más ({clips.length - limit} restantes)
          </Button>
        </div>
      )}
      {clips.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-10">
          Sin clips con los filtros actuales.
        </div>
      )}
    </div>
  );
}

interface CardProps {
  clip: Clip;
  videoSrc: string | null;
  isYouTube: boolean;
  active: boolean;
  onPlay: () => void;
  onToggleFav: () => void;
  onRename: (name: string) => void;
  onAddTag: (t: string) => void;
  onRemoveTag: (t: string) => void;
  onAddToPlaylist: () => void;
}

function ClipCard({
  clip,
  videoSrc,
  isYouTube,
  active,
  onPlay,
  onToggleFav,
  onRename,
  onAddTag,
  onRemoveTag,
  onAddToPlaylist,
}: CardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(clip.title);
  const [tagInput, setTagInput] = useState("");
  const color = MARK_COLORS[clip.kind];

  return (
    <div
      className={`rounded-lg border bg-card/60 overflow-hidden flex flex-col transition-colors ${
        active ? "border-primary shadow-glow" : "border-border"
      }`}
    >
      <Thumbnail videoSrc={videoSrc} isYouTube={isYouTube} tMs={clip.tMs} onPlay={onPlay} />
      <div className="p-2 flex flex-col gap-1.5 text-xs">
        <div className="flex items-start gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full mt-1 shrink-0"
            style={{ background: color }}
          />
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                onRename(name.trim() || clip.title);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setName(clip.title); setEditing(false); }
              }}
              className="flex-1 bg-background/60 border border-primary/60 rounded px-1 py-0.5 text-xs min-w-0"
            />
          ) : (
            <div className="flex-1 font-semibold truncate min-w-0" title={clip.title}>
              {clip.title}
            </div>
          )}
          <button onClick={onToggleFav} className="p-0.5" title="Favorito">
            <Star
              className={`size-3.5 ${clip.meta.favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
            />
          </button>
        </div>
        <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
          <span>{MARK_LABEL[clip.kind]}</span>
          <span>· Set {clip.setNumber}</span>
          <span>· R{clip.rallyId + 1}</span>
          <span>· {(clip.tMs / 1000).toFixed(1)}s</span>
          <span>· {(clip.durationMs / 1000).toFixed(1)}s dur</span>
        </div>
        {(clip.playerName || clip.team) && (
          <div className="text-[10px] text-muted-foreground truncate">
            {clip.playerNumber ? `#${clip.playerNumber} ` : ""}
            {clip.playerName ?? ""} {clip.team ? `· ${clip.team}` : ""}
          </div>
        )}
        {clip.meta.tags && clip.meta.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {clip.meta.tags.map((t) => (
              <button
                key={t}
                onClick={() => onRemoveTag(t)}
                className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30 hover:bg-red-500/20 hover:border-red-500/50"
                title="Quitar tag"
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 mt-1">
          <Button size="sm" variant="secondary" className="h-7 flex-1" onClick={onPlay}>
            <Play className="size-3 mr-1" /> Reproducir
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2">
                <TagIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="p-2 flex gap-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Nuevo tag"
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      onAddTag(tagInput.trim());
                      setTagInput("");
                    }
                  }}
                />
              </div>
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="size-3 mr-2" /> Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddToPlaylist}>
                <Plus className="size-3 mr-2" /> A playlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

/**
 * Miniatura: hace seek "invisible" en un <video> muted a inicioClipMs.
 * Se limita a fuentes no-YouTube (YouTube embed no permite pintar frames).
 */
function Thumbnail({
  videoSrc,
  isYouTube,
  tMs,
  onPlay,
}: {
  videoSrc: string | null;
  isYouTube: boolean;
  tMs: number;
  onPlay: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
  }, [videoSrc]);
  const canPreview = !!videoSrc && !isYouTube;
  return (
    <button
      onClick={onPlay}
      className="relative w-full aspect-video bg-black overflow-hidden group"
    >
      {canPreview ? (
        <video
          ref={ref}
          src={videoSrc!}
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = Math.max(0, tMs / 1000);
          }}
          onSeeked={() => setReady(true)}
        />
      ) : (
        <div className="w-full h-full grid place-items-center text-[10px] text-muted-foreground">
          {isYouTube ? "Preview YouTube" : "Sin fuente"}
        </div>
      )}
      <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <Play className="size-8 text-white drop-shadow" />
      </div>
      {!ready && canPreview && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
      )}
    </button>
  );
}

// Re-export for convenience.
export { Trash2 };
