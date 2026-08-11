import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { LiveMatchesFeed } from '@/components/LiveMatchesFeed'
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Layout, LogIn } from "lucide-react"

export const Route = createFileRoute('/')({
  beforeLoad: async ({ location }) => {
    // Si el usuario está autenticado y accede a la raíz, redirigir al dashboard
    // PERO permitir ver la raíz si se desea (p.ej. para ver el feed público)
    // Para simplificar el flujo SaaS, si ya está logueado, el dashboard es el destino natural.
    const { data } = await supabase.auth.getSession();
    if (data.session?.user && location.pathname === '/') {
      throw redirect({ to: '/dashboard' });
    }
  },
  head: () => ({
    title: 'RALLY · Estadísticas de Vóley para Entrenadores',
    meta: [
      {
        name: 'description',
        content: 'La plataforma definitiva para el scouting y análisis de vóley. Gestiona tus partidos, equipos y estadísticas en tiempo real.',
      },
      {
        property: 'og:title',
        content: 'RALLY · Estadísticas de Vóley Profesionales',
      },
      {
        property: 'og:description',
        content: 'Optimiza el rendimiento de tu equipo con datos precisos y scouting avanzado.',
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
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="mb-8 p-4 rounded-full bg-primary/10 text-primary">
          <Layout className="size-12" />
        </div>
        
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          RALLY
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mb-12">
          La plataforma inteligente para el análisis táctico y scouting de vóley en tiempo real.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mb-16">
          <Button asChild size="lg" className="rounded-full px-8 h-12 text-base font-bold">
            <Link to="/auth">
              <LogIn className="mr-2 size-5" />
              Ingresar a la Plataforma
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="rounded-full px-8 h-12 text-base font-bold">
            <Link to="/dashboard">
              Ir a mi Tablero
            </Link>
          </Button>
        </div>

        <div className="w-full max-w-4xl">
          <LiveMatchesFeed />
        </div>
      </main>

      <footer className="py-8 border-t border-border/40 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} RALLY · Volley Stats</p>
      </footer>
    </div>
  )
}
