import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ShieldCheck, Volleyball } from "lucide-react";
import { getPublicPlayer } from "@/lib/player-career.functions";
import { CareerView } from "@/components/player/CareerView";

const POS: Record<string, string> = { punta: "Punta", central: "Central", opuesto: "Opuesto", armador: "Armador", libero: "Líbero", universal: "Universal" };

export const Route = createFileRoute("/player/$alias")({
  loader: async ({ params }) => {
    const p = await getPublicPlayer({ data: { alias: params.alias } }).catch(() => null);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} · RallyStats Player` : "Perfil de jugadora · RallyStats Player";
    const desc = loaderData?.career ? `${loaderData.career.matchesPlayed} partidos · ${loaderData.career.totals.points} puntos. Tu carrera deportiva, partido a partido.` : "Tu carrera deportiva, partido a partido.";
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:type", content: "profile" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-bold">Perfil no disponible</h1>
      <p className="text-sm text-muted-foreground">Este perfil no existe o es privado.</p>
      <Link to="/" className="text-primary text-sm">Ir a RALLY</Link>
    </div>
  ),
  errorComponent: () => <div className="p-6 text-center text-sm">No se pudo cargar el perfil.</div>,
  component: PublicPlayer,
});

function PublicPlayer() {
  const p = Route.useLoaderData();
  const club = p.career?.teams[0];
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-xl px-4 py-6 space-y-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Volleyball className="size-4" /> RallyStats Player</div>
        <section className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
          {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="size-20 rounded-full object-cover" />
            : <div className="size-20 rounded-full bg-secondary flex items-center justify-center text-2xl font-black">{p.name[0]}</div>}
          <div className="min-w-0">
            <h1 className="text-2xl font-black truncate flex items-center gap-1.5">{p.name}{p.career && p.career.matchesPlayed > 0 && <ShieldCheck className="size-5 text-primary" aria-label="Datos verificados" />}</h1>
            <p className="text-sm text-muted-foreground">{[p.number != null ? `#${p.number}` : null, p.position ? POS[p.position] : null, p.heightCm ? `${p.heightCm} cm` : null].filter(Boolean).join(" · ")}</p>
            {club && <p className="text-sm">{club.club ?? club.teamName}</p>}
          </div>
        </section>
        {p.bio && <p className="text-sm">{p.bio}</p>}
        {p.career ? <CareerView career={p.career} compact /> : <p className="text-sm text-muted-foreground">Esta jugadora eligió no mostrar sus estadísticas.</p>}
      </main>
    </div>
  );
}
