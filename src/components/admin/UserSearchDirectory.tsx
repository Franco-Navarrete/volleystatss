import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { adminDeleteUser, adminListClubs, adminSearchUsers } from "@/lib/admin-clubs.functions";
import { useDebounced } from "./ClubsDirectory";

const ROLE: Record<string, string> = { admin: "Admin", entrenador: "Entrenador", planillero: "Planillero", analyst: "Analista", player: "Jugador/a", user: "Usuario" };
type Row = { user_id: string; email: string; full_name: string | null; photo_url: string | null; roles: string[]; memberships: { club: string | null; category: string; status: string }[] };

export function UserSearchDirectory({ onManage }: { onManage: (userId: string) => void }) {
  const search = useServerFn(adminSearchUsers);
  const clubsFn = useServerFn(adminListClubs);
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [clubQ, setClubQ] = useState("");
  const [clubId, setClubId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<Row | null>(null);
  const delUserFn = useServerFn(adminDeleteUser);
  const qc = useQueryClient();
  const delUser = useMutation({
    mutationFn: (userId: string) => delUserFn({ data: { userId } }),
    onSuccess: () => { toast.success("Cuenta eliminada definitivamente."); setOpen(null); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const q = useDebounced(text);
  useEffect(() => setPage(0), [q, role, status, clubId]);
  const clubs = useQuery({ queryKey: ["admin", "clubs-picker", clubQ], queryFn: () => clubsFn({ data: { search: clubQ, page: 0 } }) });
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-search", q, role, status, clubId, page],
    queryFn: () => search({ data: { search: q, role: role as any, status: status as any, clubId, page } }),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const sel = "h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Buscador global de usuarios</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Para administrar personas por club, usá la pestaña Clubes. {data ? `${data.total} resultados` : ""}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar por nombre o email…" className="pl-9" aria-label="Buscar usuario" />
        </div>
        <select className={sel} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol">
          <option value="">Rol: todos</option>{["admin", "entrenador", "planillero", "analyst", "player"].map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}
        </select>
        <select className={sel} value={clubId ?? ""} onChange={(e) => setClubId(e.target.value || null)} aria-label="Club" onFocus={() => setClubQ("")}>
          <option value="">Club: todos</option>{clubs.data?.rows.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
          <option value="">Estado: todos</option><option value="active">Activo</option><option value="pending">Pendiente</option>
        </select>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground text-left"><tr className="border-b border-border">
            <th className="p-3">Nombre</th><th className="p-3 hidden md:table-cell">Club / Categoría</th><th className="p-3">Rol</th><th className="p-3 hidden sm:table-cell">Estado</th>
          </tr></thead>
          <tbody>
            {(data?.rows as Row[] | undefined)?.map((u) => {
              const m = u.memberships ?? [];
              const st = m.some((x) => x.status === "active") ? "Activo" : m.some((x) => x.status === "pending") ? "Pendiente" : "—";
              return (
                <tr key={u.user_id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setOpen(u)}>
                  <td className="p-3"><p className="font-medium">{u.full_name || u.email}</p>{u.full_name && <p className="text-xs text-muted-foreground">{u.email}</p>}</td>
                  <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{m.slice(0, 2).map((x) => `${x.club ?? "—"} · ${x.category}`).join(" / ") || "—"}{m.length > 2 ? ` +${m.length - 2}` : ""}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-1">{(u.roles.length ? u.roles : ["user"]).filter((r) => r !== "user" || u.roles.length === 0).map((r) => <Badge key={r} variant="secondary">{ROLE[r] ?? r}</Badge>)}</div></td>
                  <td className="p-3 hidden sm:table-cell text-xs">{st}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground animate-pulse">Buscando…</p>}
        {data && data.rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin resultados.</p>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          Página {page + 1} de {pages}
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      )}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="sm:max-w-md">
          {open && (<>
            <SheetHeader><SheetTitle>Perfil del usuario</SheetTitle></SheetHeader>
            <div className="flex items-center gap-3 mt-4">
              {open.photo_url ? <img src={open.photo_url} alt="" className="size-14 rounded-full object-cover" /> : <div className="size-14 rounded-full bg-secondary flex items-center justify-center font-bold">{(open.full_name || open.email)[0].toUpperCase()}</div>}
              <div className="min-w-0"><p className="font-bold truncate">{open.full_name || "Sin nombre"}</p><p className="text-xs text-muted-foreground truncate">{open.email}</p></div>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">{open.roles.map((r) => <Badge key={r} variant="secondary">{ROLE[r] ?? r}</Badge>)}</div>
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-6 mb-2">Clubes y categorías</h3>
            {open.memberships.length === 0 ? <p className="text-sm text-muted-foreground">No pertenece a ninguna categoría.</p> : (
              <div className="space-y-2">
                {Object.entries(open.memberships.reduce<Record<string, typeof open.memberships>>((a, m) => { (a[m.club ?? "Sin club"] ??= []).push(m); return a; }, {})).map(([club, ms]) => (
                  <div key={club} className="rounded-lg border border-border p-3">
                    <p className="font-semibold text-sm">{club}</p>
                    {ms.map((m, i) => <p key={i} className="text-xs text-muted-foreground flex justify-between mt-1"><span>{m.category}</span><span>{m.status === "active" ? "Activa" : "Pendiente"}</span></p>)}
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full mt-6" variant="outline" onClick={() => { onManage(open.user_id); setOpen(null); }}>Roles, permisos y contraseña</Button>
            <Button className="w-full mt-2" variant="destructive" disabled={delUser.isPending}
              onClick={() => { if (confirm(`¿ELIMINAR definitivamente la cuenta de ${open.full_name || open.email}? Se borran sus datos, membresías y su acceso. Esta acción no se puede deshacer.`)) delUser.mutate(open.user_id); }}>
              <Trash2 className="size-4" /> Eliminar cuenta
            </Button>
          </>)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
