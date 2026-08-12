import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finances/calendar")({
  head: () => ({
    meta: [{ title: "Calendario Financiero · RALLY" }],
  }),
  component: CalendarView,
});

function CalendarView() {
  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <CalendarIcon className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Calendario</h1>
            <p className="text-muted-foreground font-medium">Visualiza tus vencimientos, cobros y suscripciones en el tiempo.</p>
          </div>
        </div>
        <Button size="lg" className="rounded-2xl bg-primary text-primary-foreground shadow-glow hover:opacity-90 font-bold px-8 h-14">
          <Plus className="mr-2 size-5" /> AGENDAR RECORDATORIO
        </Button>
      </div>

      <Card className="border-none shadow-elevated rounded-3xl overflow-hidden bg-card">
        <CardHeader className="flex flex-row items-center justify-between bg-secondary/20 px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="size-6" /></Button>
            <h2 className="text-2xl font-black uppercase tracking-tighter italic">Agosto 2026</h2>
            <Button variant="ghost" size="icon" className="rounded-full"><ChevronRight className="size-6" /></Button>
          </div>
          <Button variant="outline" className="rounded-xl border-2 font-bold">HOY</Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[600px]">
            {Array.from({ length: 35 }).map((_, i) => {
              const day = i - 2;
              const isToday = day === 12;
              const hasEvent = day === 1 || day === 5 || day === 10 || day === 15;
              
              return (
                <div key={i} className={`p-2 border-r border-b last:border-r-0 min-h-[120px] relative transition-colors ${day > 0 && day <= 31 ? 'hover:bg-accent/30 cursor-pointer' : 'bg-muted/10 opacity-30'}`}>
                  {day > 0 && day <= 31 && (
                    <>
                      <span className={`text-xs font-black ${isToday ? 'bg-primary text-primary-foreground size-6 rounded-lg flex items-center justify-center' : 'text-muted-foreground'}`}>
                        {day}
                      </span>
                      {hasEvent && (
                        <div className="mt-2 space-y-1">
                          <div className={`text-[8px] font-black p-1 rounded-md border ${day === 1 ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                            {day === 1 ? "COBRO SUELDO" : "VENCE ALQUILER"}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-6 p-6 rounded-3xl bg-amber-500/5 border-2 border-dashed border-amber-500/20">
        <AlertCircle className="size-8 text-amber-500 shrink-0" />
        <p className="text-sm font-bold">
          <span className="text-amber-500 uppercase">Aviso:</span> Mañana vencen 3 suscripciones (Netflix, Spotify, iCloud). Asegúrate de tener saldo en tu tarjeta Galicia.
        </p>
      </div>
    </div>
  );
}
