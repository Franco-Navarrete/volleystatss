import React, { useState } from "react";
import { 
  Shield, 
  Search,
  Check,
  ChevronDown,
  Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Mock data for Selects
const WORKSPACES = [
  { id: "ws-1", name: "RALLY Global" },
  { id: "ws-2", name: "Argentina Vóley" },
  { id: "ws-3", name: "Brasil Volei" }
];

const ORGANIZATIONS = {
  "ws-1": [
    { id: "org-1", name: "Federación Internacional (FIVB)" },
    { id: "org-2", name: "Confederación Sudamericana" }
  ],
  "ws-2": [
    { id: "org-3", name: "FEVA (Federación Argentina)" },
    { id: "org-4", name: "ACLAV (Liga Argentina)" }
  ],
  "ws-3": [
    { id: "org-5", name: "CBV (Confederação Brasileira)" }
  ]
};

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#6366f1", "#14b8a6", "#f97316"
];

const ICONS = ["Shield", "User", "Star", "Flame", "Zap", "Lock", "Award", "Target"];

export interface RoleInfoData {
  name: string;
  description: string;
  workspaceId: string;
  organizationId: string;
  color: string;
  icon: string;
  status: "active" | "inactive";
  type: "system" | "custom";
}

interface RoleInfoStepProps {
  data: RoleInfoData;
  onChange: (data: Partial<RoleInfoData>) => void;
  errors?: Record<string, string>;
}

export function RoleInfoStep({ data, onChange, errors = {} }: RoleInfoStepProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredWorkspaces = WORKSPACES.filter(ws => 
    ws.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableOrgs = data.workspaceId ? (ORGANIZATIONS[data.workspaceId as keyof typeof ORGANIZATIONS] || []) : [];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Nombre del Rol */}
        <div className="grid gap-2">
          <Label htmlFor="role-name" className="text-sm font-bold flex items-center gap-1">
            Nombre del rol <span className="text-destructive">*</span>
          </Label>
          <Input 
            id="role-name"
            placeholder="Ej. Entrenador Principal"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={cn("h-11", errors.name && "border-destructive focus-visible:ring-destructive")}
          />
          {errors.name && <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.name}</p>}
        </div>

        {/* Descripción */}
        <div className="grid gap-2">
          <Label htmlFor="role-description" className="text-sm font-bold">
            Descripción
          </Label>
          <Textarea 
            id="role-description"
            placeholder="Describe las responsabilidades de este rol..."
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="min-h-[100px] resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Workspace */}
          <div className="grid gap-2">
            <Label className="text-sm font-bold flex items-center gap-1">
              Workspace <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={data.workspaceId} 
              onValueChange={(val) => onChange({ workspaceId: val, organizationId: "" })}
            >
              <SelectTrigger className={cn("h-11", errors.workspaceId && "border-destructive")}>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-2 border-b border-border/40 mb-1 flex items-center gap-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input 
                    className="flex-1 bg-transparent border-none text-xs focus:ring-0 p-0 placeholder:text-muted-foreground/60"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {filteredWorkspaces.map(ws => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.workspaceId && <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.workspaceId}</p>}
          </div>

          {/* Organización */}
          <div className="grid gap-2">
            <Label className="text-sm font-bold flex items-center gap-1">
              Organización <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={data.organizationId} 
              onValueChange={(val) => onChange({ organizationId: val })}
              disabled={!data.workspaceId}
            >
              <SelectTrigger className={cn("h-11", errors.organizationId && "border-destructive")}>
                <SelectValue placeholder={data.workspaceId ? "Seleccionar..." : "Primero elige Workspace"} />
              </SelectTrigger>
              <SelectContent>
                {availableOrgs.map(org => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.organizationId && <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">{errors.organizationId}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Color Picker */}
          <div className="grid gap-2">
            <Label className="text-sm font-bold">Color</Label>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border/60 bg-muted/5">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => onChange({ color })}
                  className={cn(
                    "size-6 rounded-full transition-all border-2",
                    data.color === color ? "border-foreground scale-110 shadow-sm" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Icon Selector */}
          <div className="grid gap-2">
            <Label className="text-sm font-bold">Icono</Label>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border/60 bg-muted/5">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => onChange({ icon })}
                  className={cn(
                    "size-8 rounded-lg flex items-center justify-center transition-all border",
                    data.icon === icon 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-background border-border/60 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <Shield className="size-4" /> {/* Simplificado por ahora */}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Separator className="opacity-40" />

        <div className="grid grid-cols-2 gap-6">
          {/* Estado */}
          <div className="space-y-3">
            <Label className="text-sm font-bold">Estado</Label>
            <div className="flex gap-2">
              <Button 
                variant={data.status === "active" ? "default" : "outline"}
                className={cn("flex-1 font-bold h-10 rounded-xl", data.status === "active" && "bg-green-600 hover:bg-green-700")}
                onClick={() => onChange({ status: "active" })}
              >
                Activo
              </Button>
              <Button 
                variant={data.status === "inactive" ? "default" : "outline"}
                className={cn("flex-1 font-bold h-10 rounded-xl", data.status === "inactive" && "bg-destructive hover:bg-destructive/90")}
                onClick={() => onChange({ status: "inactive" })}
              >
                Inactivo
              </Button>
            </div>
          </div>

          {/* Tipo */}
          <div className="space-y-3">
            <Label className="text-sm font-bold">Tipo</Label>
            <div className="flex gap-2">
              <Button 
                variant={data.type === "system" ? "default" : "outline"}
                className="flex-1 font-bold h-10 rounded-xl text-xs"
                onClick={() => onChange({ type: "system" })}
              >
                Sistema
              </Button>
              <Button 
                variant={data.type === "custom" ? "default" : "outline"}
                className="flex-1 font-bold h-10 rounded-xl text-xs"
                onClick={() => onChange({ type: "custom" })}
              >
                Personalizado
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
