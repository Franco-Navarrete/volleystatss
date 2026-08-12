import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, TrendingUp, TrendingDown, Calendar, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finances/stats")({
  head: () => ({
    meta: [{ title: "Estadísticas y Análisis · RALLY" }],
  }),
  component: StatsView,
});

function StatsView() {
  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Estadísticas</h1>
            <p className="text-muted-foreground font-medium">Analiza tus patrones de gasto y evolución financiera en el tiempo.</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="lg" className="rounded-2xl border-2 font-bold h-14">
            <Calendar className="mr-2 size-5" /> ÚLTIMOS 6 MESES
          </Button>
          <Button variant="outline" size="lg" className="rounded-2xl border-2 font-bold h-14">
            <Download className="mr-2 size-5" /> REPORTE PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-elevated rounded-3xl overflow-hidden bg-card">
          <CardHeader className="px-6 py-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="size-5 text-success" /> Ingresos vs Gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-12 flex items-center justify-center text-center">
            <div className="space-y-4">
              <div className="p-8 rounded-full bg-primary/5 border-4 border-dashed border-primary/20">
                <BarChart3 className="size-16 text-primary/40" />
              </div>
              <p className="text-muted-foreground font-medium italic">Gráfico de barras comparativo (próximamente)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-elevated rounded-3xl overflow-hidden bg-card">
          <CardHeader className="px-6 py-4 border-b">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PieChart className="size-5 text-primary" /> Distribución de Gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-12 flex items-center justify-center text-center">
            <div className="space-y-4">
              <div className="p-8 rounded-full bg-accent/5 border-4 border-dashed border-accent/20">
                <PieChart className="size-16 text-accent/40" />
              </div>
              <p className="text-muted-foreground font-medium italic">Gráfico de torta por categorías (próximamente)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Ahorro Promedio", value: "$125,000", trend: "+12%", color: "text-success" },
          { label: "Gasto Variable", value: "$95,000", trend: "-5%", color: "text-success" },
          { label: "Días con Saldo +", value: "28/31", trend: "+2 días", color: "text-primary" },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-elevated rounded-3xl p-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">{stat.label}</p>
            <h4 className="text-3xl font-black tracking-tighter mb-2">{stat.value}</h4>
            <span className={`text-xs font-bold ${stat.color}`}>{stat.trend}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
