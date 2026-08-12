import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PiggyBank, Plus, TrendingUp, MoreVertical, ArrowRightLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finances/funds")({
  head: () => ({
    meta: [{ title: "Fondos y Ahorros · RALLY" }],
  }),
  component: FundsView,
});

function FundsView() {
  const funds = [
    { name: "Fondo de Emergencia", balance: "$850,000", target: "$1,000,000", progress: 85, color: "bg-blue-500", icon: "shield" },
    { name: "Ocio y Salidas", balance: "$15,000", target: "$40,000", progress: 37, color: "bg-rose-500", icon: "coffee" },
    { name: "Ahorro Ropa", balance: "$45,000", target: "$60,000", progress: 75, color: "bg-amber-500", icon: "shirt" },
    { name: "Electrónica", balance: "$120,000", target: "$300,000", progress: 40, color: "bg-emerald-500", icon: "cpu" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
            <PiggyBank className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Fondos (Sobres)</h1>
            <p className="text-muted-foreground font-medium">Divide tu dinero en cubetas virtuales para gastar con conciencia.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="lg" className="rounded-2xl border-2 font-bold h-14">
            <ArrowRightLeft className="mr-2 size-5" /> TRASPASAR
          </Button>
          <Button size="lg" className="rounded-2xl bg-primary text-primary-foreground shadow-glow hover:opacity-90 font-bold px-8 h-14">
            <Plus className="mr-2 size-5" /> NUEVO FONDO
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {funds.map((fund, i) => (
          <Card key={i} className="border-none shadow-elevated rounded-3xl overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className={`p-2 rounded-xl ${fund.color}/10`}>
                <TrendingUp className={`size-5 text-${fund.color.split('-')[1]}-500`} />
              </div>
              <Button variant="ghost" size="icon" className="rounded-full">
                <MoreVertical className="size-4 text-muted-foreground" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xl font-black tracking-tight">{fund.name}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black tracking-tighter">{fund.balance}</span>
                  <span className="text-xs text-muted-foreground font-bold">de {fund.target}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${fund.color} transition-all duration-1000`} 
                    style={{ width: `${fund.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span>Progreso</span>
                  <span className={fund.progress > 80 ? "text-success" : ""}>{fund.progress}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        <button className="border-4 border-dashed border-muted rounded-3xl p-8 flex flex-col items-center justify-center gap-4 hover:bg-accent/30 transition-colors group">
          <div className="p-4 rounded-full bg-muted text-muted-foreground group-hover:scale-110 transition-transform">
            <Plus className="size-8" />
          </div>
          <span className="text-sm font-black uppercase tracking-widest text-muted-foreground">Añadir Fondo</span>
        </button>
      </div>

      <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl p-8 border border-white/5 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2 italic">Optimiza tu distribución</h2>
            <p className="text-muted-foreground font-medium">
              ¿Sabías que puedes configurar para que cada quincena el 10% de tus ingresos se asigne automáticamente al "Fondo de Emergencia"?
            </p>
          </div>
          <Button className="rounded-2xl bg-white text-black font-black hover:bg-white/90 px-8 h-12 shadow-xl">
            CONFIGURAR AUTO-FONDOS
          </Button>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <PiggyBank className="size-32" />
        </div>
      </div>
    </div>
  );
}
