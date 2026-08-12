import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Plus, Calendar, Star, TrendingUp, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finances/goals")({
  head: () => ({
    meta: [{ title: "Mis Objetivos · RALLY" }],
  }),
  component: GoalsView,
});

function GoalsView() {
  const goals = [
    { name: "Fondo de Emergencia", current: "$850,000", target: "$1,000,000", progress: 85, deadline: "Dic 2026", priority: "Alta" },
    { name: "Viaje a Brasil 2027", current: "$200,000", target: "$500,000", progress: 40, deadline: "Ene 2027", priority: "Media" },
    { name: "Nueva MacBook Pro", current: "$450,000", target: "$2,500,000", progress: 18, deadline: "Jun 2027", priority: "Alta" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Target className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Objetivos</h1>
            <p className="text-muted-foreground font-medium">Define tus metas financieras y sigue tu progreso paso a paso.</p>
          </div>
        </div>
        <Button size="lg" className="rounded-2xl bg-primary text-primary-foreground shadow-glow hover:opacity-90 font-bold px-8 h-14">
          <Plus className="mr-2 size-5" /> NUEVA META
        </Button>
      </div>

      <div className="space-y-6">
        {goals.map((goal, i) => (
          <Card key={i} className="border-none shadow-elevated rounded-3xl overflow-hidden group">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                <div className="p-8 md:w-1/3 flex flex-col justify-between border-b md:border-b-0 md:border-r">
                   <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Star className={`size-4 ${goal.priority === 'Alta' ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridad {goal.priority}</span>
                      </div>
                      <h3 className="text-2xl font-black tracking-tighter uppercase">{goal.name}</h3>
                   </div>
                   <div className="mt-8 flex items-center gap-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <Calendar className="size-4" /> {goal.deadline}
                      </div>
                   </div>
                </div>
                
                <div className="p-8 flex-1 flex flex-col justify-center gap-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Acumulado</p>
                      <h4 className="text-4xl font-black tracking-tighter">{goal.current}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Meta Final</p>
                      <h4 className="text-xl font-black tracking-tighter text-muted-foreground">{goal.target}</h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-4 bg-secondary rounded-full overflow-hidden p-1">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-1000 flex items-center justify-end px-2" 
                        style={{ width: `${goal.progress}%` }}
                      >
                         <span className="text-[8px] font-black text-primary-foreground">{goal.progress}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:w-20 bg-secondary/20 flex items-center justify-center group-hover:bg-primary transition-colors cursor-pointer">
                  <ChevronRight className="size-8 group-hover:text-primary-foreground text-muted-foreground transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <Card className="border-none shadow-elevated rounded-3xl bg-primary p-8 text-primary-foreground overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-2xl font-black uppercase mb-4 italic">¿Cómo alcanzarlo más rápido?</h3>
            <p className="font-medium opacity-90 mb-6">
              Nuestra IA sugiere que si reduces tus gastos en "Ocio" un 15%, podrías completar tu "Fondo de Emergencia" 2 meses antes.
            </p>
            <Button className="rounded-xl bg-white text-black font-black hover:bg-white/90">
              VER PLAN DE ACCIÓN
            </Button>
          </div>
          <TrendingUp className="absolute -bottom-8 -right-8 size-48 opacity-10" />
        </Card>

        <Card className="border-4 border-dashed border-muted bg-transparent rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-4 cursor-pointer hover:border-primary/50 transition-colors">
            <div className="p-4 rounded-full bg-muted text-muted-foreground">
              <Plus className="size-10" />
            </div>
            <h4 className="text-xl font-black uppercase text-muted-foreground">Crear Nuevo Objetivo Financiero</h4>
        </Card>
      </div>
    </div>
  );
}
