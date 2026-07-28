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
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
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
import { adminListUsers } from "@/lib/admin.functions";
import { adminListWorkspaces, adminListPermissionsCatalog } from "@/lib/admin-saas.functions";
import { OrganizationTree } from "@/components/admin/OrganizationTree";

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
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

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

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground overflow-hidden whitespace-nowrap">
        <span>Administración</span>
        <ChevronRight className="size-3" />
        <span className="text-foreground">General</span>
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
            >
              <List className="size-4" />
            </Button>
            <Button 
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'} 
              size="icon" 
              className="size-8 rounded-md"
              onClick={() => setViewMode('cards')}
            >
              <Grid className="size-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-9 border-border/60">
            <History className="size-4 mr-2" /> Auditoría
          </Button>
          <Button size="sm" className="h-9 shadow-glow px-4">
            <Plus className="size-4 mr-2" /> Crear
          </Button>
        </div>
      </div>

      <Tabs defaultValue="organizations" className="space-y-6">
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
          <SubscriptionsSection />
        </TabsContent>

        <TabsContent value="audit" className="m-0 focus-visible:outline-none">
          <AuditLogSection />
        </TabsContent>
      </Tabs>

      <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
      <OrgDetailDrawer org={selectedOrg} onClose={() => setSelectedOrg(null)} />
      <ModuleDetailDrawer module={selectedModule} onClose={() => setSelectedModule(null)} />
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

  const workspaces = data?.workspaces ?? MOCK_HIERARCHY;

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

function HierarchyRow({ node, level }: { node: any, level: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  const typeLabels: Record<OrgType, string> = {
    federacion: 'Federación',
    asociacion: 'Asociación',
    liga: 'Liga',
    club: 'Club',
    categoria: 'Categoría',
    equipo: 'Equipo'
  };

  const typeColors: Record<OrgType, string> = {
    federacion: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-900',
    asociacion: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900',
    liga: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900',
    club: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-900',
    categoria: 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-900',
    equipo: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900'
  };

  return (
    <>
      <div 
        className={`group flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ paddingLeft: `${(level * 24) + 16}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
          ) : (
            <div className="size-4" />
          )}
          <div className={`size-8 rounded-lg ${typeColors[node.type as OrgType] || 'bg-muted'} flex items-center justify-center shrink-0 border`}>
            <Building2 className="size-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">{node.name}</span>
              <Badge variant="outline" className={`text-[10px] uppercase font-black px-1.5 py-0 h-4 ${typeColors[node.type as OrgType] || 'bg-muted'}`}>
                {typeLabels[node.type as OrgType] || node.type}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
              {node.userCount !== undefined && <span className="flex items-center gap-1"><Users className="size-3" /> {node.userCount}</span>}
              {node.plan && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Package className="size-3" /> {node.plan}</span>
                </>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">WS: {node.id.slice(0, 5)}</span>
            </div>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-2">
          {node.modules?.slice(0, 2).map((m: string) => (
            <Badge key={m} variant="secondary" className="text-[10px] bg-background border-border/40">{m}</Badge>
          ))}
          {node.modules?.length > 2 && <span className="text-[10px] text-muted-foreground">+{node.modules.length - 2}</span>}
        </div>

        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="size-4" />
        </Button>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="animate-in slide-in-from-top-1 duration-200">
          {node.children!.map((child: any) => (
            <HierarchyRow key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </>
  );
}

function UsersSection() {
  const listUsers = useServerFn(adminListUsers);
  const { data: users, isLoading } = useQuery({ 
    queryKey: ["admin", "users"], 
    queryFn: () => listUsers() 
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Cargando catálogo de identidades…</div>;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Identidades en el Ecosistema</h2>
        <Badge variant="secondary">{users?.length} Usuarios Totales</Badge>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users?.map(user => (
          <Card key={user.id} className="border-border/60 hover:border-primary/40 transition-colors shadow-sm bg-card/40">
            <CardHeader className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold truncate pr-2">{user.email}</CardTitle>
                <Badge variant={user.isAdmin ? "default" : "secondary"} className="text-[10px]">
                  {user.isAdmin ? "Global Admin" : "User"}
                </Badge>
              </div>
              <CardDescription className="text-[10px]">Miembro desde: {new Date(user.createdAt).toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Membresías Activas</span>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[9px] bg-background">Workspace Default</Badge>
                    {user.extraRoles.map(r => (
                      <Badge key={r} variant="outline" className="text-[9px] capitalize border-primary/20">{r}</Badge>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs font-bold">
                  Gestionar Accesos
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Catálogo Central de Capacidades</h2>
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
                <div key={p.id} className="flex items-center justify-between group">
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

function ModulesSection() {
  const modules = [
    { id: 'live', name: 'RALLY Live', desc: 'Registro de partidos en tiempo real.', plan: 'Free+' },
    { id: 'scout', name: 'RALLY Scout', desc: 'Análisis técnico avanzado de video.', plan: 'Club+' },
    { id: 'video', name: 'RALLY Video', desc: 'Biblioteca de clips y playlists.', plan: 'Club+' },
    { id: 'intel', name: 'RALLY Intelligence', desc: 'IA aplicada a informes tácticos.', plan: 'Enterprise' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {modules.map(m => (
        <Card key={m.id} className="border-border/60 bg-card/40">
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
              <Settings className="size-4 text-muted-foreground cursor-pointer hover:text-foreground" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-muted-foreground">{m.desc}</p>
            <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Disponibilidad Global</span>
              <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/20 bg-green-500/5">Activo</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
