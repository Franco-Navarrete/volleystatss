import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Save, Shield } from "lucide-react";
import { useClubMutations, useMyClub } from "@/hooks/use-my-club";
import { TEAM_COLORS_HEX } from "@/lib/team-colors";

type Props = { open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void };

export function MyClubDialog({ open, onOpenChange, onCreated }: Props) {
  const clubQ = useMyClub();
  const club = clubQ.data ?? null;
  const isEdit = !!club;
  const mut = useClubMutations();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [country, setCountry] = useState("Argentina");
  const [primary, setPrimary] = useState(TEAM_COLORS_HEX[0]);
  const [secondary, setSecondary] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setName(club?.name ?? "");
    setCity(club?.city ?? "");
    setProvince(club?.province ?? "");
    setCountry(club?.country ?? "Argentina");
    setPrimary(club?.primaryColor ?? TEAM_COLORS_HEX[0]);
    setSecondary(club?.secondaryColor ?? "");
  }, [open, club]);

  const busy = mut.createClub.isPending || mut.updateClub.isPending;
  const err = (mut.createClub.error || mut.updateClub.error) as Error | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5" /> {isEdit ? "Mi Club" : "Crear tu club"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!isEdit && (
            <p className="text-xs text-muted-foreground">
              Antes de crear equipos necesitás asociarlos a un club. Un entrenador administra un solo club.
            </p>
          )}
          <Input placeholder="Nombre del club" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value.slice(0, 80))} />
            <Input placeholder="Provincia" value={province} onChange={(e) => setProvince(e.target.value.slice(0, 80))} />
          </div>
          <Input placeholder="País" value={country} onChange={(e) => setCountry(e.target.value.slice(0, 80))} />

          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Color principal
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEAM_COLORS_HEX.map((c) => (
                <button
                  key={c}
                  onClick={() => setPrimary(c)}
                  className={`size-7 rounded-md ring-offset-2 ring-offset-card transition-all ${
                    primary === c ? "ring-2 ring-foreground scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Color secundario (opcional)
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSecondary("")}
                className={`size-7 rounded-md border border-border/60 flex items-center justify-center text-[10px] ${
                  secondary === "" ? "ring-2 ring-foreground scale-110" : ""
                }`}
              >
                —
              </button>
              {TEAM_COLORS_HEX.map((c) => (
                <button
                  key={c}
                  onClick={() => setSecondary(c)}
                  className={`size-7 rounded-md ring-offset-2 ring-offset-card transition-all ${
                    secondary === c ? "ring-2 ring-foreground scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {err && (
            <div className="rounded-md bg-destructive/10 text-destructive text-xs p-2">{err.message}</div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim() || busy}
            onClick={async () => {
              try {
                if (isEdit && club) {
                  await mut.updateClub.mutateAsync({
                    id: club.id,
                    name: name.trim(),
                    city: city.trim() || null,
                    province: province.trim() || null,
                    country: country.trim() || null,
                    primaryColor: primary || null,
                    secondaryColor: secondary || null,
                  });
                } else {
                  await mut.createClub.mutateAsync({
                    name: name.trim(),
                    city: city.trim() || null,
                    province: province.trim() || null,
                    country: country.trim() || null,
                    primaryColor: primary || null,
                    secondaryColor: secondary || null,
                  });
                  onCreated?.();
                }
                onOpenChange(false);
              } catch {
                /* err shown */
              }
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : isEdit ? <Save className="size-4" /> : <Plus className="size-4" />}{" "}
            {isEdit ? "Guardar" : "Crear club"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
