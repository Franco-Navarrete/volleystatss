import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  Plus
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin } from "@/hooks/use-auth";
import { adminListUsers, adminListLeagues } from "@/lib/admin.functions";

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

// Mock de la jerarquía para visualización inicial (será reemplazado por datos reales de la DB)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-bold uppercase tracking-wider">SaaS Infrastructure</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Panel de Administración</h1>
          <p className="text-sm text-muted-foreground">Gestioná la jerarquía global de RALLY.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <History className="size-4 mr-2" /> Auditoría
          </Button>
          <Button size="sm" className="h-9 shadow-glow">
            <Plus className="size-4 mr-2" /> Nueva Organización
          </Button>
        </div>
      </div>

      <Tabs defaultValue="organizations" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger value="organizations" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <Building2 className="size-4 mr-2" /> Organizaciones
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <Users className="size-4 mr-2" /> Usuarios & Roles
          </TabsTrigger>
          <TabsTrigger value="modules" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <Package className="size-4 mr-2" /> Módulos & Planes
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-lg py-2 px-4 data-[state=active]:shadow-sm">
            <CreditCard className="size-4 mr-2" /> Suscripciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="m-0 focus-visible:outline-none">
          <Card className="border-border/60 shadow-elevated overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Explorador de Jerarquía</CardTitle>
                  <CardDescription>Visualización tipo árbol de la estructura SaaS.</CardDescription>
                </div>
                <Badge variant="outline" className="bg-background/50">Total: 1,452 nodos</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {MOCK_HIERARCHY.map(node => (
                  <HierarchyRow key={node.id} node={node} level={0} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="m-0">
          <UsersSection />
        </TabsContent>

        <TabsContent value="modules" className="m-0">
          <ModulesSection />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function HierarchyRow({ node, level }: { node: OrganizationNode, level: number }) {
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
          <div className={`size-8 rounded-lg ${typeColors[node.type]} flex items-center justify-center shrink-0 border`}>
            <Building2 className="size-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm truncate">{node.name}</span>
              <Badge variant="outline" className={`text-[10px] uppercase font-black px-1.5 py-0 h-4 ${typeColors[node.type]}`}>
                {typeLabels[node.type]}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Users className="size-3" /> {node.userCount}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Package className="size-3" /> {node.plan}</span>
              <span>•</span>
              <span className="flex items-center gap-1">WS: {node.id.slice(0, 5)}</span>
            </div>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-2">
          {node.modules.slice(0, 2).map(m => (
            <Badge key={m} variant="secondary" className="text-[10px] bg-background border-border/40">{m}</Badge>
          ))}
          {node.modules.length > 2 && <span className="text-[10px] text-muted-foreground">+{node.modules.length - 2}</span>}
        </div>

        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="size-4" />
        </Button>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="animate-in slide-in-from-top-1 duration-200">
          {node.children!.map(child => (
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
                    {/* En la nueva arquitectura esto mostraría las organizaciones del usuario */}
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
