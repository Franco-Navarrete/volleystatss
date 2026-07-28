import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export interface PlanFeaturesData {
  modules: string[];
  limits: Record<string, number>;
  features: string[];
}

interface Props {
  data: PlanFeaturesData;
  onChange: (data: Partial<PlanFeaturesData>) => void;
}

const MODULES = ["Live", "Scout", "Video", "Analytics", "Training", "Coach", "AI", "Marketplace", "API"];
const FEATURES = ["White Label", "Custom Domain", "Backups", "MFA", "SSO", "Integraciones API", "Soporte Premium"];

export function PlanFeaturesStep({ data, onChange }: Props) {
  const toggleModule = (mod: string) => {
    const current = data.modules || [];
    const next = current.includes(mod) 
      ? current.filter(m => m !== mod)
      : [...current, mod];
    onChange({ modules: next });
  };

  const toggleFeature = (feat: string) => {
    const current = data.features || [];
    const next = current.includes(feat) 
      ? current.filter(f => f !== feat)
      : [...current, feat];
    onChange({ features: next });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Módulos Habilitados</Label>
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map(mod => (
            <div key={mod} className="flex items-center space-x-2 p-2 rounded-lg border border-border/40 bg-muted/5">
              <Checkbox 
                id={`mod-${mod}`} 
                checked={data.modules.includes(mod)}
                onCheckedChange={() => toggleModule(mod)}
              />
              <Label htmlFor={`mod-${mod}`} className="text-sm cursor-pointer">{mod}</Label>
            </div>
          ))}
        </div>
      </div>

      <Separator className="opacity-40" />

      <div className="space-y-4">
        <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Límites de Uso</Label>
        <div className="grid grid-cols-2 gap-4">
          {["Usuarios", "Clubes", "Equipos", "Jugadores", "Partidos"].map(limit => (
            <div key={limit} className="grid gap-2">
              <Label className="text-xs">{limit}</Label>
              <input 
                type="number"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={data.limits[limit] || 0}
                onChange={(e) => onChange({ limits: { ...data.limits, [limit]: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator className="opacity-40" />

      <div className="space-y-4">
        <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Características Pro</Label>
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map(feat => (
            <div key={feat} className="flex items-center space-x-2 p-2 rounded-lg border border-border/40 bg-muted/5">
              <Checkbox 
                id={`feat-${feat}`}
                checked={data.features.includes(feat)}
                onCheckedChange={() => toggleFeature(feat)}
              />
              <Label htmlFor={`feat-${feat}`} className="text-sm cursor-pointer">{feat}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
