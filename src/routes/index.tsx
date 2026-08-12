import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Wallet, LogIn, TrendingUp, ShieldCheck, PieChart } from "lucide-react"

export const Route = createFileRoute('/')({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user && location.pathname === '/') {
      throw redirect({ to: '/dashboard' });
    }
  },
  head: () => ({
    title: 'RALLY · Administración Financiera Personal',
    meta: [
      {
        name: 'description',
        content: 'Toma el control total de tus finanzas. Gestiona ingresos, gastos, presupuestos y ahorros en un solo lugar.',
      },
      {
        property: 'og:title',
        content: 'RALLY · Tu Inteligencia Financiera',
      },
      {
        property: 'og:description',
        content: 'Optimiza tus ahorros y gestiona tus quincenas con RALLY.',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
    ],
  }),
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <div className="mb-8 p-6 rounded-3xl bg-primary/10 text-primary shadow-glow">
          <Wallet className="size-16" />
        </div>
        
        <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-6 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          RALLY <span className="text-primary italic">FINANZAS</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-12 font-medium">
          La plataforma SaaS definitiva para el control total de tu economía personal. 
          <span className="block mt-2 text-primary font-bold italic">Inteligente. Privada. Efectiva.</span>
        </p>

        <div className="flex flex-wrap justify-center gap-4 mb-20">
          <Button asChild size="lg" className="rounded-2xl px-10 h-16 text-lg font-black shadow-glow hover:scale-105 transition-transform">
            <Link to="/auth">
              <LogIn className="mr-3 size-6" />
              EMPEZAR AHORA
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="rounded-2xl px-10 h-16 text-lg font-black border-2 hover:bg-accent">
            <Link to="/dashboard">
              VER DEMO
            </Link>
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-left">
          {[
            { 
              title: "Control de Quincenas", 
              desc: "Distribuye automáticamente tus ingresos entre gastos fijos y fondos de ahorro.",
              icon: TrendingUp 
            },
            { 
              title: "Sobres Virtuales", 
              desc: "Sistema de fondos (buckets) para que nunca gastes más de lo que tenías planeado.",
              icon: PieChart 
            },
            { 
              title: "Privacidad Total", 
              desc: "Tus datos financieros están protegidos con seguridad de grado bancario y RLS.",
              icon: ShieldCheck 
            }
          ].map((f, i) => (
            <div key={i} className="p-8 rounded-3xl bg-card border-2 border-border/40 hover:border-primary/50 transition-colors group">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary w-fit mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="size-8" />
              </div>
              <h3 className="text-xl font-black tracking-tight mb-2 uppercase">{f.title}</h3>
              <p className="text-muted-foreground font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-12 border-t border-border/40 text-center">
        <p className="text-sm text-muted-foreground font-bold tracking-widest uppercase">
          © {new Date().getFullYear()} RALLY · Financial Intelligence SaaS
        </p>
      </footer>
    </div>
  )
}
