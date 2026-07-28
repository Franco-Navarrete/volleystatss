import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface ModuleConfigData {
  route: string;
  order: number;
  visible: boolean;
  requiresLicense: boolean;
}

interface Props {
  data: ModuleConfigData;
  onChange: (data: Partial<ModuleConfigData>) => void;
}

export function ModuleConfigStep({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Ruta</Label>
        <Input value={data.route} onChange={(e) => onChange({ route: e.target.value })} placeholder="/modules/..." />
      </div>
      <div className="flex items-center justify-between">
        <Label>Visible en menú</Label>
        <Switch checked={data.visible} onCheckedChange={(v) => onChange({ visible: v })} />
      </div>
    </div>
  );
}