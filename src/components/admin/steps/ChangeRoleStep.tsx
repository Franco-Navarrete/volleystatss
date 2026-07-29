import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Users, 
  Target, 
  Search, 
  Video, 
  Hammer, 
  Activity,
  CheckCircle2,
  XCircle,
  ChevronRight
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

export const SYSTEM_ROLES = [
  {
    id: "admin",
    name: "Administrador",
    description: "Gestión total de la organización, configuración del sistema y control de acceso global.",
    color: "bg-red-500",
    icon: Shield,
    included: ["sys.*", "org.*", "user.*", "match.*", "scout.*", "video.*"],
    restricted: [],
    count: 156,
    status: "Enterprise"
  },
  {
    id: "scorekeeper",
    name: "Planillero",
    description: "Registro de partidos en tiempo real, gestión de marcador y estadísticas básicas de juego.",
    color: "bg-blue-500",
    icon: Target,
    included: ["match.live", "match.scoreboard", "match.view"],
    restricted: ["scout.analyze", "video.delete", "org.manage"],
    count: 12,
    status: "Standard"
  },
  {
    id: "coach",
    name: "Entrenador",
    description: "Gestión técnica de equipos, planificación de entrenamientos y análisis de rendimiento de jugadores.",
    color: "bg-green-500",
    icon: Users,
    included: ["team.manage", "player.edit", "training.plan", "match.view"],
    restricted: ["sys.config", "billing.manage"],
    count: 24,
    status: "Standard"
  },
  {
    id: "scout",
    name: "Scout",
    description: "Toma de datos técnica avanzada durante el partido y análisis estadístico post-partido.",
    color: "bg-orange-500",
    icon: Activity,
    included: ["scout.live", "scout.analyze", "video.view", "match.view"],
    restricted: ["team.delete", "user.create"],
    count: 38,
    status: "Professional"
  },
  {
    id: "analyst",
    name: "Analista",
    description: "Análisis de video profundo, creación de playlists tácticas y exportación de informes detallados.",
    color: "bg-purple-500",
    icon: Search,
    included: ["video.analyze", "video.playlist", "report.export", "match.view"],
    restricted: ["match.live", "sys.admin"],
    count: 45,
    status: "Professional"
  },
  {
    id: "referee",
    name: "Árbitro",
    description: "Validación de resultados oficiales y gestión de actas digitales de competición.",
    color: "bg-yellow-500",
    icon: Hammer,
    included: ["match.validate", "match.view", "report.official"],
    restricted: ["scout.*", "video.*"],
    count: 8,
    status: "Official"
  },
  {
    id: "video_operator",
    name: "Operador de Video",
    description: "Gestión de streaming, captura de video en vivo y etiquetado de puntos clave.",
    color: "bg-slate-500",
    icon: Video,
    included: ["video.stream", "video.capture", "match.view"],
    restricted: ["scout.data", "team.manage"],
    count: 15,
    status: "Production"
  }
];

export function ChangeRoleStep({ currentRole, onSelect, selectedRoleId }: any) {
  const [showAllPerms, setShowAllPerms] = useState(false);
  const selectedRole = SYSTEM_ROLES.find(r => r.id === selectedRoleId);

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {SYSTEM_ROLES.map((role) => (
          <div 
            key={role.id}
            className={`relative flex flex-col p-4 rounded-xl border transition-all cursor-pointer group ${
              selectedRoleId === role.id 
                ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" 
                : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
            }`}
            onClick={() => onSelect(role.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`size-10 rounded-lg flex items-center justify-center text-white shadow-sm ${role.color}`}>
                <role.icon className="size-5" />
              </div>
              <div className="flex flex-col items-end gap-1">
                {currentRole === role.id && (
                  <Badge variant="secondary" className="text-[8px] uppercase font-black bg-primary/10 text-primary border-primary/20">Actual</Badge>
                )}
                <Badge variant="outline" className="text-[8px] uppercase font-bold opacity-60 group-hover:opacity-100">{role.status}</Badge>
              </div>
            </div>
            
            <div className="space-y-1">
              <span className="font-bold text-sm flex items-center gap-2">
                {role.name}
                {selectedRoleId === role.id && <CheckCircle2 className="size-3 text-primary" />}
              </span>
              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                {role.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Details Panel */}
      {selectedRole && (
        <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-3">
              <div className={`size-8 rounded-lg flex items-center justify-center text-white ${selectedRole.color}`}>
                <selectedRole.icon className="size-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold leading-none">Capacidades: {selectedRole.name}</h4>
                <p className="text-[10px] text-muted-foreground mt-1">{selectedRole.count} permisos configurados</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-[10px] h-7 px-2 font-bold uppercase tracking-wider"
              onClick={() => setShowAllPerms(!showAllPerms)}
            >
              {showAllPerms ? "Cerrar" : "Ver todos"}
              <ChevronRight className={`size-3 ml-1 transition-transform ${showAllPerms ? 'rotate-90' : ''}`} />
            </Button>
          </div>

          <div className="p-4 grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 dark:text-green-400 tracking-widest">
                <CheckCircle2 className="size-3" /> Incluidos
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showAllPerms ? [...selectedRole.included, "ui.access", "api.read", "profile.edit"] : selectedRole.included).map(p => (
                  <Badge key={p} variant="secondary" className="text-[9px] font-medium bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600 dark:text-red-400 tracking-widest">
                <XCircle className="size-3" /> Restringidos
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedRole.restricted.length > 0 ? (
                  selectedRole.restricted.map(p => (
                    <Badge key={p} variant="outline" className="text-[9px] font-medium border-red-500/30 text-red-600/70">
                      {p}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[9px] text-muted-foreground italic">Sin restricciones específicas</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

