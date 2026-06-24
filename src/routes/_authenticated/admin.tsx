import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsAdmin } from "@/hooks/use-auth";
import {
  adminCreateLeague,
  adminCreateUser,
  adminDeleteLeague,
  adminDeleteUser,
  adminListLeagues,
  adminListUsers,
  adminSetExtraRole,
  adminSetLeagueAccess,
  adminSetPermissions,
  adminSetRole,
  type ExtraRole,
} from "@/lib/admin.functions";

const EXTRA_ROLE_OPTIONS: { value: ExtraRole | null; label: string; hint: string }[] = [
  { value: null, label: "Sin rol", hint: "Solo permisos por liga" },
  { value: "entrenador", label: "Entrenador", hint: "Acceso a estadísticas avanzadas" },
  { value: "planillero", label: "Planillero", hint: "Carga rápida modo liga" },
];

function ExtraRoleSelector({
  value,
  onChange,
  disabled,
}: {
  value: ExtraRole | null;
  onChange: (v: ExtraRole | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {EXTRA_ROLE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`text-left rounded-md border px-2.5 py-2 transition-colors ${
              active ? "border-primary bg-primary/10" : "border-border/60 bg-card hover:bg-secondary/50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="text-xs font-bold">{opt.label}</div>
            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.hint}</div>
          </button>
        );
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administración · vstats" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, checking } = useIsAdmin();

  if (checking) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Verificando permisos…</p>
      </AppShell>
    );
  }
  if (!isAdmin) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-16">
          <h1 className="text-lg font-semibold">Sin acceso</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Esta sección es solo para administradores.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="size-5 text-primary" />
        <h1 className="text-xl font-bold tracking-tight">Administración</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">
            <Users className="size-4 mr-1.5" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="leagues">
            <Trophy className="size-4 mr-1.5" /> Ligas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="leagues">
          <LeaguesTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// =========================================================================
// USUARIOS
// =========================================================================

function UsersTab() {
  const qc = useQueryClient();
  const listUsers = useServerFn(adminListUsers);
  const listLeagues = useServerFn(adminListLeagues);

  const usersQ = useQuery({ queryKey: ["admin", "users"], queryFn: () => listUsers() });
  const leaguesQ = useQuery({ queryKey: ["admin", "leagues"], queryFn: () => listLeagues() });

  const [createOpen, setCreateOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  if (usersQ.isLoading || leaguesQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  const leagues = leaguesQ.data ?? [];
  const users = usersQ.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          {users.length} usuario{users.length === 1 ? "" : "s"}
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <UserPlus className="size-4" /> Nuevo usuario
        </Button>
      </div>

      {users.map((u) => (
        <UserRow key={u.id} user={u} leagues={leagues} onChanged={refresh} />
      ))}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        leagues={leagues}
        onCreated={refresh}
      />
    </div>
  );
}

type UserRowData = Awaited<ReturnType<typeof adminListUsers>>[number];
type LeagueRow = Awaited<ReturnType<typeof adminListLeagues>>[number];

function UserRow({
  user,
  leagues,
  onChanged,
}: {
  user: UserRowData;
  leagues: LeagueRow[];
  onChanged: () => void;
}) {
  const setPerms = useServerFn(adminSetPermissions);
  const setAccess = useServerFn(adminSetLeagueAccess);
  const setRole = useServerFn(adminSetRole);
  const setExtraRole = useServerFn(adminSetExtraRole);
  const deleteUser = useServerFn(adminDeleteUser);

  const [selected, setSelected] = useState<Set<string>>(new Set(user.leagueIds));
  const [canCreate, setCanCreate] = useState(user.canCreateMatches);
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);
  const [extraRole, setExtraRoleState] = useState<ExtraRole | null>(user.extraRole);
  const [open, setOpen] = useState(false);

  const dirty = useMemo(() => {
    if (isAdmin !== user.isAdmin) return true;
    if (extraRole !== user.extraRole) return true;
    const orig = new Set(user.leagueIds);
    if (selected.size !== orig.size) return true;
    for (const id of selected) if (!orig.has(id)) return true;
    return canCreate !== user.canCreateMatches;
  }, [selected, canCreate, isAdmin, extraRole, user]);

  const saveMut = useMutation({
    mutationFn: async () => {
      // Role change first, since it changes downstream meaning
      if (isAdmin !== user.isAdmin) {
        await setRole({ data: { userId: user.id, isAdmin } });
      }
      if (extraRole !== user.extraRole) {
        await setExtraRole({ data: { userId: user.id, role: extraRole } });
      }
      if (!isAdmin) {
        await Promise.all([
          setPerms({ data: { userId: user.id, canCreateMatches: canCreate } }),
          setAccess({ data: { userId: user.id, leagueIds: Array.from(selected) } }),
        ]);
      }
    },
    onSuccess: () => {
      toast.success("Usuario actualizado");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: () => deleteUser({ data: { userId: user.id } }),
    onSuccess: () => {
      toast.success("Usuario eliminado");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/40">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <div className="font-medium text-sm truncate flex items-center gap-2">
            {user.email}
            {isAdmin && (
              <Badge variant="secondary" className="text-[10px]">Admin</Badge>
            )}
            {!isAdmin && extraRole && (
              <Badge variant="outline" className="text-[10px] capitalize">{extraRole}</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {isAdmin
              ? "Acceso total a todas las ligas y partidos"
              : `${user.leagueIds.length} liga${user.leagueIds.length === 1 ? "" : "s"} · ${user.canCreateMatches ? "Puede crear partidos" : "Sin permiso de crear"}`}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border/60 px-4 py-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm">Rol Administrador</Label>
              <p className="text-xs text-muted-foreground">
                Acceso total: ligas, partidos, equipos y panel admin.
              </p>
            </div>
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">Rol</Label>
            <ExtraRoleSelector value={extraRole} onChange={setExtraRoleState} disabled={isAdmin} />
            {isAdmin && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Los administradores no necesitan rol adicional.
              </p>
            )}
          </div>

          {isAdmin ? (
            <p className="text-xs text-muted-foreground">
              Los administradores tienen acceso total. No hay permisos individuales que editar.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Puede crear partidos</Label>
                  <p className="text-xs text-muted-foreground">
                    Habilita el botón "Nuevo partido" para este usuario.
                  </p>
                </div>
                <Switch checked={canCreate} onCheckedChange={setCanCreate} />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Acceso a ligas</Label>
                {leagues.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aún no hay ligas. Creá una en la pestaña "Ligas".
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {leagues.map((l) => {
                      const checked = selected.has(l.id);
                      return (
                        <label
                          key={l.id}
                          className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 cursor-pointer hover:bg-secondary/60"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(l.id)}
                            className="size-4 accent-primary"
                          />
                          <span className="text-sm flex-1 truncate">
                            {l.name}
                            {l.season ? (
                              <span className="text-xs text-muted-foreground ml-1">· {l.season}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`¿Eliminar la cuenta ${user.email}?`)) delMut.mutate();
              }}
              disabled={delMut.isPending}
            >
              <Trash2 className="size-4" /> Eliminar
            </Button>
            <Button
              size="sm"
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending}
            >
              {saveMut.isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  leagues,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leagues: LeagueRow[];
  onCreated: () => void;
}) {
  const create = useServerFn(adminCreateUser);
  const setRole = useServerFn(adminSetRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [canCreate, setCanCreate] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [extraRole, setExtraRole] = useState<ExtraRole | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reset = () => {
    setEmail("");
    setPassword("");
    setCanCreate(false);
    setIsAdmin(false);
    setExtraRole(null);
    setSelected(new Set());
  };

  const mut = useMutation({
    mutationFn: async () => {
      const res = await create({
        data: {
          email: email.trim(),
          password,
          canCreateMatches: isAdmin ? false : canCreate,
          leagueIds: isAdmin ? [] : Array.from(selected),
          extraRole: isAdmin ? null : extraRole,
        },
      });
      if (isAdmin && res?.id) {
        await setRole({ data: { userId: res.id, isAdmin: true } });
      }
      return res;
    },
    onSuccess: () => {
      toast.success("Usuario creado");
      reset();
      onOpenChange(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSubmit = email.trim().length > 3 && password.length >= 8;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@equipo.com"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="new-pass">Contraseña inicial</Label>
            <Input
              id="new-pass"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground mt-1">
              El usuario la podrá cambiar después.
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
            <div>
              <Label>Rol Administrador</Label>
              <p className="text-xs text-muted-foreground">Acceso total a todo.</p>
            </div>
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
          </div>
          {!isAdmin && (
            <>
              <div>
                <Label className="mb-1.5 block">Rol</Label>
                <ExtraRoleSelector value={extraRole} onChange={setExtraRole} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label>Puede crear partidos</Label>
                <Switch checked={canCreate} onCheckedChange={setCanCreate} />
              </div>
              <div>
                <Label className="mb-2 block">Acceso a ligas</Label>
                {leagues.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay ligas creadas.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {leagues.map((l) => (
                      <label
                        key={l.id}
                        className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(l.id)}
                          onChange={() => toggle(l.id)}
                          className="size-4 accent-primary"
                        />
                        <span className="text-sm flex-1 truncate">{l.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending}>
            {mut.isPending && <Loader2 className="size-4 animate-spin" />}
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
// LIGAS
// =========================================================================

function LeaguesTab() {
  const qc = useQueryClient();
  const listLeagues = useServerFn(adminListLeagues);
  const createLeague = useServerFn(adminCreateLeague);
  const deleteLeague = useServerFn(adminDeleteLeague);

  const leaguesQ = useQuery({ queryKey: ["admin", "leagues"], queryFn: () => listLeagues() });

  const [name, setName] = useState("");
  const [season, setSeason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "leagues"] });
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createLeague({ data: { name: name.trim(), season: season.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Liga creada");
      setName("");
      setSeason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (leagueId: string) => deleteLeague({ data: { leagueId } }),
    onSuccess: () => {
      toast.success("Liga eliminada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leagues = leaguesQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 p-4 bg-card/40 space-y-2">
        <Label className="text-sm">Nueva liga</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Nombre (ej: Liga Apertura)"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
          />
          <Input
            placeholder="Temporada (opcional)"
            value={season}
            onChange={(e) => setSeason(e.target.value.slice(0, 40))}
            className="sm:max-w-[180px]"
          />
          <Button onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Crear
          </Button>
        </div>
      </div>

      {leaguesQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando ligas…</p>
      ) : leagues.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aún no hay ligas compartidas.</p>
      ) : (
        <ul className="space-y-2">
          {leagues.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 flex items-center gap-3"
            >
              <div className="size-9 rounded-md bg-gradient-primary flex items-center justify-center">
                <Trophy className="size-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground">
                  {l.season ?? "Sin temporada"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm(`¿Eliminar la liga ${l.name}? También se quitarán los accesos de los usuarios.`)) {
                    deleteMut.mutate(l.id);
                  }
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
