import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  ShieldCheck, 
  Package, 
  CreditCard, 
  History,
  LayoutGrid,
  Settings,
  MoreVertical,
  Plus,
  Search,
  Grid,
  List,
  Mail,
  Calendar,
  Eye,
  EyeOff,
  Activity,
  UserPlus,
  ArrowRight,
  Shield,
  Key,
  Globe,
  Database,
  Lock,
  Zap,
  Clock,
  ExternalLink,
  Ban,
  Trash2,
  Copy
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter,
  SheetTrigger
} from "@/components/ui/sheet";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsAdmin } from "@/hooks/use-auth";
import { adminListUsers, adminGetPassword } from "@/lib/admin.functions";
import { adminListWorkspaces, adminListPermissionsCatalog } from "@/lib/admin-saas.functions";
import { adminGetAuditLogs, adminGetSubscriptions } from "@/lib/admin-saas-extra.functions";
import { OrganizationTree } from "@/components/admin/OrganizationTree";
import { DynamicEntityWizard, type EntityType } from "@/components/admin/DynamicEntityWizard";

function PasswordViewer({ userId }: { userId: string }) {
  const getPassword = useServerFn(adminGetPassword);
  const [show, setShow] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["user-password", userId],
    queryFn: () => getPassword({ data: { userId } }),
    enabled: show,
  });

  return (
    <div className="p-4 rounded-xl border border-border/60 bg-card/50 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">Contraseña Actual</h4>
        <Key className="size-4 text-muted-foreground/40" />
      </div>
      
      <div className="flex items-center gap-2">
        <div className="flex-1 h-9 px-3 flex items-center bg-background/50 border border-border/40 rounded-lg font-mono text-xs overflow-hidden">
          {isLoading ? (
            <span className="text-muted-foreground/40">Cargando...</span>
          ) : show ? (
            data?.password || <span className="text-muted-foreground/40">No registrada</span>
          ) : (
            "••••••••••••"
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      
      {data?.updatedAt && (
        <p className="text-[10px] text-muted-foreground">
          Última actualización: {new Date(data.updatedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel de Administración · RALLY SaaS" }] }),
  component: AdminPage,
});

type OrgType = 'federacion' | 'asociacion' | 'liga' | 'club' | 'categoria' | 'equipo';

interface OrganizationNode {
  id: string;
  name: string;
  type: OrgType;
  children?: OrganizationNode[];
  workspace?: string;
  status: 'active' | 'inactive';
  plan: string;
  modules: string[];
  userCount: number;
}

const MOCK_HIERARCHY: OrganizationNode[] = [
  {
    id: 'fed-1',
    name: 'Federación del Voleibol Argentino (FeVA)',
    type: 'federacion',
    status: 'active',
    plan: 'Enterprise',
    modules: ['Live', 'Scout', 'Video', 'Intelligence'],
    userCount: 1250,
    children: [
      {
        id: 'aso-1',
        name: 'Federación Cordobesa de Voleibol',
        type: 'asociacion',
        status: 'active',
        plan: 'Federation',
        modules: ['Live', 'Scout', 'Video'],
        userCount: 450,
        children: [
          {
            id: 'liga-1',
            name: 'División de Honor Femenina',
            type: 'liga',
            status: 'active',
            plan: 'League',
            modules: ['Live', 'Scout'],
            userCount: 120,
            children: [
              {
                id: 'club-1',
                name: 'Club Atlético Belgrano',
                type: 'club',
                status: 'active',
                plan: 'Club',
                modules: ['Live', 'Scout', 'Video'],
                userCount: 45,
                children: [
                  {
                    id: 'cat-1',
                    name: 'Primera División',
                    type: 'categoria',
                    status: 'active',
                    plan: 'Inherent',
                    modules: ['Live'],
                    userCount: 18,
                    children: [
                      {
                        id: 'eq-1',
                        name: 'Belgrano Vóley A',
                        type: 'equipo',
                        status: 'active',
                        plan: 'Inherent',
                        modules: ['Live'],
                        userCount: 14
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

function AdminPage() {
  const { isAdmin, checking } = useIsAdmin();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("organizations");
  
  // Wizard de Entidades
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeEntityType, setActiveEntityType] = useState<EntityType>("user");
  const [wizardTargetEntity, setWizardTargetEntity] = useState<any>(null);
  
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "destructive" | "default";
  } | null>(null);

  const requestConfirmation = (config: NonNullable<typeof confirmConfig>) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  };
  
  // Persistencia de preferencia de vista (simulada con estado, podría ser localStorage)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const breadcrumbs = useMemo(() => {
    const base = [{ label: "Administración", value: "admin" }];
    const tabs: Record<string, string> = {
      organizations: "Organizaciones",
      users: "Usuarios",
      modules: "Módulos",
      billing: "Suscripciones",
      audit: "Auditoría"
    };
    return [...base, { label: tabs[activeTab] || "General", value: activeTab }];
  }, [activeTab]);

  if (checking) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground animate-pulse">Autenticando sistema Enterprise…</p>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-16">
          <ShieldCheck className="size-12 mx-auto text-muted-foreground/20 mb-4" />
          <h1 className="text-xl font-bold">Acceso Restringido</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Este panel requiere permisos de Administración Global.
          </p>
        </div>
      </AppShell>
    );
  }

  const handleAuditClick = () => {
    setActiveTab("audit");
  };

  const handleCreateAction = (entity: EntityType) => {
    // Action Engine - Resolution Path
    console.debug(`[ActionEngine] Resolviendo acción: CREATE_${entity.toUpperCase()}`);
    
    // Inicia Wizard dinámico
    setCreateDrawerOpen(false); // Cierra el selector
    setActiveEntityType(entity);
    setWizardOpen(true);
    
    console.debug(`[ActionEngine] Abriendo Dynamic Entity Wizard para: ${entity}`);
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground overflow-hidden whitespace-nowrap">
        {breadcrumbs.map((b, i) => (
          <div key={b.value} className="flex items-center gap-2">
            <span className={i === breadcrumbs.length - 1 ? "text-foreground font-bold" : ""}>{b.label}</span>
            {i < breadcrumbs.length - 1 && <ChevronRight className="size-3" />}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">RALLY Core Console</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Console</h1>
          <p className="text-sm text-muted-foreground">Centro de control para el ecosistema jerárquico RALLY.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-muted/50 p-1 rounded-lg flex gap-1 mr-2">
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="size-8 rounded-md"
              onClick={() => setViewMode('table')}
              title="Vista Tabla"
            >
              <List className="size-4" />
            </Button>
            <Button 
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="size-8 rounded-md"
              onClick={() => setViewMode('cards')}
              title="Vista Tarjetas"
            >
              <Grid className="size-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-9 border-border/60" onClick={handleAuditClick}>
            <History className="size-4 mr-2" /> Auditoría
          </Button>
          
          <Sheet open={createDrawerOpen} onOpenChange={setCreateDrawerOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="h-9 shadow-glow px-4" onClick={() => setCreateDrawerOpen(true)}>
                <Plus className="size-4 mr-2" /> Crear
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Crear Nuevo Elemento</SheetTitle>
                <SheetDescription>Seleccione qué tipo de entidad desea crear en el sistema.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-6">
                {[
                  { label: "Nueva Organización", icon: Building2, type: "org" as EntityType },
                  { label: "Nuevo Usuario", icon: Users, type: "user" as EntityType },
                  { label: "Nuevo Rol", icon: Shield, type: "role" as EntityType },
                  { label: "Nuevo Permiso", icon: Key, type: "permission" as EntityType },
                  { label: "Nuevo Módulo", icon: Package, type: "module" as EntityType },
                  { label: "Nuevo Plan", icon: CreditCard, type: "plan" as EntityType },
                  { label: "Nueva Suscripción", icon: Zap, type: "subscription" as EntityType },
                ].map((item) => (
                  <Button 
                    key={item.type}
                    variant="outline" 
                    className="justify-start h-12 text-left px-4 hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => handleCreateAction(item.type)}
                  >
                    <item.icon className="size-5 mr-3 text-primary" />
                    <span>{item.label}</span>
                    <ChevronRight className="size-4 ml-auto opacity-40" />
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex flex-wrap gap-1 border border-border/40">
          <TabsTrigger value="organizations" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <Building2 className="size-4 mr-2" /> Organizaciones
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <Users className="size-4 mr-2" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="modules" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <Package className="size-4 mr-2" /> Módulos
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <CreditCard className="size-4 mr-2" /> Suscripciones
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <Activity className="size-4 mr-2" /> Auditoría
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="m-0 focus-visible:outline-none">
          <WorkspacesSection onSelect={setSelectedOrg} />
        </TabsContent>

        <TabsContent value="users" className="m-0 focus-visible:outline-none">
          <UsersSection viewMode={viewMode} onSelect={setSelectedUser} />
        </TabsContent>

        <TabsContent value="modules" className="m-0 focus-visible:outline-none">
          <div className="space-y-8">
            <PermissionsCatalogSection />
            <ModulesSection onSelect={setSelectedModule} />
          </div>
        </TabsContent>

        <TabsContent value="billing" className="m-0 focus-visible:outline-none">
          <SubscriptionsSection onSelect={setSelectedSubscription} />
        </TabsContent>

        <TabsContent value="audit" className="m-0 focus-visible:outline-none">
          <AuditLogSection onSelect={setSelectedAuditLog} />
        </TabsContent>
      </Tabs>

      <UserDetailDrawer 
        user={selectedUser} 
        onClose={() => setSelectedUser(null)} 
        onChangeRole={(u) => {
          setActiveEntityType("change_role" as any);
          setWizardTargetEntity(u);
          setWizardOpen(true);
        }}
        onAddAccess={(u) => {
          setActiveEntityType("org");
          setWizardTargetEntity(u);
          setWizardOpen(true);
        }}
      />
      <OrgDetailDrawer org={selectedOrg} onClose={() => setSelectedOrg(null)} />
      <ModuleDetailDrawer module={selectedModule} onClose={() => setSelectedModule(null)} />
      <SubscriptionDetailDrawer sub={selectedSubscription} onClose={() => setSelectedSubscription(null)} />
      <AuditDetailDrawer log={selectedAuditLog} onClose={() => setSelectedAuditLog(null)} />

      <DynamicEntityWizard 
        isOpen={wizardOpen} 
        onClose={() => {
          setWizardOpen(false);
          setWizardTargetEntity(null);
        }} 
        entityType={activeEntityType}
        targetEntity={wizardTargetEntity}
      />
    </AppShell>
  );
}

function WorkspacesSection({ onSelect }: { onSelect: (org: any) => void }) {
  const listWorkspaces = useServerFn(adminListWorkspaces);
  const { data, isLoading } = useQuery({ 
    queryKey: ["admin", "workspaces"], 
    queryFn: () => listWorkspaces() 
  });

  if (isLoading) return <div className="p-12 space-y-4">
    <div className="h-10 bg-muted/20 animate-pulse rounded-lg" />
    <div className="h-64 bg-muted/10 animate-pulse rounded-xl" />
  </div>;

  const workspaces = (data?.workspaces as any[]) ?? MOCK_HIERARCHY;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            Topología de Red <Badge variant="outline" className="text-[10px] font-bold">Multi-tenant</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Explorador jerárquico de organizaciones federadas.</p>
        </div>
      </div>
      <OrganizationTree data={workspaces} onSelect={onSelect} />
    </div>
  );
}

function UsersSection({ viewMode, onSelect }: { viewMode: 'table' | 'cards', onSelect: (u: any) => void }) {
  const listUsers = useServerFn(adminListUsers);
  const { data: users, isLoading } = useQuery({ 
    queryKey: ["admin", "users"], 
    queryFn: () => listUsers() 
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Cargando identidades…</div>;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Directorio de Usuarios</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Filtrar por rol..." className="h-8 text-[10px] w-[150px]" />
          <Badge variant="secondary">{users?.length} Usuarios</Badge>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map(u => (
                <TableRow key={u.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onSelect(u)}>
                  <TableCell className="flex items-center gap-3">
                    <Avatar className="size-8"><AvatarFallback>{u.email[0].toUpperCase()}</AvatarFallback></Avatar>
                    <span className="font-medium text-sm">{u.email}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">Default</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.isAdmin && <Badge className="text-[10px] uppercase">Admin</Badge>}
                      {u.extraRoles?.map((role: string) => (
                        <Badge key={role} variant="secondary" className="text-[10px] uppercase bg-primary/10 text-primary border-primary/20">
                          {role === 'planillero' ? 'Planillero' : role === 'entrenador' ? 'Coach' : role}
                        </Badge>
                      ))}
                      {!u.isAdmin && (!u.extraRoles || u.extraRoles.length === 0) && (
                        <Badge variant="outline" className="text-[10px] uppercase">User</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">Activo</Badge></TableCell>
                  <TableCell className="text-right"><MoreVertical className="size-4 text-muted-foreground inline" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users?.map(u => (
            <Card key={u.id} className="border-border/60 cursor-pointer hover:border-primary/40" onClick={() => onSelect(u)}>
              <CardHeader className="p-4"><CardTitle className="text-sm">{u.email}</CardTitle></CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PermissionsCatalogSection() {
  const listPerms = useServerFn(adminListPermissionsCatalog);
  const { data: perms, isLoading } = useQuery({ 
    queryKey: ["admin", "permissions-catalog"], 
    queryFn: () => listPerms() 
  });

  if (isLoading) return null;

  const categories = Array.from(new Set(perms?.map(p => p.category) ?? []));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Catálogo Central de Capacidades</h2>
        <Badge variant="outline" className="border-primary/20 text-primary">Global Scope</Badge>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map(cat => (
          <Card key={cat} className="border-border/60 bg-card/40">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-black uppercase text-primary/60 tracking-tighter">{cat}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {perms?.filter(p => p.category === cat).map(p => (
                <div key={p.id} className="flex items-center justify-between group cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors">
                  <span className="text-sm font-medium">{p.name}</span>
                  <code className="text-[9px] bg-muted px-1 rounded opacity-60 group-hover:opacity-100 transition-opacity">{p.id}</code>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ModulesSection({ onSelect }: { onSelect: (m: any) => void }) {
  const modules = [
    { id: 'live', name: 'RALLY Live', desc: 'Registro de partidos en tiempo real.', plan: 'Free+' },
    { id: 'scout', name: 'RALLY Scout', desc: 'Análisis técnico avanzado de video.', plan: 'Club+' },
    { id: 'video', name: 'RALLY Video', desc: 'Biblioteca de clips y playlists.', plan: 'Club+' },
    { id: 'intel', name: 'RALLY Intelligence', desc: 'IA aplicada a informes tácticos.', plan: 'Enterprise' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {modules.map(m => (
        <Card key={m.id} className="border-border/60 bg-card/40 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => onSelect(m)}>
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <LayoutGrid className="size-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <CardDescription className="text-xs">{m.plan}</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { 
                e.stopPropagation(); 
                onSelect({...m, view: 'config'});
              }}>
                <Settings className="size-4 text-muted-foreground" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground line-clamp-2">{m.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UserDetailDrawer({ 
  user, 
  onClose, 
  onChangeRole,
  onAddAccess
}: { 
  user: any, 
  onClose: () => void, 
  onChangeRole: (u: any) => void,
  onAddAccess: (u: any) => void
}) {
  if (!user) return null;
  return (
    <Sheet open={!!user} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[540px] p-0 border-l border-border/60">
        <SheetHeader className="p-6 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-4">
            <Avatar className="size-12 border-2 border-background shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{user.email[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-xl font-black">{user.email}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
                {user.isAdmin && <Badge variant="outline" className="text-[10px] uppercase">Administrador Global</Badge>}
                {user.extraRoles?.map((role: string) => (
                  <Badge key={role} variant="secondary" className="text-[10px] uppercase bg-primary/10 text-primary border-primary/20">
                    {role === 'planillero' ? 'Planillero' : role === 'entrenador' ? 'Coach' : role === 'analyst' ? 'Analista' : role}
                  </Badge>
                ))}
                {!user.isAdmin && (!user.extraRoles || user.extraRoles.length === 0) && (
                  <Badge variant="outline" className="text-[10px] uppercase">Usuario Estandar</Badge>
                )}
                <span className="text-[10px] text-muted-foreground">• ID: {user.id.slice(0, 8)}</span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex flex-col h-[calc(100vh-100px)]">
          <TabsList className="w-full justify-start rounded-none border-b border-border/40 bg-transparent px-6 h-12">
            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none text-xs">Resumen</TabsTrigger>
            <TabsTrigger value="workspaces" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none text-xs">Organizaciones</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none text-xs">Actividad</TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none text-xs">Seguridad</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <TabsContent value="overview" className="m-0 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Estado de Cuenta</span>
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">Activo</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Último Acceso</span>
                  <div className="text-sm font-medium">Hace 2 horas</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Rol del Sistema</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {user.isAdmin ? 'Administrador' : user.extraRoles?.length > 0 
                        ? user.extraRoles.map((r: string) => r === 'planillero' ? 'Planillero' : r === 'entrenador' ? 'Coach' : r).join(', ')
                        : 'Usuario Estándar'}
                    </span>
                    <Button variant="ghost" size="icon" className="size-6 text-primary" onClick={() => onChangeRole(user)}>
                      <Settings className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary/60">Permisos Efectivos</h3>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">match.create</Badge>
                  <Badge variant="secondary" className="text-[10px]">team.manage</Badge>
                  <Badge variant="secondary" className="text-[10px]">video.analyze</Badge>
                  <Badge variant="secondary" className="text-[10px]">report.export</Badge>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="workspaces" className="m-0 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary/60">Asignaciones de Liga</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-[10px] h-7 border-dashed font-bold"
                  onClick={() => onAddAccess(user)}
                >
                  <Plus className="size-3 mr-1" /> Agregar Acceso
                </Button>
              </div>

              <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase">Liga</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Organización</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Rol</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Scout</TableHead>
                      <TableHead className="text-[10px] font-black uppercase">Estado</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { liga: 'Liga Nacional A1', org: 'Belgrano', rol: 'Coach', scout: true, principal: true },
                      { liga: 'Copa Argentina', org: 'Federación Córdoba', rol: 'Analista', scout: false, principal: false }
                    ].map((row, i) => (
                      <TableRow key={i} className="hover:bg-muted/20">
                        <TableCell className="text-xs font-bold">{row.liga}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.org}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[9px] font-bold uppercase">{row.rol}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[9px] ${row.scout ? 'border-green-500/30 text-green-600' : 'opacity-40'}`}>
                            {row.scout ? 'Habilitado' : 'No'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-500/10 text-green-600 border-none text-[9px]">{row.principal ? 'Principal' : 'Activo'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => alert('Cambiar Rol')}>
                              <Shield className="size-3 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => alert('Cambiar Permisos')}>
                              <Key className="size-3 text-muted-foreground" />
                            </Button>
                             <Button 
                                variant="ghost" 
                                size="icon" 
                                className="size-7 text-destructive hover:bg-destructive/10" 
                                onClick={() => requestConfirmation({
                                  title: "¿Eliminar acceso?",
                                  description: `¿Estás seguro de que deseas eliminar el acceso de este usuario a la organización "${row.org}"? Esta acción no se puede deshacer.`,
                                  variant: "destructive",
                                  onConfirm: () => console.log('Acceso eliminado')
                                })}
                              >
                               <Trash2 className="size-3" />
                             </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="activity" className="m-0">
               <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 text-xs border-b border-border/20 pb-3">
                       <Clock className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                       <div>
                          <p className="font-medium">Inicio de sesión exitoso</p>
                          <p className="text-[10px] text-muted-foreground">Hace {i * 2} horas • IP: 186.12.{i}.99</p>
                       </div>
                    </div>
                  ))}
               </div>
            </TabsContent>
            <TabsContent value="security" className="m-0 space-y-6">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
                <Shield className="size-5 text-primary shrink-0" />
                <p className="text-xs leading-relaxed">
                  El administrador puede ver y cambiar las contraseñas en el apartado "seguridad" de cada usuario.
                </p>
              </div>

              <div className="space-y-4">
                <PasswordViewer userId={user.id} />

                <div className="p-4 rounded-xl border border-border/60 bg-card/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold">Cambiar Contraseña</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Actualizar credenciales de acceso para este usuario</p>
                    </div>
                    <Lock className="size-4 text-muted-foreground/40" />
                  </div>
                  <Button 
                    className="w-full h-9 text-xs font-bold shadow-glow" 
                    onClick={() => {
                      const pass = prompt("Ingrese la nueva contraseña:");
                      if (pass && pass.length >= 6) {
                        // Aquí deberíamos llamar a adminSetPassword.functions.ts
                        // pero para el flujo del Wizard usamos onChangeRole si ya está preparado
                        onChangeRole(user);
                      }
                    }}
                  >
                    Abrir Wizard de Cambio
                  </Button>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-card/50 space-y-3">
                  <h4 className="text-sm font-bold">Doble Factor (2FA)</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Estado</span>
                    <Badge variant="outline" className="text-[9px]">DESACTIVADO</Badge>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>

          <div className="p-6 border-t border-border/40 bg-muted/10 grid grid-cols-2 gap-3">
            <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => alert('Usuario suspendido')}>
              <Ban className="size-3 mr-2" /> Suspender
            </Button>
            <Button 
              size="sm" 
              className="text-xs h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90" 
              onClick={() => requestConfirmation({
                title: "¿Eliminar Usuario?",
                description: `Estás a punto de eliminar permanentemente al usuario ${user.email}. Se perderán todos sus registros de actividad y accesos.`,
                variant: "destructive",
                onConfirm: () => console.log('Usuario eliminado')
              })}
            >
              <Trash2 className="size-3 mr-2" /> Eliminar
            </Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function OrgDetailDrawer({ org, onClose }: { org: any, onClose: () => void }) {
  if (!org) return null;
  return (
    <Sheet open={!!org} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[640px] p-0 border-l border-border/60">
        <SheetHeader className="p-6 border-b border-border/40 bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <Building2 className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-xl font-black">{org.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-[9px] font-black uppercase tracking-tighter">{org.type}</Badge>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Globe className="size-3" /> Red Federada RALLY
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex flex-col h-[calc(100vh-100px)]">
          <TabsList className="w-full justify-start rounded-none border-b border-border/40 bg-transparent px-6 overflow-x-auto">
            {['Resumen', 'Jerarquía', 'Usuarios', 'Módulos', 'Suscripción', 'Config'].map((tab) => (
              <TabsTrigger 
                key={tab} 
                value={tab.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} 
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none text-xs px-4"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="resumen" className="m-0 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-muted/30 border-none shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">Usuarios</p>
                    <p className="text-xl font-black mt-1">{org.userCount || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 border-none shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">Plan</p>
                    <p className="text-sm font-black mt-1 text-primary">{org.plan || 'N/A'}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 border-none shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">Estado</p>
                    <Badge className="mt-1 bg-green-500/20 text-green-600 border-none text-[9px]">ACTIVO</Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                  <Zap className="size-3" /> Módulos Activos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {org.modules?.map((m: string) => (
                    <div key={m} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 bg-card/50">
                      <div className="size-2 rounded-full bg-primary" />
                      <span className="text-xs font-medium">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones Rápidas</h4>
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="text-xs h-9 justify-start" onClick={() => alert('Wizard: Crear sub-entidad')}>
                       <Plus className="size-3 mr-2" /> Crear hijo
                    </Button>
                    <Button variant="outline" className="text-xs h-9 justify-start" onClick={() => alert('Wizard: Mover en jerarquía')}>
                       <ArrowRight className="size-3 mr-2" /> Mover
                    </Button>
                    <Button variant="outline" className="text-xs h-9 justify-start" onClick={() => alert('Wizard: Duplicar configuración')}>
                       <Copy className="size-3 mr-2" /> Duplicar
                    </Button>
                    <Button 
                      variant="outline" 
                      className="text-xs h-9 justify-start text-destructive hover:bg-destructive/5 hover:border-destructive/30" 
                      onClick={() => requestConfirmation({
                        title: "¿Eliminar Organización?",
                        description: `¿Estás seguro de que deseas eliminar "${org.name}"? Esto afectará a todas las sub-entidades y usuarios asociados.`,
                        variant: "destructive",
                        onConfirm: () => console.log('Organización eliminada')
                      })}
                    >
                       <Trash2 className="size-3 mr-2" /> Eliminar
                    </Button>
                 </div>
              </div>
            </TabsContent>

            <TabsContent value="config" className="m-0 space-y-6">
               <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border/60 space-y-3">
                     <p className="text-xs font-bold">Identidad Visual</p>
                     <div className="flex gap-4 items-center">
                        <div className="size-12 rounded-lg bg-muted border flex items-center justify-center text-[10px] text-muted-foreground">Logo</div>
                        <Button variant="outline" size="sm" className="text-[10px]">SUBIR IMAGEN</Button>
                     </div>
                  </div>
                  <div className="p-4 rounded-xl border border-border/60 space-y-3">
                     <p className="text-xs font-bold">Configuración de Dominio</p>
                     <Input placeholder="subdomain.rally.com" className="h-9 text-xs" />
                  </div>
                  <Button className="w-full shadow-glow font-black text-xs h-10" onClick={() => alert('Configuración guardada')}>GUARDAR CONFIGURACIÓN</Button>
               </div>
            </TabsContent>
          </div>

          <div className="p-4 border-t border-border/40 bg-muted/5 flex justify-between gap-3">
             <Button variant="outline" size="sm" className="text-xs font-bold px-6" onClick={() => alert('Abriendo editor global')}>Editar Organización</Button>
             <div className="flex gap-2">
               <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => confirm('¿Eliminar?')}>
                  <Trash2 className="size-4" />
               </Button>
               <Button size="sm" className="text-xs font-black shadow-glow" onClick={() => alert('Cambios guardados')}>Guardar</Button>
             </div>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ModuleDetailDrawer({ module, onClose }: { module: any, onClose: () => void }) {
  if (!module) return null;
  return (
    <Sheet open={!!module} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[500px] p-0 border-l border-border/60">
        <SheetHeader className="p-8 border-b border-border/40 bg-gradient-to-br from-primary/10 to-transparent">
          <LayoutGrid className="size-12 text-primary mb-4" />
          <SheetTitle className="text-2xl font-black tracking-tighter">{module.name}</SheetTitle>
          <SheetDescription className="text-sm">{module.desc}</SheetDescription>
        </SheetHeader>
        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Configuración del Producto</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60">
                <div>
                  <p className="text-sm font-bold">Estado del Módulo</p>
                  <p className="text-[10px] text-muted-foreground">Desactivar para toda la plataforma</p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-green-500 hover:bg-green-600 cursor-pointer" onClick={() => alert('Esta funcionalidad aún no está disponible')}>Activo</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/60">
                <div>
                  <p className="text-sm font-bold">Versión</p>
                  <p className="text-[10px] text-muted-foreground">Última actualización: 2024.2.1</p>
                </div>
                <Badge variant="outline" className="text-[10px]">v2.4.0-stable</Badge>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full shadow-glow py-6 font-black uppercase tracking-widest text-xs"
            onClick={() => alert('Abriendo pantalla de Capacidades & Dependencias')}
          >
            <Settings className="size-4 mr-2" /> Editar Capacidades & Dependencias
          </Button>

          <Card className="border-border/60 bg-muted/20">
            <CardHeader className="p-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Dependencias</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
               {module.id === 'intel' && <Badge variant="secondary" className="text-[9px]">Requiere Analytics</Badge>}
               {module.id === 'video' && <Badge variant="secondary" className="text-[9px]">Requiere Scout</Badge>}
               <p className="text-[10px] text-muted-foreground italic">Los módulos de RALLY están interconectados para maximizar el rendimiento.</p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SubscriptionDetailDrawer({ sub, onClose }: { sub: any, onClose: () => void }) {
  if (!sub) return null;
  return (
    <Sheet open={!!sub} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[500px] p-0 border-l border-border/60">
        <SheetHeader className="p-8 border-b border-border/40">
          <SheetTitle className="text-2xl font-black">{sub.orgName}</SheetTitle>
          <SheetDescription>Suscripción {sub.plan}</SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
             <div className="p-3 rounded-xl border bg-muted/20">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Estado</p>
                <Badge className="mt-1">{sub.status}</Badge>
             </div>
             <div className="p-3 rounded-xl border bg-muted/20">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Monto</p>
                <p className="text-lg font-black">${sub.amount}/mes</p>
             </div>
          </div>
          <div className="space-y-2">
            <Button className="w-full justify-start h-12" variant="outline" onClick={() => alert('Esta funcionalidad aún no está disponible')}>
              <CreditCard className="size-4 mr-2" /> Historial de Pagos
            </Button>
            <Button className="w-full justify-start h-12" variant="outline" onClick={() => alert('Esta funcionalidad aún no está disponible')}>
              <Activity className="size-4 mr-2" /> Ver Consumo Detallado
            </Button>
          </div>
          <div className="pt-6 flex flex-col gap-2">
            <Button className="w-full bg-primary shadow-glow font-bold">Renovar Suscripción</Button>
            <Button className="w-full text-destructive" variant="ghost">Suspender Servicio</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AuditDetailDrawer({ log, onClose }: { log: any, onClose: () => void }) {
  if (!log) return null;
  return (
    <Sheet open={!!log} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-[600px] p-0 border-l border-border/60">
        <SheetHeader className="p-8 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest mb-2">
             <History className="size-4" /> Evento de Auditoría
          </div>
          <SheetTitle className="text-xl font-black">{log.action}</SheetTitle>
          <SheetDescription>{new Date(log.timestamp).toLocaleString()}</SheetDescription>
        </SheetHeader>
        <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
           <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase text-muted-foreground">Usuario</p>
                 <p className="text-sm font-medium">{log.userEmail}</p>
                 <p className="text-[10px] text-muted-foreground font-mono">{log.userId}</p>
              </div>
              <div className="space-y-1 text-right">
                 <p className="text-[10px] font-black uppercase text-muted-foreground">IP de Origen</p>
                 <p className="text-sm font-mono">{log.ip}</p>
              </div>
           </div>

           <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border/60 bg-card">
                 <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Detalles de la Acción</p>
                 <p className="text-sm">{log.details}</p>
              </div>
              
              <div className="p-4 rounded-xl border border-border/60 bg-black/5 dark:bg-black/20">
                 <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 flex items-center justify-between">
                    <span>Payload JSON</span>
                    <Button variant="ghost" size="icon" className="size-6"><Copy className="size-3" /></Button>
                 </p>
                 <pre className="text-[10px] font-mono overflow-x-auto p-2 bg-black/10 rounded">
                    {JSON.stringify({
                       id: log.id,
                       timestamp: log.timestamp,
                       action: log.action,
                       entity: log.entity,
                       status: log.status,
                       metadata: {
                          browser: "Chrome 122.0.0",
                          os: "macOS 14.3",
                          duration: "45ms"
                       }
                    }, null, 2)}
                 </pre>
              </div>
           </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SubscriptionsSection({ onSelect }: { onSelect: (sub: any) => void }) {
  const listSubs = useServerFn(adminGetSubscriptions);
  const { data: subs, isLoading } = useQuery({ 
    queryKey: ["admin", "subscriptions"], 
    queryFn: () => listSubs() 
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse">Cargando suscripciones...</div>;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead className="text-[10px] font-black uppercase">Organización</TableHead>
            <TableHead className="text-[10px] font-black uppercase">Plan</TableHead>
            <TableHead className="text-[10px] font-black uppercase">Estado</TableHead>
            <TableHead className="text-[10px] font-black uppercase">Próximo Cobro</TableHead>
            <TableHead className="text-right text-[10px] font-black uppercase">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subs?.map(s => (
            <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onSelect(s)}>
              <TableCell className="font-bold text-sm">{s.orgName}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{s.plan}</Badge></TableCell>
              <TableCell>
                <Badge className={s.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-red-500/10 text-red-600 border-red-200'}>
                  {s.status.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground font-mono">{s.nextBilling}</TableCell>
              <TableCell className="text-right font-black text-sm">${s.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AuditLogSection({ onSelect }: { onSelect: (log: any) => void }) {
  const listLogs = useServerFn(adminGetAuditLogs);
  const { data: logs, isLoading } = useQuery({ 
    queryKey: ["admin", "audit-logs"], 
    queryFn: () => listLogs() 
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse">Cargando registros...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <History className="size-4" /> Transacciones de Sistema
        </h3>
        <Button variant="ghost" size="sm" className="text-[10px] h-7 font-black" onClick={() => alert('Exportando a CSV...')}>EXPORTAR LOGS</Button>
      </div>
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card/40">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="text-[10px] font-black">Timestamp</TableHead>
              <TableHead className="text-[10px] font-black">Usuario</TableHead>
              <TableHead className="text-[10px] font-black">Acción</TableHead>
              <TableHead className="text-[10px] font-black">Entidad</TableHead>
              <TableHead className="text-[10px] font-black">IP</TableHead>
              <TableHead className="text-right text-[10px] font-black">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.map(log => (
              <TableRow key={log.id} className="cursor-pointer hover:bg-muted/20 text-xs" onClick={() => onSelect(log)}>
                <TableCell className="text-muted-foreground font-mono">{new Date(log.timestamp).toLocaleTimeString()}</TableCell>
                <TableCell className="font-medium">{log.userEmail}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[9px] font-mono">{log.action}</Badge></TableCell>
                <TableCell className="text-muted-foreground italic">{log.entity}</TableCell>
                <TableCell className="font-mono text-[10px]">{log.ip}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-[9px]">
                    {log.status.toUpperCase()}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
