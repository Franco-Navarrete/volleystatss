import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Loader2, Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCloudTeams, useTeamMutations, type CloudTeam } from "@/hooks/use-cloud-teams";
import { TeamRegistrationLinkDialog } from "@/components/TeamRegistrationLinkDialog";
import { CategoryManageDialog, useCategoryMembers } from "@/components/CategoryManageDialog";

export const Route = createFileRoute("/_authenticated/my-club")({
  head: () => ({
    meta: [
      { title: "Mi Club · RALLY" },
      { name: "description", content: "Administrá las categorías, invitaciones y jugadoras de tu club." },
      { property: "og:title", content: "Mi Club · RALLY" },
      { property: "og:description", content: "Categorías, invitaciones y jugadoras de tu club." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyClubPage,
});

const GENDER: Record<string, string> = { F: "Femenino", M: "Masculino", X: "Mixto" };
const CATS = [["12", "Sub 12"], ["14", "Sub 14"], ["16", "Sub 16"], ["18", "Sub 18"], ["21", "Sub 21"], ["primera", "Primera"], ["libre", "Libre"]] as const;

function MyClubPage() {
  const teams = useCloudTeams();
  const mine = (teams.data ?? []).filter((t) => t.canManage);
  const clubName = mine.find((t) => t.clubName)?.clubName ?? mine[0]?.club ?? "Mi club";
  const [creating, setCreating] = useState(false);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2"><Building2 className="size-7 text-primary" />{clubName}</h1>
            <p className="text-muted-foreground text-sm mt-1">Mis categorías</p>
          </div>
          <Button onClick={() => setCreating(true)}><Plus className="size-4" /> Nueva categoría</Button>
        </div>
        {teams.isLoading ? <Loader2 className="size-6 animate-spin" /> : mine.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">Todavía no tenés categorías. Creá la primera.</CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((t) => <CategoryCard key={t.id} team={t} />)}
          </div>
        )}
      </div>
      <NewCategoryDialog open={creating} onOpenChange={setCreating} clubName={clubName} />
    </AppShell>
  );
}

function CategoryCard({ team }: { team: CloudTeam }) {
  const [manage, setManage] = useState(false);
  const [invite, setInvite] = useState(false);
  const members = useCategoryMembers(team.id);
  const pending = (members.data ?? []).filter((m) => m.status === "pending").length;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold leading-tight">{team.name}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Users className="size-3.5" /> {team.players.length} jugadoras</p>
          </div>
          {pending > 0 && <Badge className="bg-primary text-primary-foreground">{pending} {pending === 1 ? "solicitud" : "solicitudes"}</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => setManage(true)}>Administrar</Button>
          <Button size="sm" onClick={() => setInvite(true)}><UserPlus className="size-4" /> Invitar</Button>
        </div>
      </CardContent>
      <CategoryManageDialog teamId={team.id} teamName={team.name} players={team.players} open={manage} onOpenChange={setManage} />
      <TeamRegistrationLinkDialog teamId={team.id} teamName={team.name} open={invite} onOpenChange={setInvite} />
    </Card>
  );
}

function NewCategoryDialog({ open, onOpenChange, clubName }: { open: boolean; onOpenChange: (o: boolean) => void; clubName: string }) {
  const { createTeam } = useTeamMutations();
  const [cat, setCat] = useState<(typeof CATS)[number][0]>("16");
  const [gender, setGender] = useState<"F" | "M" | "X">("F");
  const label = CATS.find((c) => c[0] === cat)![1];
  const name = `${label} ${GENDER[gender]}`;
  const submit = async () => {
    try {
      await createTeam.mutateAsync({ name, shortName: label.replace(/\s/g, "").slice(0, 8).toUpperCase(), color: "#2563eb", category: cat, gender });
      toast.success(`Categoría ${name} creada`);
      onOpenChange(false);
    } catch (e) { toast.error((e as Error).message || "No se pudo crear la categoría."); }
  };
  const sel = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nombre</Label>
            <select className={sel} value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="space-y-1"><Label>Género</Label>
            <select className={sel} value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>{Object.entries(GENDER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="space-y-1"><Label>Club</Label><Input value={clubName} disabled /></div>
          <p className="text-sm text-muted-foreground">Se creará: <b>{name}</b></p>
        </div>
        <DialogFooter><Button onClick={submit} disabled={createTeam.isPending}>{createTeam.isPending && <Loader2 className="size-4 animate-spin" />} Crear</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
