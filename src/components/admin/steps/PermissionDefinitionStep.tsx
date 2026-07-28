import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PermissionDefinitionData {
  key: string;
  category: string;
  description: string;
}

interface PermissionDefinitionStepProps {
  data: PermissionDefinitionData;
  onChange: (data: Partial<PermissionDefinitionData>) => void;
  errors?: Record<string, string>;
}

const CATEGORIES = [
  { id: "core", name: "RALLY Core" },
  { id: "match", name: "Match Engine" },
  { id: "scout", name: "Scout Engine" },
  { id: "video", name: "Video Engine" },
  { id: "admin", name: "Administration" },
  { id: "billing", name: "Billing & Plans" }
];

export function PermissionDefinitionStep({ data, onChange, errors = {} }: PermissionDefinitionStepProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <Label htmlFor="perm-key" className="text-sm font-bold flex items-center gap-1">
          Key del Permiso <span className="text-destructive">*</span>
        </Label>
        <Input 
          id="perm-key"
          placeholder="Ej. match.create, user.edit"
          value={data.key}
          onChange={(e) => onChange({ key: e.target.value })}
          className={cn("h-11 font-mono text-xs", errors.key && "border-destructive focus-visible:ring-destructive")}
        />
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
          Identificador único interno para el motor de permisos.
        </p>
        {errors.key && <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.key}</p>}
      </div>

      <div className="grid gap-2">
        <Label className="text-sm font-bold flex items-center gap-1">
          Categoría <span className="text-destructive">*</span>
        </Label>
        <Select 
          value={data.category} 
          onValueChange={(val) => onChange({ category: val })}
        >
          <SelectTrigger className={cn("h-11", errors.category && "border-destructive")}>
            <SelectValue placeholder="Seleccionar categoría..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.category}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="perm-desc" className="text-sm font-bold">
          Descripción Funcional
        </Label>
        <Input 
          id="perm-desc"
          placeholder="Ej. Permite crear nuevos partidos en el sistema"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="h-11"
        />
      </div>
    </div>
  );
}
