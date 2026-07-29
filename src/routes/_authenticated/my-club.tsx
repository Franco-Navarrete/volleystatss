import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useVolley } from "@/lib/volley-store";
import { Building2, Users, Layers, Plus, ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import { useAuthUser } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/my-club")({
  head: () => ({ meta: [{ title: "Mi Club · RALLY" }] }),
  component: MyClubPage,
});

function MyClubPage() {
  const { user } = useAuthUser();
  const teams = useVolley((s) => s.teams);
  
  // En RALLY, los clubes se infieren de los equipos que el usuario posee
  // o donde es coach. Filtramos los equipos del usuario.
  const myTeams = useMemo(() => {
    if (!user) return [];
    return teams.filter(t => t.ownerId === user.id || t.club === user.email);
  }, [teams, user]);

  // Agrupamos por club
  const clubName = myTeams.length > 0 ? (myTeams[0].club || "Mi Club") : "Mi Club";
  
  const categories = useMemo(() => {
    const cats = new Set(myTeams.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [myTeams]);

  const totalPlayers = useMemo(() => {
    let count = 0;
    myTeams.forEach(t => count += t.players.length);
    return count;
  }, [myTeams]);

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Building2 className="size-8 text-primary" />
              {clubName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestión deportiva integral de tu institución.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Editar Club
            </Button>
            <Button size="sm" className="shadow-glow" asChild>
              <Link to="/teams">
                <Plus className="size-4 mr-2" /> Nueva Categoría
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            icon={Layers} 
            label="Categorías" 
            value={categories.length.toString()} 
            color="text-primary" 
          />
          <StatCard 
            icon={Users} 
            label="Equipos" 
            value={myTeams.length.toString()} 
            color="text-accent" 
          />
          <StatCard 
            icon={UserPlus} 
            label="Jugadores" 
            value={totalPlayers.toString()} 
            color="text-success" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              Categorías y Planteles
            </h2>
            <div className="grid gap-3">
              {myTeams.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center">
                    <p className="text-sm text-muted-foreground">Aún no tienes equipos o categorías configuradas.</p>
                    <Button variant="link" className="mt-2" asChild>
                      <Link to="/teams">Crear mi primer equipo</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                myTeams.map(team => (
                  <Link key={team.id} to="/teams">
                    <Card className="group hover:border-primary/40 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`size-10 rounded-full flex items-center justify-center text-white font-bold`} style={{ backgroundColor: team.color }}>
                            {team.shortName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold leading-none">{team.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              {team.category ? `Categoría ${team.category}` : 'Sin categoría'} · {team.players.length} jugadores
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              Staff y Acceso
            </h2>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Administradores del Club</CardTitle>
                <CardDescription>Usuarios con permiso para gestionar este espacio.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {user?.email?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{user?.email}</p>
                      <Badge variant="outline" className="text-[10px] h-4">Dueño</Badge>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full text-xs" size="sm">
                  <UserPlus className="size-3 mr-2" /> Invitar Entrenador
                </Button>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/60">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-3xl font-black mt-1">{value}</p>
          </div>
          <Icon className={`size-8 ${color} opacity-80`} />
        </div>
      </CardContent>
    </Card>
  );
}
