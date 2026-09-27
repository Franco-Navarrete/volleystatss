import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ShieldCheck, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPublicRegistrationTeam, submitPublicPlayerRegistration } from "@/lib/player-registration.functions";
import { PLAYER_POSITIONS, PLAYER_POSITION_LABEL, type PlayerPosition } from "@/lib/volley-store";

export const Route = createFileRoute("/registro-jugador/$token")({
  loader: ({ params }) => getPublicRegistrationTeam({ data: { token: params.token } }).catch(() => null),
  head: ({ loaderData }) => {
    const title = loaderData ? `Inscripción · ${loaderData.name} · RALLY` : "Inscripción de jugador · RALLY";
    const description = loaderData
      ? `Formulario de inscripción al plantel de ${loaderData.name}.`
      : "Formulario seguro de inscripción de jugadores de vóley.";
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  component: PlayerRegistrationPage,
});

function PlayerRegistrationPage() {
  const team = Route.useLoaderData();
  const { token } = Route.useParams();
  const submit = useServerFn(submitPublicPlayerRegistration);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState<PlayerPosition | "">("");
  const [birthDate, setBirthDate] = useState("");
  const mutation = useMutation({ mutationFn: () => submit({ data: {
    token, name, number: Number(number), position, birthDate,
  } }) });

  if (!team) return (
    <main className="min-h-screen bg-background px-4 py-16 flex items-start justify-center">
      <section className="w-full max-w-md border border-border bg-card rounded-lg p-6 text-center">
        <Volleyball className="size-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold">Enlace no disponible</h1>
        <p className="text-sm text-muted-foreground mt-2">Pedile al profesor un nuevo enlace de inscripción.</p>
      </section>
    </main>
  );

  if (mutation.isSuccess) return (
    <main className="min-h-screen bg-background px-4 py-16 flex items-start justify-center">
      <section className="w-full max-w-md border border-success/40 bg-card rounded-lg p-7 text-center">
        <CheckCircle2 className="size-12 text-success mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Inscripción completada</h1>
        <p className="text-sm text-muted-foreground mt-2">Ya formás parte del plantel de {team.name}.</p>
      </section>
    </main>
  );

  const ready = name.trim().length >= 2 && number !== "" && !!position && !!birthDate;
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-lg">
        <header className="mb-6 flex items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-card flex items-center justify-center">
            {team.logoUrl ? <img src={team.logoUrl} alt={`Logo de ${team.name}`} className="size-full object-cover" /> : <Volleyball className="size-8 text-primary" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase text-muted-foreground">{team.clubName ?? "RALLY"}</p>
            <h1 className="text-2xl font-bold leading-tight">{team.name}</h1>
            <p className="text-sm text-muted-foreground">Inscripción al plantel</p>
          </div>
        </header>

        <form className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="player-name">Nombre y apellido</Label><Input id="player-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="player-number">Número de camiseta</Label><Input id="player-number" type="number" inputMode="numeric" min={0} max={99} value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="player-position">Posición</Label><select id="player-position" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={position} onChange={(e) => setPosition(e.target.value as PlayerPosition)} required><option value="">Seleccionar</option>{PLAYER_POSITIONS.map((item) => <option key={item} value={item}>{PLAYER_POSITION_LABEL[item]}</option>)}</select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="birth-date">Fecha de nacimiento</Label><Input id="birth-date" type="date" max={new Date().toISOString().slice(0, 10)} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required /></div>
          {mutation.error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{mutation.error.message}</p> : null}
          <Button type="submit" className="w-full" disabled={!ready || mutation.isPending}>{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Volleyball className="size-4" />} Inscribirme</Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Tus datos se envían únicamente al equipo.</p>
        </form>
      </section>
    </main>
  );
}