import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface SubscriptionInfoData {
  orgId: string;
  planId: string;
}

interface Props {
  data: SubscriptionInfoData;
  onChange: (data: Partial<SubscriptionInfoData>) => void;
}

export function SubscriptionInfoStep({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Organización *</Label>
        <Input value={data.orgId} onChange={(e) => onChange({ orgId: e.target.value })} placeholder="Seleccionar Org..." />
      </div>
      <div className="grid gap-2">
        <Label>Plan *</Label>
        <Input value={data.planId} onChange={(e) => onChange({ planId: e.target.value })} placeholder="Seleccionar Plan..." />
      </div>
    </div>
  );
}