import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type Team,
  type Player,
  type SettingQuality,
  type SettingAttackZone,
  type SettingAttackResult,
  SETTING_QUALITIES,
  SETTING_QUALITY_LABEL,
  SETTING_ATTACK_ZONES,
  SETTING_ATTACK_ZONE_LABEL,
  SETTING_ATTACK_RESULT_LABEL,
} from "@/lib/volley-store";
import { ArrowLeft, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  teamA: Team;
  teamB: Team;
  onCourtA: string[];
  onCourtB: string[];
  onSubmit: (payload: {
    side: "A" | "B";
    setterId: string;
    quality: SettingQuality;
    attackerId: string;
    attackZone: SettingAttackZone;
    attackResult: SettingAttackResult;
    receptionQuality?: SettingQuality;
  }) => void;
}

type Step = "side" | "reception" | "setter" | "zone" | "quality" | "attacker" | "result";

const RESULTS: SettingAttackResult[] = ["point", "continuity", "error", "blocked"];

export function SettingDialog({ open, onClose, teamA, teamB, onCourtA, onCourtB, onSubmit }: Props) {
  const [step, setStep] = useState<Step>("side");
  const [side, setSide] = useState<"A" | "B" | null>(null);
  const [receptionQuality, setReceptionQuality] = useState<SettingQuality | undefined>(undefined);
  const [setterId, setSetterId] = useState<string | null>(null);
  const [quality, setQuality] = useState<SettingQuality | null>(null);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [attackZone, setAttackZone] = useState<SettingAttackZone | null>(null);

  const reset = () => {
    setStep("side");
    setSide(null);
    setReceptionQuality(undefined);
    setSetterId(null);
    setQuality(null);
    setAttackerId(null);
    setAttackZone(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const team = side === "A" ? teamA : side === "B" ? teamB : null;
  const onCourt = side === "A" ? onCourtA : side === "B" ? onCourtB : [];
  const players: Player[] = team
    ? onCourt
        .map((id) => team.players.find((p) => p.id === id))
        .filter((p): p is Player => !!p)
    : [];

  const goBack = () => {
    const order: Step[] = ["side", "reception", "setter", "zone", "quality", "attacker", "result"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const submitResult = (result: SettingAttackResult) => {
    if (!side || !setterId || !quality || !attackerId || !attackZone) return;
    onSubmit({
      side,
      setterId,
      quality,
      attackerId,
      attackZone,
      attackResult: result,
      receptionQuality,
    });
    handleClose();
  };

  const title = (() => {
    switch (step) {
      case "side": return "Equipo que armó";
      case "reception": return "Calidad de la recepción";
      case "setter": return "Jugadora que armó";
      case "zone": return "Zona del armado";
      case "quality": return "Calidad del armado";
      case "attacker": return "Jugadora que atacó";
      case "result": return "Resultado del ataque";
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "side" && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Atrás"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <span>Registrar armado · {title}</span>
          </DialogTitle>
        </DialogHeader>

        {step === "side" && (
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as const).map((s) => {
              const t = s === "A" ? teamA : teamB;
              return (
                <Button
                  key={s}
                  variant="outline"
                  className="h-16 flex flex-col gap-1"
                  onClick={() => {
                    setSide(s);
                    setStep("reception");
                  }}
                >
                  <span className="size-3 rounded-full" style={{ background: t.color }} />
                  <span className="font-bold">{t.shortName}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">{t.name}</span>
                </Button>
              );
            })}
          </div>
        )}

        {step === "reception" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Opcional — saltá si no la registraste.</p>
            <QualityRow
              onPick={(q) => {
                setReceptionQuality(q);
                setStep("setter");
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setReceptionQuality(undefined);
                setStep("setter");
              }}
            >
              Saltar
            </Button>
          </div>
        )}

        {step === "setter" && (
          <PlayerGrid
            players={players}
            onPick={(id) => {
              setSetterId(id);
              setStep("quality");
            }}
          />
        )}

        {step === "quality" && (
          <QualityRow
            onPick={(q) => {
              setQuality(q);
              setStep("attacker");
            }}
          />
        )}

        {step === "attacker" && (
          <PlayerGrid
            players={players}
            highlightId={setterId}
            onPick={(id) => {
              setAttackerId(id);
              setStep("zone");
            }}
          />
        )}

        {step === "zone" && (
          <div className="grid grid-cols-3 gap-2">
            {SETTING_ATTACK_ZONES.map((z) => (
              <Button
                key={z}
                variant="outline"
                className="h-14 font-semibold"
                onClick={() => {
                  setAttackZone(z);
                  setStep("result");
                }}
              >
                {SETTING_ATTACK_ZONE_LABEL[z]}
              </Button>
            ))}
          </div>
        )}

        {step === "result" && (
          <div className="grid grid-cols-2 gap-2">
            {RESULTS.map((r) => (
              <Button
                key={r}
                className={`h-14 font-semibold ${r === "point" ? "bg-success text-success-foreground hover:bg-success/90" : r === "error" || r === "blocked" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
                variant={r === "continuity" ? "outline" : "default"}
                onClick={() => submitResult(r)}
              >
                <Check className="size-4" />
                {SETTING_ATTACK_RESULT_LABEL[r]}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function QualityRow({ onPick }: { onPick: (q: SettingQuality) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {SETTING_QUALITIES.map((q) => (
        <Button
          key={q}
          variant="outline"
          className="h-16 flex flex-col gap-0.5"
          onClick={() => onPick(q)}
        >
          <span className="text-xl font-black scoreboard-digit leading-none">{q}</span>
          <span className="text-[9px] text-muted-foreground leading-tight">{SETTING_QUALITY_LABEL[q]}</span>
        </Button>
      ))}
    </div>
  );
}

function PlayerGrid({
  players,
  onPick,
  highlightId,
}: {
  players: Player[];
  onPick: (id: string) => void;
  highlightId?: string | null;
}) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No hay jugadoras en cancha.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {players.map((p) => (
        <Button
          key={p.id}
          variant="outline"
          className={`h-16 flex flex-col gap-0.5 ${highlightId === p.id ? "ring-2 ring-primary/60" : ""}`}
          onClick={() => onPick(p.id)}
        >
          <span className="scoreboard-digit text-lg font-black leading-none">#{p.number}</span>
          <span className="text-[10px] text-muted-foreground truncate max-w-full">{p.name}</span>
        </Button>
      ))}
    </div>
  );
}
