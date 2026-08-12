import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Plus, CreditCard, Banknote, Landmark, Smartphone, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/finances/accounts")({
  head: () => ({
    meta: [{ title: "Mis Cuentas · RALLY" }],
  }),
  component: AccountsView,
});

function AccountsView() {
  const accounts = [
    { name: "Efectivo", balance: "$25,000", type: "cash", icon: Banknote, color: "bg-emerald-500" },
    { name: "Banco Galicia", balance: "$850,000", type: "bank", icon: Landmark, color: "bg-blue-600" },
    { name: "Mercado Pago", balance: "$125,500", type: "digital", icon: Smartphone, color: "bg-sky-400" },
    { name: "Tarjeta VISA", balance: "-$45,000", type: "credit", icon: CreditCard, color: "bg-rose-500" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Wallet className="size-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">Cuentas</h1>
            <p className="text-muted-foreground font-medium">Gestiona tus fuentes de dinero, bancos y billeteras digitales.</p>
          </div>
        </div>
        <Button size="lg" className="rounded-2xl bg-primary text-primary-foreground shadow-glow hover:opacity-90 font-bold px-8 h-14">
          <Plus className="mr-2 size-5" /> NUEVA CUENTA
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {accounts.map((acc, i) => (
          <Card key={i} className="border-none shadow-elevated rounded-3xl overflow-hidden group">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className={cn("size-14 rounded-2xl flex items-center justify-center text-white shadow-lg", acc.color)}>
                  <acc.icon className="size-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">{acc.name}</h3>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {acc.type === 'cash' ? 'Efectivo' : acc.type === 'bank' ? 'Banco' : acc.type === 'digital' ? 'Billetera Digital' : 'Crédito'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-2xl font-black tracking-tighter",
                  acc.balance.startsWith('-') ? "text-destructive" : "text-foreground"
                )}>
                  {acc.balance}
                </div>
                <Button variant="ghost" size="icon" className="rounded-full mt-2 hover:bg-accent">
                  <MoreHorizontal className="size-5 text-muted-foreground" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-elevated rounded-3xl bg-primary/5 p-6 flex flex-col items-center text-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Patrimonio Líquido</p>
            <h4 className="text-3xl font-black tracking-tighter">$1,000,500</h4>
        </Card>
        <Card className="border-none shadow-elevated rounded-3xl bg-destructive/5 p-6 flex flex-col items-center text-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Deuda Total</p>
            <h4 className="text-3xl font-black tracking-tighter">$45,000</h4>
        </Card>
        <Card className="border-none shadow-elevated rounded-3xl bg-success/5 p-6 flex flex-col items-center text-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Salud de Cuentas</p>
            <h4 className="text-3xl font-black tracking-tighter text-success">ÓPTIMA</h4>
        </Card>
      </div>
    </div>
  );
}
