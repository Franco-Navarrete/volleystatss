import React from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Trophy, Radio, Target, Search } from "lucide-react";

export const SYSTEM_ROLES = [
  {
    id: "scorekeeper",
    name: "Planillero",
    description: "Registro de partidos, estadísticas en vivo y scouting restringido.",
    color: "bg-blue-500",
    icon: Target,
    permissions: ["match.view", "match.live", "match.scoreboard", "scout.live"]
  },
  {
    id: "analyst",
    name: "Analista",
    description: "Análisis de video profundo y exportación de reportes avanzados.",
    color: "bg-purple-500",
    icon: Search,
    permissions: ["video.analyze", "report.export", "match.view"]
  },
  {
    id: "coach",
    name: "Entrenador",
    description: "Gestión técnica de equipos, jugadores y entrenamientos.",
    color: "bg-green-500",
    icon: Users,
    permissions: ["team.manage", "player.edit", "match.view"]
  },
  {
    id: "admin",
    name: "Administrador",
    description: "Gestión total de la organización y sus miembros.",
    color: "bg-red-500",
    icon: Shield,
    permissions: ["*"]
  }
];

export function ChangeRoleStep({ currentRole, onSelect, selectedRoleId }: any) {
  return (
    <div className="grid gap-4">
      {SYSTEM_ROLES.map((role) => (
        <div 
          key={role.id}
          className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
            selectedRoleId === role.id 
              ? "border-primary bg-primary/5 shadow-sm" 
              : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
          }`}
          onClick={() => onSelect(role.id)}
        >
          <div className={`size-10 rounded-lg flex items-center justify-center text-white ${role.color}`}>
            <role.icon className="size-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold">{role.name}</span>
              {currentRole === role.id && (
                <Badge variant="outline" className="text-[9px] uppercase font-black">Actual</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {role.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
