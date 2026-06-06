import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { useVolley } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";

export const Route = createFileRoute("/teams")({
  head: () => ({ meta: [{ title: "Equipos · RALLY" }] }),
  component: TeamsPage,
});

const COLORS = ["#ff7a3d", "#3ec1d3", "#ffd23f", "#9b5de5", "#43d27a", "#ff5d8f", "#5d9cec", "#f48c06"];

function TeamsPage() {
  const teams = useVolley((s) => s.teams);
  const addTeam = useVolley((s) => s.addTeam);
  const removeTeam = useVolley((s) => s.removeTeam);
  const addPlayer = useVolley((s) => s.addPlayer);
  const removePlayer = useVolley((s) => s.removePlayer);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pNum, setPNum] = useState<number | "">("");

  const activeTeam = teams.find((t) => t.id === selected) ?? teams[0];

  return (
    <AppShell>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold">Equipos</h1>
          <p className="text-muted-foreground text-sm">Cargá equipos y plantilla antes del partido.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="rounded-2xl bg-card border border-border/60 p-5">
          <h2 className="font-bold flex items-center gap-2 mb-4"><Users className="size-4" /> Equipos</h2>
          <ul className="space-y-1.5 mb-5">
            {teams.map((t) => {
              const isActive = activeTeam?.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? "bg-secondary" : "hover:bg-secondary/50"}`}
                  >
                    <TeamBadge team={t} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.players.length} jugadores</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nuevo equipo</p>
            <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Abreviatura (3 letras)" maxLength={4} value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase())} />
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-6 rounded-md ring-offset-2 ring-offset-card transition-all ${color === c ? "ring-2 ring-foreground scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!name || !shortName}
              onClick={() => {
                const id = addTeam({ name, shortName, color });
                setName(""); setShortName(""); setSelected(id);
              }}
            >
              <Plus className="size-4" /> Crear equipo
            </Button>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-2xl bg-card border border-border/60 p-5">
          {activeTeam ? (
            <>
              <div className="flex items-center gap-4 mb-5">
                <TeamBadge team={activeTeam} size="lg" />
                <div className="flex-1">
                  <h2 className="font-bold text-xl">{activeTeam.name}</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{activeTeam.shortName} · {activeTeam.players.length} jugadores</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { if (confirm(`¿Eliminar ${activeTeam.name}?`)) { removeTeam(activeTeam.id); setSelected(null); } }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              <div className="grid sm:grid-cols-[1fr_120px_auto] gap-2 mb-4">
                <Input placeholder="Nombre del jugador" value={pName} onChange={(e) => setPName(e.target.value)} />
                <Input type="number" placeholder="#" value={pNum} onChange={(e) => setPNum(e.target.value ? parseInt(e.target.value) : "")} />
                <Button
                  disabled={!pName || !pNum}
                  onClick={() => { addPlayer(activeTeam.id, { name: pName, number: Number(pNum) }); setPName(""); setPNum(""); }}
                >
                  <UserPlus className="size-4" /> Agregar
                </Button>
              </div>

              <ul className="grid sm:grid-cols-2 gap-2">
                {activeTeam.players.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2">
                    <div className="size-9 rounded-md bg-background border border-border flex items-center justify-center font-bold scoreboard-digit text-primary">{p.number}</div>
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <button onClick={() => removePlayer(activeTeam.id, p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
                {activeTeam.players.length === 0 && (
                  <li className="col-span-full text-center py-10 text-sm text-muted-foreground">Sin jugadores cargados.</li>
                )}
              </ul>
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">Creá un equipo para empezar.</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
