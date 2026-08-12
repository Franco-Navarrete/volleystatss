import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, User, Shield, Bell, CreditCard, LogOut, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Configuración · RALLY" }],
  }),
  component: SettingsView,
});

function SettingsView() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const menuItems = [
    { title: "Perfil de Usuario", desc: "Nombre, email y foto de perfil", icon: User },
    { title: "Seguridad y RLS", desc: "Contraseña, 2FA y sesiones activas", icon: Shield },
    { title: "Notificaciones", desc: "Alertas de gastos, cobros y resúmenes", icon: Bell },
    { title: "Plan y Facturación", desc: "Gestionar tu suscripción SaaS", icon: CreditCard },
  ];

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
          <SettingsIcon className="size-8" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Configuración</h1>
          <p className="text-muted-foreground font-medium">Personaliza tu experiencia y gestiona tu cuenta.</p>
        </div>
      </div>

      <div className="space-y-4">
        {menuItems.map((item, i) => (
          <Card key={i} className="border-none shadow-elevated rounded-3xl overflow-hidden group cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <item.icon className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">{item.title}</h3>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="size-6 text-muted-foreground group-hover:translate-x-2 transition-transform" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-8 flex flex-col items-center gap-6">
        <Button 
          variant="destructive" 
          size="lg" 
          className="rounded-2xl px-10 h-16 text-lg font-black shadow-lg w-full md:w-auto"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 size-6" /> CERRAR SESIÓN
        </Button>
        
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">RALLY FINANCIAL SaaS v1.0.0</p>
          <p className="text-[10px] font-bold text-primary italic uppercase tracking-widest">Built for total financial freedom</p>
        </div>
      </div>
    </div>
  );
}
