import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpCircle, Plus, Search, Filter, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/finances/income")({
  head: () => ({
    meta: [{ title: "Ingresos · RALLY" }],
  }),
  component: IncomeView,
});

function IncomeView() {
  const incomes = [
    { id: 1, source: "Sueldo IT", amount: "$350,000", date: "2026-08-01", category: "Sueldo", status: "Confirmado" },
    { id: 2, source: "Freelance Proyecto A", amount: "$85,000", date: "2026-08-05", category: "Freelance", status: "Confirmado" },
    { id: 3, source: "Venta Equipamiento", amount: "$15,000", date: "2026-08-10", category: "Ventas", status: "Pendiente" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-success/10 text-success">
            <ArrowUpCircle className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Ingresos</h1>
            <p className="text-muted-foreground font-medium">Gestiona tus entradas de dinero y flujos de caja.</p>
          </div>
        </div>
        <Button size="lg" className="rounded-2xl bg-success text-white shadow-glow hover:opacity-90 font-bold px-8 h-14">
          <Plus className="mr-2 size-5" /> NUEVO INGRESO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-elevated rounded-3xl bg-success/5">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-success uppercase tracking-widest mb-1">Total Mes</p>
            <h3 className="text-3xl font-black tracking-tighter">$450,000</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-elevated rounded-3xl bg-blue-500/5">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Pendiente Cobro</p>
            <h3 className="text-3xl font-black tracking-tighter">$15,000</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-elevated rounded-3xl bg-amber-500/5">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Mejor Fuente</p>
            <h3 className="text-3xl font-black tracking-tighter italic">Sueldo IT</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-elevated rounded-3xl overflow-hidden">
        <CardHeader className="bg-secondary/20 px-6 py-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar por fuente o categoría..." className="pl-10 rounded-xl border-2" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl border-2 font-bold">
                <Filter className="mr-2 size-4" /> Filtros
              </Button>
              <Button variant="outline" className="rounded-xl border-2 font-bold">
                <Download className="mr-2 size-4" /> Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4">Fuente</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4 text-center">Fecha</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {incomes.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm">{item.source}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-secondary text-[10px] font-black uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-medium text-muted-foreground">
                      {item.date}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-black uppercase ${item.status === 'Confirmado' ? 'text-success' : 'text-amber-500'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-black text-success tracking-tight">{item.amount}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
