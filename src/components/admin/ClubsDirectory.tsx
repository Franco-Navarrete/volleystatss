import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronRight, Link2, Loader2, Search, Settings2, UserMinus, Users, Volleyball } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamRegistrationLinkDialog } from "@/components/TeamRegistrationLinkDialog";
import { CategoryManageDialog } from "@/components/CategoryManageDialog";
import { adminGetClub, adminListCategoryPlayers, adminListClubs, adminListClubUsers, adminRemoveFromClub } from "@/lib/admin-clubs.functions";

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

type Cat = { id: string; name: string; gender: string | null; category: string | null; logo_url: string | null; players: number; pending: number };
const POS: Record<string, string> = { punta: "Punta", central: "Central", opuesto: "Opuesto", armador: "Armador", libero: "Líbero", universal: "Universal" };
const KIND: Record<string, string> = { coach: "Entrenador/a", planillero: "Planillero/a", player: "Jugador/a" };

function Logo({ url, size = "size-11" }: { url?: string | null; size?: string }) {
  return (
    <div className={`${size} shrink-0 rounded-xl border border-border bg-secondary overflow-hidden flex items-center justify-center`}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <Volleyball className="size-5 text-primary" />}
    </div>
  );
}

function Pager({ page, total, size, onChange }: { page: number; total: number; size: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2 text-xs text-muted-foreground">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>Anterior</Button>
      Página {page + 1} de {pages}
      <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>Siguiente</Button>
    </div>
  );
}

export function ClubsDirectory() {
  const [clubId, setClubId] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat | null>(null);
  const [clubName, setClubName] = useState("");

  const crumbs = [
    { label: "Clubes", go: () => { setClubId(null); setCat(null); } },
    ...(clubId ? [{ label: clubName || "Club", go: () => setCat(null) }] : []),
    ...(cat ? [{ label: cat.name, go: () => {} }] : []),
  ];

  return (
    <div className="space-y-5">
      <nav aria-label="Ubicación" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i < crumbs.length - 1
              ? <button className="hover:text-foreground underline-offset-2 hover:underline" onClick={c.go}>{c.label}</button>
              : <span className="text-foreground font-semibold">{c.label}</span>}
            {i < crumbs.length - 1 && <ChevronRight className="size-3" />}
          </span>
        ))}
      </nav>
      {!clubId && <ClubList onOpen={(id, name) => { setClubId(id); setClubName(name); }} />}
      {clubId && !cat && <ClubDetail clubId={clubId} onBack={() => setClubId(null)} onOpenCategory={setCat} />}
      {clubId && cat && <CategoryDetail cat={cat} clubName={clubName} onBack={() => setCat(null)} />}
    </div>
  );
}

function ClubList({ onOpen }: { onOpen: (id: string, name: string) => void }) {
  const list = useServerFn(adminListClubs);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [q]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "clubs", q, page],
    queryFn: () => list({ data: { search: q, page } }),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Directorio de clubes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{data ? `${data.total} ${data.total === 1 ? "club" : "clubes"}` : "…"}</p>
        </div>
        <div className="relative sm:w-72">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar club o ciudad…" className="pl-9" aria-label="Buscar club" />
        </div>
      </div>
      {isLoading && <p className="py-10 text-center text-sm text-muted-foreground animate-pulse">Cargando clubes…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && data.rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No se encontraron clubes.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data?.rows.map((c: any) => (
          <button key={c.id} onClick={() => onOpen(c.id, c.name)}
            className="text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3">
              <Logo url={c.logo_url} />
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">{[c.city, c.province].filter(Boolean).join(", ") || "Sin ubicación"}</p>
              </div>
              {c.pending > 0 && <Badge className="shrink-0">{c.pending} pend.</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {c.categories} categorías · {c.players} jugadoras · {c.coaches} {c.coaches === 1 ? "entrenador/a" : "entrenadores"}{c.planilleros ? ` · ${c.planilleros} planilleros` : ""}
            </p>
            <p className="text-xs text-primary font-semibold mt-2 flex items-center gap-1 justify-end">Administrar <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" /></p>
          </button>
        ))}
      </div>
      {data && <Pager page={page} total={data.total} size={data.pageSize} onChange={setPage} />}
    </div>
  );
}

function ClubDetail({ clubId, onBack, onOpenCategory }: { clubId: string; onBack: () => void; onOpenCategory: (c: Cat) => void }) {
  const get = useServerFn(adminGetClub);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "club", clubId], queryFn: () => get({ data: { clubId } }) });
  const [invite, setInvite] = useState<Cat | null>(null);
  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground animate-pulse">Cargando club…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Error"}</p>;
  const { club, stats, categories } = data;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver a clubes"><ArrowLeft className="size-4" /></Button>
        <Logo url={club.logo_url} size="size-14" />
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight truncate">{club.name}</h2>
          <p className="text-xs text-muted-foreground">{stats.categories} categorías · {stats.players} jugadoras · {stats.coaches} entrenadores · {stats.planilleros} planilleros</p>
        </div>
      </div>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="invites">Invitaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 grid sm:grid-cols-2 gap-4 text-sm">
            {[["Nombre", club.name], ["Ciudad", club.city], ["Provincia", club.province], ["País", club.country], ["Creado", new Date(club.created_at).toLocaleDateString("es-AR")]].map(([k, v]) => (
              <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium">{v || "—"}</p></div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="users" className="mt-4"><ClubUsers clubId={clubId} /></TabsContent>
        <TabsContent value="categories" className="mt-4">
          {categories.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Este club todavía no tiene categorías.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((c: Cat) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold truncate">{c.name}</p>
                  {c.pending > 0 && <Badge>{c.pending} solicitudes</Badge>}
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Users className="size-3.5" /> {c.players} jugadoras</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => onOpenCategory(c)}><Settings2 className="size-4" /> Administrar</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setInvite(c)}><Link2 className="size-4" /> Invitar</Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="invites" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">Cada categoría tiene su propio enlace. Quien se registre con él entra siempre como jugadora.</p>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {categories.map((c: Cat) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                <span className="font-medium text-sm">{c.name}</span>
                <Button size="sm" variant="outline" onClick={() => setInvite(c)}><Link2 className="size-4" /> Gestionar enlace</Button>
              </div>
            ))}
            {categories.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin categorías.</p>}
          </div>
        </TabsContent>
      </Tabs>
      {invite && <TeamRegistrationLinkDialog teamId={invite.id} teamName={invite.name} open onOpenChange={(o) => !o && setInvite(null)} />}
    </div>
  );
}

function ClubUsers({ clubId }: { clubId: string }) {
  const list = useServerFn(adminListClubUsers);
  const remove = useServerFn(adminRemoveFromClub);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"" | "coach" | "planillero" | "player">("");
  const [page, setPage] = useState(0);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [q, kind]);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "club-users", clubId, q, kind, page],
    queryFn: () => list({ data: { clubId, search: q, kind, page } }),
    placeholderData: keepPreviousData,
  });
  const del = useMutation({
    mutationFn: (userId: string) => remove({ data: { clubId, userId } }),
    onSuccess: () => { toast.success("Quitado del club. Su cuenta sigue existiendo."); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const groups = ["coach", "planillero", "player"].map((k) => ({ k, rows: (data?.rows ?? []).filter((r: any) => r.kind === k) })).filter((g) => g.rows.length);
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario…" className="pl-9" aria-label="Buscar usuario del club" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" aria-label="Filtrar por rol">
          <option value="">Todos los roles</option><option value="coach">Entrenadores</option><option value="planillero">Planilleros</option><option value="player">Jugadoras</option>
        </select>
      </div>
      {isLoading && <p className="py-6 text-center text-sm text-muted-foreground animate-pulse">Cargando usuarios…</p>}
      {data && data.rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No hay usuarios con esos filtros.</p>}
      {groups.map((g) => (
        <section key={g.k} className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{g.k === "coach" ? "Entrenadores" : g.k === "planillero" ? "Planilleros" : "Jugadoras"} · {g.rows.length}</h3>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {g.rows.map((u: any) => (
              <div key={u.user_id} className="flex items-center gap-3 p-3">
                {u.photo_url ? <img src={u.photo_url} alt="" className="size-9 rounded-full object-cover" /> : <div className="size-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">{(u.full_name || u.email || "?")[0].toUpperCase()}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.full_name ? `${u.email} · ` : ""}{(u.categories ?? []).join(", ") || KIND[u.kind]}</p>
                </div>
                <Badge variant={u.status === "active" ? "secondary" : "outline"}>{u.status === "active" ? "Activo" : u.status === "pending" ? "Pendiente" : u.status}</Badge>
                <Button size="icon" variant="ghost" aria-label="Quitar del club" disabled={del.isPending}
                  onClick={() => { if (confirm(`¿Quitar a ${u.full_name || u.email} de este club? Su cuenta no se elimina.`)) del.mutate(u.user_id); }}>
                  <UserMinus className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {data && <Pager page={page} total={data.total} size={data.pageSize} onChange={setPage} />}
    </div>
  );
}

function CategoryDetail({ cat, clubName, onBack }: { cat: Cat; clubName: string; onBack: () => void }) {
  const list = useServerFn(adminListCategoryPlayers);
  const { data: players = [], isLoading } = useQuery({ queryKey: ["admin", "category-players", cat.id], queryFn: () => list({ data: { teamId: cat.id } }) });
  const [search, setSearch] = useState("");
  const [manage, setManage] = useState(false);
  const [invite, setInvite] = useState(false);
  const s = search.trim().toLowerCase();
  const shown = players.filter((p) => !s || p.name.toLowerCase().includes(s) || String(p.number) === s);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={`Volver a ${clubName}`}><ArrowLeft className="size-4" /></Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black tracking-tight truncate">{cat.name}</h2>
          <p className="text-xs text-muted-foreground">{players.length} jugadoras{cat.pending ? ` · ${cat.pending} solicitudes pendientes` : ""}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugadora…" className="pl-9" aria-label="Buscar jugadora" />
        </div>
        <Button variant="secondary" onClick={() => setManage(true)}><Settings2 className="size-4" /> Solicitudes y miembros</Button>
        <Button onClick={() => setInvite(true)}><Link2 className="size-4" /> Invitar jugadoras</Button>
      </div>
      {isLoading && <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />}
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {shown.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3">
            {p.photoUrl ? <img src={p.photoUrl} alt="" className="size-10 rounded-full object-cover" /> : <div className="size-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">{p.name[0]?.toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">#{p.number}{p.position ? ` · ${POS[p.position] ?? p.position}` : ""}</p>
            </div>
            <Badge variant="secondary">{p.hasAccount ? "Activa" : "Sin cuenta"}</Badge>
          </div>
        ))}
        {!isLoading && shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No hay jugadoras{s ? " con esa búsqueda" : ""}.</p>}
      </div>
      <CategoryManageDialog teamId={cat.id} teamName={cat.name} players={players} open={manage} onOpenChange={setManage} />
      <TeamRegistrationLinkDialog teamId={cat.id} teamName={cat.name} open={invite} onOpenChange={setInvite} />
    </div>
  );
}
