import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListTeamAssignments, adminSetTeamAssignments } from "@/lib/player-registration.functions";

export function CoachTeamAssignments({ userId }: { userId: string }) {
  const list = useServerFn(adminListTeamAssignments);
  const save = useServerFn(adminSetTeamAssignments);
  const queryClient = useQueryClient();
  const queryKey = ["admin", "team-assignments", userId];
  const query = useQuery({ queryKey, queryFn: () => list({ data: { userId } }) });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (query.data) setSelected(new Set(query.data.filter((team) => team.assigned).map((team) => team.id))); }, [query.data]);
  const filtered = useMemo(() => (query.data ?? []).filter((team) => `${team.name} ${team.club ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [query.data, search]);
  const mutation = useMutation({
    mutationFn: () => save({ data: { userId, teamIds: Array.from(selected) } }),
    onSuccess: async () => { setSaved(true); await queryClient.invalidateQueries({ queryKey }); window.setTimeout(() => setSaved(false), 1800); },
  });
  if (query.isLoading) return <div className="py-8 flex justify-center"><Loader2 className="size-5 animate-spin" /></div>;
  return <div className="space-y-3">
    <div><h3 className="text-xs font-black uppercase text-primary/60">Equipos asignados</h3><p className="text-xs text-muted-foreground mt-1">El profesor podrá administrar los planteles seleccionados y generar sus enlaces.</p></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar equipo o club" className="pl-9" /></div>
    <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
      {filtered.map((team) => <label key={team.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-secondary/40">
        <input type="checkbox" checked={selected.has(team.id)} onChange={(e) => setSelected((current) => { const next = new Set(current); if (e.target.checked) next.add(team.id); else next.delete(team.id); return next; })} className="size-4 accent-primary" />
        <Users className="size-4 text-muted-foreground" /><span className="flex-1 text-sm">{team.name}</span>{team.club ? <span className="text-xs text-muted-foreground">{team.club}</span> : null}
      </label>)}
      {!filtered.length ? <p className="p-4 text-center text-sm text-muted-foreground">No hay equipos para mostrar.</p> : null}
    </div>
    {mutation.error ? <p className="text-xs text-destructive">{mutation.error.message}</p> : null}
    <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}{saved ? "Asignaciones guardadas" : "Guardar equipos"}</Button>
  </div>;
}