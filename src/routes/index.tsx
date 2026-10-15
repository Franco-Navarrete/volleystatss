import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, Brain, LogIn, Volleyball, ArrowDown } from "lucide-react";
import heroImg from "@/assets/hero-volley.jpg";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ location }) => {
    // Con sesión iniciada, el tablero es el destino natural (los permisos los aplica la zona autenticada).
    const { data } = await supabase.auth.getSession();
    if (data.session?.user && location.pathname === "/") {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "RALLY · Scouting y estadísticas de vóley en tiempo real" },
      { name: "description", content: "Scouting, estadísticas y análisis táctico de vóley en tiempo real para entrenadores y clubes." },
      { property: "og:title", content: "RALLY · El juego se entiende. Los datos lo demuestran." },
      { property: "og:description", content: "Scouting, estadísticas y análisis táctico de vóley en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: Activity, title: "Scouting en vivo", text: "Registrá cada acción del rally con zonas, subzonas y rotaciones, punto a punto." },
  { icon: BarChart3, title: "Estadísticas de rendimiento", text: "Eficacia por jugadora, rotación y fundamento, con reportes listos para compartir." },
  { icon: Brain, title: "Rally Intelligence", text: "Patrones y tendencias detectados a partir de tus partidos, sin conclusiones inventadas." },
];

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Volleyball className="size-5 text-primary-foreground" />
            </div>
            <span className="font-black tracking-tight text-lg">RALLY</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/ligas" className="hidden sm:inline px-3 py-2 rounded-md text-muted-foreground hover:text-foreground">Ligas</Link>
            <a href="#plataforma" className="hidden sm:inline px-3 py-2 rounded-md text-muted-foreground hover:text-foreground">Plataforma</a>
            <Link to="/auth" className="ml-2 px-3 py-2 rounded-md border border-border/60 hover:bg-secondary/50 font-medium">Ingresar</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden min-h-[88vh] flex items-center">
        <img src={heroImg} alt="Jugador de vóley rematando sobre la red" width={1600} height={1008}
          className="absolute inset-0 size-full object-cover object-[70%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        {/* Trayectoria del balón y líneas de cancha */}
        <svg className="absolute inset-0 size-full pointer-events-none text-primary/40" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden>
          <path d="M-20 760 Q 600 120 1260 140" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 10" />
          <line x1="0" y1="840" x2="1600" y2="840" stroke="currentColor" strokeOpacity="0.4" />
        </svg>

        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-8 pt-24 pb-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-5">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" /> Scouting de vóley
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter leading-[0.95] mb-6">
              El juego se entiende.<br />
              <span className="text-primary">Los datos lo demuestran.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mb-10">
              Scouting, estadísticas y análisis táctico de vóley en tiempo real.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="h-12 px-8 text-base font-bold">
                <Link to="/auth"><LogIn className="mr-2 size-5" />Ingresar a RALLY</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base font-bold bg-background/40 backdrop-blur">
                <a href="#plataforma"><ArrowDown className="mr-2 size-5" />Conocer la plataforma</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="plataforma" className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-8 -mt-10 pb-16 scroll-mt-8">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="group relative rounded-xl border border-border/60 bg-card/70 backdrop-blur p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="size-5" />
                </div>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h2 className="text-lg font-bold mb-1.5">{title}</h2>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto py-6 border-t border-border/40 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} RALLY · Volley Stats
      </footer>
    </div>
  );
}
