import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface PlanInfoData {
  name: string;
  code: string;
  description: string;
  type: string;
  billing: string;
  price: number;
  currency: string;
  status: string;
  color: string;
  icon: string;
  version: string;
}

interface Props {
  data: PlanInfoData;
  onChange: (data: Partial<PlanInfoData>) => void;
  errors?: Record<string, string>;
}

export function PlanInformationStep({ data, onChange, errors }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre del Plan *</Label>
        <Input 
          id="name" 
          value={data.name} 
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Ej: Club Professional"
          className="h-11"
        />
        {errors?.name && <p className="text-xs text-red-500">{errors.name}</p>}
      </div>
      
      <div className="grid gap-2">
        <Label htmlFor="code">Código *</Label>
        <Input 
          id="code" 
          value={data.code} 
          onChange={(e) => onChange({ code: e.target.value })}
          placeholder="Ej: club_pro"
          className="h-11"
        />
        {errors?.code && <p className="text-xs text-red-500">{errors.code}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea 
          id="description" 
          value={data.description} 
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Descripción del plan..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Tipo</Label>
          <Select value={data.type} onValueChange={(v) => onChange({ type: v })}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {["Free", "Coach", "Club", "League", "Federation", "Enterprise", "Custom"].map(t => (
                <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Facturación</Label>
          <Select value={data.billing} onValueChange={(v) => onChange({ billing: v })}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {["Mensual", "Anual", "Único", "Enterprise"].map(t => (
                <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="price">Precio *</Label>
          <Input 
            id="price" 
            type="number"
            value={data.price}
            onChange={(e) => onChange({ price: Number(e.target.value) })}
            className="h-11"
          />
        </div>
        <div className="grid gap-2">
          <Label>Moneda</Label>
          <Select value={data.currency} onValueChange={(v) => onChange({ currency: v })}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent>
              {["ARS", "USD", "EUR", "BRL"].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
