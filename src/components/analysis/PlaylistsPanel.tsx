/**
 * PlaylistsPanel — CRUD ligero + reproducción secuencial.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Play, Trash2, Pencil, Check, X, ListMusic } from "lucide-react";
import {
  usePlaylistStore,
  PlaylistService,
  type Playlist,
} from "@/lib/analysis/playlist-service";
import type { Clip } from "@/lib/analysis/clip-service";

interface Props {
  matchId: string;
  clips: Clip[];
  onPlayClip: (c: Clip) => void;
  onPlaySequence: (cs: Clip[]) => void;
}

export function PlaylistsPanel({ matchId, clips, onPlayClip, onPlaySequence }: Props) {
  const playlists = usePlaylistStore(
    (s) => s.playlistsByMatch[matchId] ?? ([] as Playlist[]),
  );
  const create = usePlaylistStore((s) => s.create);
  const remove = usePlaylistStore((s) => s.remove);
  const removeClip = usePlaylistStore((s) => s.removeClip);
  const rename = usePlaylistStore((s) => s.rename);

  const [newName, setNewName] = useState("");

  const byId = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre nueva playlist"
          className="h-8"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              create(matchId, newName.trim());
              setNewName("");
            }
          }}
        />
        <Button
          size="sm"
          onClick={() => {
            if (!newName.trim()) return;
            create(matchId, newName.trim());
            setNewName("");
          }}
        >
          <Plus className="size-3 mr-1" /> Crear
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground self-center">
          Sugerencias
        </span>
        {PlaylistService.suggestNames.map((n) => (
          <button
            key={n}
            onClick={() => create(matchId, n)}
            className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-background/60 hover:border-primary/60"
          >
            + {n}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {playlists.map((pl) => (
          <PlaylistCard
            key={pl.id}
            playlist={pl}
            clipsById={byId}
            onRemove={() => remove(matchId, pl.id)}
            onRename={(n) => rename(matchId, pl.id, n)}
            onRemoveClip={(cid) => removeClip(matchId, pl.id, cid)}
            onPlayClip={onPlayClip}
            onPlayAll={() =>
              onPlaySequence(pl.clipIds.map((id) => byId.get(id)).filter(Boolean) as Clip[])
            }
          />
        ))}
        {playlists.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground py-10 border border-dashed border-border rounded-lg">
            Aún no hay playlists. Crea una arriba o desde una tarjeta de clip.
          </div>
        )}
      </div>
    </div>
  );
}

function PlaylistCard({
  playlist,
  clipsById,
  onRemove,
  onRename,
  onRemoveClip,
  onPlayClip,
  onPlayAll,
}: {
  playlist: Playlist;
  clipsById: Map<string, Clip>;
  onRemove: () => void;
  onRename: (name: string) => void;
  onRemoveClip: (clipId: string) => void;
  onPlayClip: (c: Clip) => void;
  onPlayAll: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist.name);

  const clips = playlist.clipIds
    .map((id) => clipsById.get(id))
    .filter(Boolean) as Clip[];

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ListMusic className="size-4 text-primary" />
        {editing ? (
          <>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onRename(name.trim() || playlist.name);
                setEditing(false);
              }}
            >
              <Check className="size-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setName(playlist.name); setEditing(false); }}
            >
              <X className="size-3" />
            </Button>
          </>
        ) : (
          <>
            <div className="font-semibold text-sm flex-1 truncate">{playlist.name}</div>
            <span className="text-[10px] text-muted-foreground">{clips.length} clips</span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(true)}>
              <Pencil className="size-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-red-400 hover:text-red-300"
              onClick={onRemove}
            >
              <Trash2 className="size-3" />
            </Button>
          </>
        )}
      </div>
      <Button
        size="sm"
        onClick={onPlayAll}
        disabled={clips.length === 0}
        variant="secondary"
        className="h-7"
      >
        <Play className="size-3 mr-1" /> Reproducir todos
      </Button>
      <div className="max-h-40 overflow-auto flex flex-col gap-1">
        {clips.length === 0 && (
          <div className="text-xs text-muted-foreground italic">
            Añade clips desde la biblioteca (menú ⋯ → A playlist).
          </div>
        )}
        {clips.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-background/60 border border-border"
          >
            <button className="flex-1 text-left truncate" onClick={() => onPlayClip(c)}>
              {c.title}
            </button>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {(c.tMs / 1000).toFixed(0)}s
            </span>
            <button
              onClick={() => onRemoveClip(c.id)}
              className="text-muted-foreground hover:text-red-400"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
