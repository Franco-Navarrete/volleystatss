import { createFileRoute } from "@tanstack/react-router";
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  TrendingUp, 
  PiggyBank, 
  Target,
  Plus,
  ArrowRight,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinancialKpiCard } from "@/components/FinancialKpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Financiero · RALLY" },
      { name: "description", content: "Resumen de tus finanzas personales, ingresos, gastos y objetivos." },
    ],
  }),
  component: FinancialDashboard,
});

function FinancialDashboard() {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">HOLA, FRANCO</h1>
          <p className="text-muted-foreground">Tu salud financiera está al 85% este mes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="rounded-2xl border-2">
            <Filter className="mr-2 size-4" /> Filtros
          </Button>
          <Button size="lg" className="rounded-2xl bg-primary text-primary-foreground shadow-glow hover:opacity-90">
            <Plus className="mr-2 size-4" /> Nuevo Movimiento
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinancialKpiCard
          title="Balance Total"
          value="$1,250,000"
          icon={Wallet}
          description="Efectivo + Bancos"
          trend={{ value: "5%", positive: true }}
          iconClassName="bg-blue-500/10"
        />
        <FinancialKpiCard
          title="Ingresos (Mes)"
          value="$450,000"
          icon={ArrowUpCircle}
          description="Sueldo + Extras"
          trend={{ value: "12%", positive: true }}
          iconClassName="bg-emerald-500/10"
        />
        <FinancialKpiCard
          title="Gastos (Mes)"
          value="$280,000"
          icon={ArrowDownCircle}
          description="Fijos + Variables"
          trend={{ value: "2%", positive: false }}
          iconClassName="bg-rose-500/10"
        />
        <FinancialKpiCard
          title="Capacidad Ahorro"
          value="$170,000"
          icon={TrendingUp}
          description="37% de tus ingresos"
          iconClassName="bg-amber-500/10"
        />
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 border-none shadow-elevated overflow-hidden rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between bg-secondary/20 px-6 py-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ArrowRight className="size-5 text-primary" /> Movimientos Recientes
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-primary font-bold">Ver todo</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y border-t">
              {[
                { label: 'Supermercado Coto', date: 'Hoy', amount: '-$45,000', type: 'expense', category: 'Comida' },
                { label: 'Sueldo IT', date: 'Ayer', amount: '+$350,000', type: 'income', category: 'Sueldo' },
                { label: 'Netflix', date: '10 Ago', amount: '-$8,500', type: 'expense', category: 'Suscripciones' },
                { label: 'Gimnasio', date: '08 Ago', amount: '-$12,000', type: 'expense', category: 'Salud' },
                { label: 'Transferencia Vóley', date: '05 Ago', amount: '+$25,000', type: 'income', category: 'Vóley' },
              ].map((tx, i) => (
                <div key={i} className="flex items-center justify-between p-4 px-6 hover:bg-accent/50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "size-10 rounded-2xl flex items-center justify-center font-bold text-lg",
                      tx.type === 'income' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}>
                      {tx.label[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm leading-none">{tx.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{tx.category} • {tx.date}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "text-sm font-black tracking-tight",
                    tx.type === 'income' ? "text-success" : "text-foreground"
                  )}>
                    {tx.amount}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Goals & Funds */}
        <div className="space-y-8">
          {/* Goals */}
          <Card className="border-none shadow-elevated rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/5 px-6 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Target className="size-5 text-primary" /> Objetivos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {[
                { name: 'Fondo de Emergencia', progress: 85, target: '$1.000.000', current: '$850.000' },
                { name: 'Viaje a Brasil', progress: 40, target: '$500.000', current: '$200.000' },
              ].map((goal, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                    <span>{goal.name}</span>
                    <span className="text-primary">{goal.progress}%</span>
                  </div>
                  <div className="h-3 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{goal.current}</span>
                    <span>Meta: {goal.target}</span>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full rounded-xl border-dashed py-6 border-2">
                <Plus className="mr-2 size-4" /> Nuevo Objetivo
              </Button>
            </CardContent>
          </Card>

          {/* Funds / Piggy Bank */}
          <Card className="border-none shadow-elevated rounded-3xl overflow-hidden">
            <CardHeader className="bg-amber-500/5 px-6 py-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PiggyBank className="size-5 text-amber-500" /> Fondos (Sobres)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {[
                { name: 'Salidas', balance: '$15,000', color: 'bg-rose-500' },
                { name: 'Ropa', balance: '$45,000', color: 'bg-blue-500' },
                { name: 'Electrónica', balance: '$120,000', color: 'bg-emerald-500' },
              ].map((fund, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className={cn("size-3 rounded-full", fund.color)} />
                    <span className="text-sm font-bold">{fund.name}</span>
                  </div>
                  <span className="text-sm font-black">{fund.balance}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Utility for conditional classes
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
