/**
 * Sistema de Módulos RALLY
 * Define las funcionalidades del ecosistema que pueden activarse de forma independiente.
 */

export type ModuleId =
  | "scout_live"       // Registro de partidos en tiempo real
  | "video_analysis"   // Sincronización de video y clips
  | "intelligence_pro" // Reportes IA y análisis avanzado
  | "coach_assistant"  // Asistente táctico en vivo
  | "mcp_integration"  // Acceso vía agentes (Model Context Protocol)
  | "team_management"; // Gestión avanzada de clubes y categorías

export interface RallyModule {
  id: ModuleId;
  name: string;
  description: string;
  isPublic: boolean; // ¿Disponible en la versión gratuita?
}

export const RALLY_MODULES: Record<ModuleId, RallyModule> = {
  scout_live: {
    id: "scout_live",
    name: "Scouting en Vivo",
    description: "Registro profesional de acciones (Data Volley style).",
    isPublic: false,
  },
  video_analysis: {
    id: "video_analysis",
    name: "Video Análisis",
    description: "Sincronización de video, creación de clips y playlists.",
    isPublic: false,
  },
  intelligence_pro: {
    id: "intelligence_pro",
    name: "Rally Intelligence",
    description: "Análisis técnico con IA de alto rendimiento.",
    isPublic: false,
  },
  coach_assistant: {
    id: "coach_assistant",
    name: "Asistente Táctico",
    description: "Alertas y sugerencias estratégicas en tiempo real.",
    isPublic: false,
  },
  mcp_integration: {
    id: "mcp_integration",
    name: "Agentes MCP",
    description: "Conexión de tus datos con agentes de IA externos.",
    isPublic: false,
  },
  team_management: {
    id: "team_management",
    name: "Gestión de Club",
    description: "Administración multi-categoría y perfiles de jugadoras.",
    isPublic: true, // La gestión básica es parte de la entrada al ecosistema
  },
};
