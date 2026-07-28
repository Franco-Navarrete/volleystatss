import React from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlanInfoData } from "./PlanInformationStep";
import { PlanFeaturesData } from "./PlanFeaturesStep";

interface Props {
  data: PlanInfoData & PlanFeaturesData;
}

export function PlanSummaryStep({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Plan</Label>
          <div className="font-bold text-lg">{data.name} ({data.code})</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Precio</Label>
          <div className="font-bold text-xl text-primary">{data.price} {data.currency} / {data.billing}</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Módulos</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.modules.length > 0 ? data.modules.map(m => (
              <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
            )) : <span className="text-xs text-muted-foreground italic">Sin módulos seleccionados</span>}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Características</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.features.length > 0 ? data.features.map(f => (
              <Badge key={f} variant="outline" className="text-[10px] border-primary/20 text-primary">{f}</Badge>
            )) : <span className="text-xs text-muted-foreground italic">Sin características adicionales</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
