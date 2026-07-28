import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ModuleInfoData {
  name: string;
  code: string;
  description: string;
  category: string;
}

interface Props {
  data: ModuleInfoData;
  onChange: (data: Partial<ModuleInfoData>) => void;
}

export function ModuleInfoStep({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Nombre del Módulo *</Label>
        <Input 
          value={data.name} 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ name: e.target.value })} 
          placeholder="Ej: Scouting Avanzado" 
        />
      </div>
      <div className="grid gap-2">
        <Label>Código *</Label>
        <Input 
          value={data.code} 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ code: e.target.value })} 
          placeholder="Ej: mod_scout" 
        />
      </div>
      <div className="grid gap-2">
        <Label>Descripción</Label>
        <Textarea 
          value={data.description} 
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ description: e.target.value })} 
          placeholder="Descripción..." 
        />
      </div>
    </div>
  );
}