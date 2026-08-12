import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Plus, Calendar, AlertCircle, CheckCircle2, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finances/budget")({
  head: () => ({
    meta: [{ title: "Presupuesto Mensual · RALLY" }],
  }),
  component: BudgetView,
});

function BudgetView() {
  const categories = [
    { name: "Gastos Fijos", budget: "$150,000", spent: "$120,000", progress: 80, color: "bg-blue-500", status: "ok" },
    { name: "Comida", budget: "$80,000", spent: "$75,000", progress: 94, color: "bg-amber-500", status: "warning" },
    { name: "Salidas", budget: "$40,000", spent: "$45,000", progress: 112, color: "bg-rose-500", status: "danger" },
    { name: "Transporte", budget: "$20,000", spent: "$12,000", progress: 60, color: "bg-emerald-500", status: "ok" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <PieChart className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Presupuesto</h1>
            <p className="text-muted-foreground font-medium">Define límites por categoría y controla tus gastos mensuales.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="lg" className="rounded-2xl border-2 font-bold h-14">
            <Calendar className="mr-2 size-5" /> AGOSTO 2026
          </Button>
          <Button size="lg" className="rounded-2xl bg-primary text-primary-foreground shadow-glow hover:opacity-90 font-bold px-8 h-14">
            <Plus className="mr-2 size-5" /> AJUSTAR LÍMITES
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 border-none shadow-elevated rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-secondary/20 px-6 py-8 flex flex-col items-center text-center gap-2">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Presupuesto Total</p>
            <h2 className="text-4xl font-black tracking-tighter">$290,000</h2>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-success/10 text-success text-xs font-black">
              <CheckCircle2 className="size-4" /> DENTRO DEL LÍMITE
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-sm font-bold text-muted-foreground">Gastado Total</span>
              <span className="text-xl font-black">$252,000</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b">
              <span className="text-sm font-bold text-muted-foreground">Disponible</span>
              <span className="text-xl font-black text-success">$38,000</span>
            </div>
             <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-muted-foreground">Días Restantes</span>
              <span className="text-xl font-black italic">19 días</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none shadow-elevated rounded-3xl overflow-hidden">
          <CardHeader className="px-6 py-4 flex flex-row items-center justify-between border-b">
            <CardTitle className="text-lg font-bold">Desglose por Categoría</CardTitle>
            <TrendingDown className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {categories.map((cat, i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`size-3 rounded-full ${cat.color}`} />
                    <span className="font-bold">{cat.name}</span>
                    {cat.status === 'danger' && <AlertCircle className="size-4 text-destructive animate-pulse" />}
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-black ${cat.status === 'danger' ? 'text-destructive' : 'text-foreground'}`}>
                      {cat.spent}
                    </span>
                    <span className="text-xs text-muted-foreground font-bold ml-2">/ {cat.budget}</span>
                  </div>
                </div>
                <div className="h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${cat.color} transition-all duration-1000`} 
                    style={{ width: `${Math.min(cat.progress, 100)}%` }}
                  />
                </div>
                {cat.status === 'danger' && (
                  <p className="text-[10px] font-black text-destructive uppercase tracking-widest text-right">
                    Te excediste por {cat.progress - 100}%
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
