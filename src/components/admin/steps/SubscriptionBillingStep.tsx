import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SubscriptionBillingData {
  frequency: "mensual" | "anual" | "unico";
  currency: string;
  price: number;
}

interface Props {
  data: SubscriptionBillingData;
  onChange: (data: Partial<SubscriptionBillingData>) => void;
}

export function SubscriptionBillingStep({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Frecuencia</Label>
        <Select value={data.frequency} onValueChange={(v: any) => onChange({ frequency: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar frecuencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mensual">Mensual</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
            <SelectItem value="unico">Único</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Moneda</Label>
          <Input value={data.currency} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ currency: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>Precio</Label>
          <Input type="number" value={data.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ price: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}