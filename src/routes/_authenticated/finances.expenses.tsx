import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, Plus, Search, Filter, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/finances/expenses")({
  head: () => ({
    meta: [{ title: "Gastos · RALLY" }],
  }),
  component: ExpensesView,
});

function ExpensesView() {
  const expenses = [
    { id: 1, label: "Supermercado Coto", amount: "-$45,000", date: "2026-08-11", category: "Comida", method: "Débito" },
    { id: 2, label: "Netflix", amount: "-$8,500", date: "2026-08-10", category: "Suscripciones", method: "Tarjeta" },
    { id: 3, label: "Gimnasio", amount: "-$12,000", date: "2026-08-08", category: "Salud", method: "Efectivo" },
    { id: 4, label: "Alquiler Depto", amount: "-$120,000", date: "2026-08-01", category: "Fijos", method: "Transferencia" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-destructive/10 text-destructive">
            <ArrowDownCircle className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Gastos</h1>
            <p className="text-muted-foreground font-medium">Monitorea cada salida de dinero y optimiza tu consumo.</p>
          </div>
        </div>
        <Button size="lg" className="rounded-2xl bg-destructive text-white shadow-glow hover:opacity-90 font-bold px-8 h-14">
          <Plus className="mr-2 size-5" /> NUEVO GASTO
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-elevated rounded-3xl bg-destructive/5">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-destructive uppercase tracking-widest mb-1">Gastado Mes</p>
            <h3 className="text-3xl font-black tracking-tighter">$280,000</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-elevated rounded-3xl bg-blue-500/5">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Fijos del Mes</p>
            <h3 className="text-3xl font-black tracking-tighter">$150,000</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-elevated rounded-3xl bg-amber-500/5">
          <CardContent className="p-6">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Mayor Categoría</p>
            <h3 className="text-3xl font-black tracking-tighter italic">Alquiler</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-elevated rounded-3xl overflow-hidden">
        <CardHeader className="bg-secondary/20 px-6 py-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="¿En qué gastaste hoy?" className="pl-10 rounded-xl border-2" />
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
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4 text-center">Fecha</th>
                  <th className="px-6 py-4 text-center">Método</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm">{item.label}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-secondary text-[10px] font-black uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-medium text-muted-foreground">
                      {item.date}
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-bold uppercase text-muted-foreground/70">
                      {item.method}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-black tracking-tight">{item.amount}</p>
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
