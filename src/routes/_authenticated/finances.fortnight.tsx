import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Repeat, ArrowRight, Save, Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finances/fortnight")({
  head: () => ({
    meta: [
      { title: "Gestión de Quincenas · RALLY" },
    ],
  }),
  component: FortnightManager,
});

function FortnightManager() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">DISTRIBUCIÓN DE QUINCENA</h1>
          <p className="text-muted-foreground">Planifica cómo dividir tus ingresos este periodo.</p>
        </div>
        <div className="p-4 rounded-3xl bg-primary/10 text-primary">
          <Repeat className="size-8" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 border-none shadow-elevated rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary px-6 py-4">
            <CardTitle className="text-lg font-bold text-primary-foreground flex items-center gap-2">
              <Calculator className="size-5" /> Ingreso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="income" className="font-bold">Monto a Distribuir</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">$</span>
                <Input 
                  id="income" 
                  placeholder="0.00" 
                  className="pl-8 h-12 rounded-xl border-2 font-black text-lg" 
                  defaultValue="150000"
                />
              </div>
            </div>
            <Button className="w-full h-12 rounded-xl font-bold shadow-glow">
              Calcular Sugerencia
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none shadow-elevated rounded-3xl overflow-hidden">
          <CardHeader className="bg-secondary/20 px-6 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">Distribución Propuesta</CardTitle>
            <span className="text-xs font-bold px-3 py-1 bg-success/10 text-success rounded-full">
              100% Asignado
            </span>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {[
              { name: 'Gastos Fijos (Servicios, Alquiler)', percentage: 50, amount: '$75,000', color: 'bg-rose-500' },
              { name: 'Fondo de Emergencia', percentage: 20, amount: '$30,000', color: 'bg-blue-500' },
              { name: 'Ahorro Inversión', percentage: 20, amount: '$30,000', color: 'bg-emerald-500' },
              { name: 'Ocio / Gustos', percentage: 10, amount: '$15,000', color: 'bg-amber-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold flex items-center gap-2">
                    <div className={`size-2 rounded-full ${item.color}`} />
                    {item.name}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground font-medium">{item.percentage}%</span>
                    <span className="font-black">{item.amount}</span>
                  </div>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color}`} 
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-4 border-t flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1 h-12 rounded-xl border-2 font-bold">
                Ajustar Porcentajes
              </Button>
              <Button className="flex-1 h-12 rounded-xl bg-success hover:bg-success/90 text-white font-black shadow-glow">
                <Save className="mr-2 size-5" /> EJECUTAR DISTRIBUCIÓN
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-3xl bg-accent/20 border-2 border-dashed border-accent p-8 text-center">
        <h3 className="text-xl font-black uppercase mb-2 italic">Pro Tip Financiero</h3>
        <p className="text-muted-foreground max-w-xl mx-auto font-medium">
          "Si automatizas tu ahorro al principio de la quincena, dejas de tratar al ahorro como 'lo que sobra' y lo conviertes en una prioridad."
        </p>
      </div>
    </div>
  );
}
