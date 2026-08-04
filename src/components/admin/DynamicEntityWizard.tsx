import React, { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Info,
  Building2,
  Users,
  Shield,
  Key,
  Package,
  CreditCard,
  Zap,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RoleInfoStep, type RoleInfoData } from "./steps/RoleInfoStep";
import { PermissionDefinitionStep, type PermissionDefinitionData } from "./steps/PermissionDefinitionStep";
import { PlanInformationStep, type PlanInfoData } from "./steps/PlanInformationStep";
import { PlanFeaturesStep, type PlanFeaturesData } from "./steps/PlanFeaturesStep";
import { PlanSummaryStep } from "./steps/PlanSummaryStep";
import { ModuleInfoStep, type ModuleInfoData } from "./steps/ModuleInfoStep";
import { ModuleConfigStep, type ModuleConfigData } from "./steps/ModuleConfigStep";
import { SubscriptionInfoStep, type SubscriptionInfoData } from "./steps/SubscriptionInfoStep";

import { SubscriptionBillingStep, type SubscriptionBillingData } from "./steps/SubscriptionBillingStep";
import { ChangeRoleStep } from "./steps/ChangeRoleStep";
import { useQuery } from "@tanstack/react-query";
import { adminListLeagues } from "@/lib/admin.functions";

function LeagueSelector({ selectedIds, onChange }: { selectedIds: string[], onChange: (ids: string[]) => void }) {
  const listLeagues = useServerFn(adminListLeagues);
  const { data: leagues, isLoading } = useQuery({ 
    queryKey: ["admin", "leagues-selector"], 
    queryFn: () => listLeagues() 
  });

  if (isLoading) return <div className="space-y-2 animate-pulse">
    {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded-lg" />)}
  </div>;

  return (
    <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
      {leagues?.map((league) => (
        <div 
          key={league.id}
          onClick={() => {
            const next = selectedIds.includes(league.id)
              ? selectedIds.filter(id => id !== league.id)
              : [...selectedIds, league.id];
            onChange(next);
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
            selectedIds.includes(league.id)
              ? "border-primary bg-primary/10" 
              : "border-border/60 hover:border-primary/40"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full" style={{ backgroundColor: league.color || '#3b82f6' }} />
            <span className={`text-sm font-medium ${selectedIds.includes(league.id) ? "text-primary" : ""}`}>
              {league.name}
            </span>
          </div>
          <div className={`size-4 rounded border flex items-center justify-center transition-all ${
            selectedIds.includes(league.id) 
              ? "border-primary bg-primary text-primary-foreground" 
              : "border-border bg-background"
          }`}>
            {selectedIds.includes(league.id) && <Check className="size-2.5" strokeWidth={3} />}
          </div>
        </div>
      ))}
      {leagues?.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No hay ligas disponibles.</p>}
    </div>
  );
}

export type EntityType = "org" | "user" | "role" | "permission" | "module" | "plan" | "subscription" | "change_role";

interface Step {
  title: string;
  description: string;
}

const ENTITY_CONFIG: Record<EntityType, { title: string; steps: Step[]; icon: any }> = {
  user: {
    title: "Crear Usuario",
    icon: Users,
    steps: [
      { title: "Información Personal", description: "Datos básicos del usuario" },
      { title: "Roles y Permisos", description: "Asignación de capacidades" },
      { title: "Workspace", description: "Contexto de trabajo" },
      { title: "Resumen", description: "Revisión final" }
    ]
  },
  org: {
    title: "Crear Organización",
    icon: Building2,
    steps: [
      { title: "Tipo", description: "Nivel jerárquico" },
      { title: "Identidad", description: "Nombre y branding" },
      { title: "Ubicación", description: "Datos geográficos" },
      { title: "Suscripción", description: "Plan inicial" },
      { title: "Módulos", description: "Funcionalidades" },
      { title: "Confirmar", description: "Finalizar creación" }
    ]
  },
  role: {
    title: "Crear Rol",
    icon: Shield,
    steps: [
      { title: "Información", description: "Nombre y descripción" },
      { title: "Permisos", description: "Capacidades del rol" },
      { title: "Resumen", description: "Confirmar cambios" }
    ]
  },
  permission: {
    title: "Nuevo Permiso",
    icon: Key,
    steps: [
      { title: "Definición", description: "Key y categoría" },
      { title: "Alcance", description: "Nivel de acceso" }
    ]
  },
  module: {
    title: "Nuevo Módulo",
    icon: Package,
    steps: [
      { title: "Información", description: "Datos básicos del módulo" },
      { title: "Configuración", description: "Rutas y visibilidad" }
    ]
  },
  plan: {
    title: "Nuevo Plan",
    icon: CreditCard,
    steps: [
      { title: "Información del Plan", description: "Nombre y precio" },
      { title: "Características", description: "Módulos y límites" },
      { title: "Resumen", description: "Revisión final" }
    ]
  },
  subscription: {
    title: "Nueva Suscripción",
    icon: Zap,
    steps: [
      { title: "Entidad", description: "A quién pertenece" },
      { title: "Facturación", description: "Periodo y facturación" }
    ]
  },
  change_role: {
    title: "Cambiar Rol de Sistema",
    icon: Shield,
    steps: [
      { title: "Selección de Rol", description: "Elegir el nuevo nivel de acceso" },
      { title: "Impacto de Permisos", description: "Revisar cambios en capacidades" },
      { title: "Confirmación", description: "Aplicar cambios al usuario" }
    ]
  }
};

interface DynamicEntityWizardProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  targetEntity?: any;
}

import { adminSetRole, adminSetExtraRole, adminCreateLeague, adminCreateClub, adminCreateUser, type ExtraRole } from "@/lib/admin.functions";

export function DynamicEntityWizard({ isOpen, onClose, entityType, targetEntity }: DynamicEntityWizardProps) {
  const queryClient = useQueryClient();
  const setRole = useServerFn(adminSetRole);
  const setExtraRole = useServerFn(adminSetExtraRole);
  const createLeague = useServerFn(adminCreateLeague);
  const createClub = useServerFn(adminCreateClub);
  const createUser = useServerFn(adminCreateUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [roleData, setRoleData] = useState<RoleInfoData>({
    name: "",
    description: "",
    workspaceId: "",
    organizationId: "",
    color: "#3b82f6",
    icon: "Shield",
    status: "active",
    type: "custom"
  });
  const [permissionData, setPermissionData] = useState<PermissionDefinitionData>({
    key: "",
    category: "",
    description: ""
  });
  const [planData, setPlanData] = useState<PlanInfoData & PlanFeaturesData>({
    name: "",
    code: "",
    description: "",
    type: "club",
    billing: "mensual",
    price: 0,
    currency: "USD",
    status: "active",
    color: "#3b82f6",
    icon: "CreditCard",
    version: "v1.0",
    modules: [],
    limits: {},
    features: []
  });
  const [moduleData, setModuleData] = useState<ModuleInfoData & ModuleConfigData>({
    name: "",
    code: "",
    description: "",
    category: "",
    route: "",
    order: 0,
    visible: true,
    requiresLicense: true
  });
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionInfoData & SubscriptionBillingData>({
    orgId: "",
    planId: "",
    frequency: "mensual",
    currency: "USD",
    price: 0
  });
  const [changeRoleData, setChangeRoleData] = useState({
    roleId: targetEntity?.isAdmin ? "admin" : "user"
  });
  const [orgWizardData, setOrgWizardData] = useState({
    type: "",
    name: "",
    slug: "",
    country: "",
    city: "",
    address: "",
    plan: "Free",
    modules: ["Live Scoring", "Advanced Scouting"]
  });
  const [userData, setUserData] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
    canCreateMatches: true,
    extraRoles: [] as ExtraRole[],
    leagueIds: [] as string[]
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const config = ENTITY_CONFIG[entityType];
  const totalSteps = config.steps.length;

  const validateRoleStep = () => {
    const newErrors: Record<string, string> = {};
    if (!roleData.name.trim()) newErrors.name = "El nombre es obligatorio";
    if (!roleData.workspaceId) newErrors.workspaceId = "Debes seleccionar un Workspace";
    if (!roleData.organizationId) newErrors.organizationId = "Debes seleccionar una Organización";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePermissionStep = () => {
    const newErrors: Record<string, string> = {};
    if (!permissionData.key.trim()) newErrors.key = "La key es obligatoria";
    if (!permissionData.category) newErrors.category = "Debes seleccionar una categoría";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePlanStep = () => {
    const newErrors: Record<string, string> = {};
    if (!planData.name.trim()) newErrors.name = "El nombre es obligatorio";
    if (!planData.code.trim()) newErrors.code = "El código es obligatorio";
    if (planData.price < 0) newErrors.price = "El precio no puede ser negativo";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (entityType === "role" && currentStep === 0) {
      if (!validateRoleStep()) return;
    }
    
    if (entityType === "permission" && currentStep === 0) {
      if (!validatePermissionStep()) return;
    }

    if (entityType === "plan" && currentStep === 0) {
      if (!validatePlanStep()) return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Logic for finishing the wizard
      if (entityType === "change_role" && targetEntity) {
        setIsSubmitting(true);
        try {
          const newRoleId = changeRoleData.roleId;
          
          if (newRoleId === "admin") {
            // Asignar Admin y limpiar roles extra (un admin no necesita roles extra en este modelo)
            await setRole({ data: { userId: targetEntity.id, isAdmin: true } });
            await setExtraRole({ data: { userId: targetEntity.id, roles: [] } });
          } else {
            // Asegurar que NO sea admin global
            await setRole({ data: { userId: targetEntity.id, isAdmin: false } });
            
            if (newRoleId !== "user") {
              const roleMapping: Record<string, ExtraRole> = {
                "scorekeeper": "planillero",
                "coach": "entrenador",
                "analyst": "analyst",
                "scout": "planillero",
                "referee": "planillero",
                "video_operator": "planillero"
              };
              
              const extraRole = roleMapping[newRoleId] || (newRoleId as ExtraRole);
              await setExtraRole({ data: { userId: targetEntity.id, roles: [extraRole] } });
            } else {
              // Si es Usuario Estándar, limpiar todo
              await setExtraRole({ data: { userId: targetEntity.id, roles: [] } });
            }
          }
          
          toast.success("Rol actualizado correctamente");
          await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          onClose();
        } catch (error: any) {
          console.error("Error updating role:", error);
          toast.error(error.message || "Error al actualizar el rol");
        } finally {
          setIsSubmitting(false);
        }
      } else if (entityType === "org") {
        setIsSubmitting(true);
        try {
          // Lógica para crear Organización (Liga o Club)
          if (orgWizardData.type === "Liga") {
            await createLeague({ data: { name: orgWizardData.name } });
            toast.success("Liga creada correctamente");
          } else {
            await createClub({ data: { name: orgWizardData.name } });
            toast.success(`${orgWizardData.type} creado correctamente`);
          }
          
          await queryClient.invalidateQueries({ queryKey: ["admin", "workspaces"] });
          onClose();
        } catch (error: any) {
          console.error("Error creating organization:", error);
          toast.error(error.message || "Error al crear la organización");
        } finally {
          setIsSubmitting(false);
        }
      } else if (entityType === "user") {
        setIsSubmitting(true);
        try {
          await createUser({
            data: {
              email: userData.email,
              password: userData.password,
              leagueIds: userData.leagueIds,
              canCreateMatches: userData.canCreateMatches,
              extraRoles: userData.extraRoles
            }
          });
          toast.success("Usuario creado correctamente");
          await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          onClose();
        } catch (error: any) {
          console.error("Error creating user:", error);
          toast.error(error.message || "Error al crear el usuario");
        } finally {
          setIsSubmitting(false);
        }
      } else {
        console.log(`[Wizard] Finalizing creation of: ${entityType}`);
        onClose();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setErrors({});
      if (entityType === "change_role" && targetEntity) {
        setChangeRoleData({ roleId: targetEntity.isAdmin ? "admin" : "user" });
      }
    }
  }, [isOpen, entityType, targetEntity]);

  if (!config) return null;

  const Icon = config.icon;

  const isNextDisabled = () => {
    if (entityType === "role" && currentStep === 0) {
      return !roleData.name || !roleData.workspaceId || !roleData.organizationId;
    }
    if (entityType === "permission" && currentStep === 0) {
      return !permissionData.key || !permissionData.category;
    }
    if (entityType === "plan" && currentStep === 0) {
      return !planData.name || !planData.code;
    }
    if (entityType === "org" && currentStep === 0) {
      return !orgWizardData.type;
    }
    if (entityType === "org" && currentStep === 1) {
      return !orgWizardData.name;
    }
    if (entityType === "user" && currentStep === 0) {
      return !userData.email || !userData.password;
    }
    if (entityType === "change_role" && currentStep === 0) {
      return !changeRoleData.roleId;
    }
    return currentStep === totalSteps - 1 && entityType !== "user" && entityType !== "change_role" && entityType !== "org";
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-2xl p-0 flex flex-col h-full border-l border-border/60">
        {/* Header con Stepper */}
        <div className="p-6 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Icon className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{config.title}</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-black mt-0.5">
                RALLY Core Wizard
              </p>
            </div>
            <Button variant="ghost" size="icon" className="ml-auto rounded-full" onClick={onClose}>
              <X className="size-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            {config.steps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div 
                  className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    idx === currentStep 
                      ? "bg-primary text-primary-foreground border-primary shadow-glow" 
                      : idx < currentStep 
                        ? "bg-primary/20 text-primary border-primary/30" 
                        : "bg-muted text-muted-foreground border-border/60"
                  }`}
                >
                  {idx < currentStep ? <Check className="size-4" /> : idx + 1}
                </div>
                {idx < totalSteps - 1 && (
                  <div className={`h-0.5 flex-1 ${idx < currentStep ? "bg-primary/30" : "bg-muted"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <div className="text-sm font-bold">{config.steps[currentStep].title}</div>
            <div className="text-xs text-muted-foreground">Paso {currentStep + 1} de {totalSteps}</div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-md mx-auto space-y-8">
            <div className="space-y-2">
              <h3 className="text-lg font-bold">{config.steps[currentStep].title}</h3>
              <p className="text-sm text-muted-foreground">{config.steps[currentStep].description}</p>
            </div>

            <Separator className="opacity-40" />

            {/* Formulario real según entidad */}
            <div className="space-y-6">
              {entityType === "role" && currentStep === 0 && (
                <RoleInfoStep 
                  data={roleData} 
                  onChange={(newData) => setRoleData(prev => ({ ...prev, ...newData }))}
                  errors={errors}
                />
              )}

              {entityType === "permission" && currentStep === 0 && (
                <PermissionDefinitionStep 
                  data={permissionData}
                  onChange={(newData) => setPermissionData(prev => ({ ...prev, ...newData }))}
                  errors={errors}
                />
              )}

              {entityType === "plan" && currentStep === 0 && (
                <PlanInformationStep 
                  data={planData}
                  onChange={(newData) => setPlanData(prev => ({ ...prev, ...newData }))}
                  errors={errors}
                />
              )}

              {entityType === "plan" && currentStep === 1 && (
                <PlanFeaturesStep 
                  data={planData}
                  onChange={(newData) => setPlanData(prev => ({ ...prev, ...newData }))}
                />
              )}

              {entityType === "plan" && currentStep === 2 && (
                <PlanSummaryStep data={planData} />
              )}

              {entityType === "module" && currentStep === 0 && (
                <ModuleInfoStep data={moduleData} onChange={(d) => setModuleData(p => ({...p, ...d}))} />
              )}
              {entityType === "module" && currentStep === 1 && (
                <ModuleConfigStep data={moduleData} onChange={(d) => setModuleData(p => ({...p, ...d}))} />
              )}
              {entityType === "subscription" && currentStep === 0 && (
                <SubscriptionInfoStep data={subscriptionData} onChange={(d) => setSubscriptionData(p => ({...p, ...d}))} />
              )}
              {entityType === "subscription" && currentStep === 1 && (
                <SubscriptionBillingStep data={subscriptionData} onChange={(d) => setSubscriptionData(p => ({...p, ...d}))} />
              )}

              {entityType === "change_role" && currentStep === 0 && (
                <ChangeRoleStep 
                  currentRole={targetEntity?.isAdmin ? "admin" : "user"} 
                  selectedRoleId={changeRoleData.roleId}
                  onSelect={(id: string) => setChangeRoleData({ roleId: id })}
                />
              )}

              {entityType === "change_role" && currentStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex gap-3">
                    <Shield className="size-5 text-primary shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold">Resumen de Cambios</p>
                      <p className="text-muted-foreground mt-1">
                        El usuario pasará de ser <span className="font-bold text-foreground">{targetEntity?.isAdmin ? 'Administrador' : 'Usuario Estándar'}</span> a <span className="font-bold text-foreground capitalize">{changeRoleData.roleId}</span>.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 mt-6">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nuevos Permisos</p>
                    <div className="flex flex-wrap gap-2">
                      {["match.live", "scout.create", "video.view", "report.export"].map(p => (
                        <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {entityType === "change_role" && currentStep === 2 && (
                <div className="text-center py-8 space-y-4">
                  <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mx-auto border border-green-500/20 shadow-sm">
                    <Check className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">¡Todo listo!</h3>
                    <p className="text-sm text-muted-foreground">
                      Haga clic en finalizar para aplicar el nuevo rol a <strong>{targetEntity?.email}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {entityType === "user" && currentStep === 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nombre (Opcional)</Label>
                    <Input 
                      id="name" 
                      placeholder="Ej: Juan Francisco" 
                      className="h-11" 
                      value={userData.name}
                      onChange={(e) => setUserData({...userData, name: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="surname">Apellido (Opcional)</Label>
                    <Input 
                      id="surname" 
                      placeholder="Ej: Castro" 
                      className="h-11" 
                      value={userData.surname}
                      onChange={(e) => setUserData({...userData, surname: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="usuario@rally.com" 
                      className="h-11" 
                      value={userData.email}
                      onChange={(e) => setUserData({...userData, email: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pass">Contraseña</Label>
                    <Input 
                      id="pass" 
                      type="password" 
                      placeholder="••••••••" 
                      className="h-11" 
                      value={userData.password}
                      onChange={(e) => setUserData({...userData, password: e.target.value})}
                    />
                  </div>
                </>
              )}

              {entityType === "user" && currentStep === 1 && (
                <div className="space-y-4">
                  <Label>Asignar Roles</Label>
                  {[
                    { id: 'coach', label: 'Entrenador', icon: Users, role: 'entrenador' },
                    { id: 'scorekeeper', label: 'Planillero', icon: Shield, role: 'planillero' },
                    { id: 'analyst', label: 'Analista', icon: Key, role: 'analyst' },
                  ].map((role) => (
                    <div 
                      key={role.id}
                      onClick={() => {
                        const currentRoles = userData.extraRoles;
                        const newRoles = currentRoles.includes(role.role as ExtraRole)
                          ? currentRoles.filter(r => r !== role.role)
                          : [...currentRoles, role.role as ExtraRole];
                        setUserData({ ...userData, extraRoles: newRoles });
                      }}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        userData.extraRoles.includes(role.role as ExtraRole)
                          ? "border-primary bg-primary/10 shadow-glow" 
                          : "border-border/60 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <role.icon className={`size-5 ${userData.extraRoles.includes(role.role as ExtraRole) ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`font-medium ${userData.extraRoles.includes(role.role as ExtraRole) ? "text-primary" : ""}`}>{role.label}</span>
                      </div>
                      <div className={`size-5 rounded-md border flex items-center justify-center transition-all ${
                        userData.extraRoles.includes(role.role as ExtraRole) 
                          ? "border-primary bg-primary text-primary-foreground shadow-sm" 
                          : "border-border bg-background"
                      }`}>
                        {userData.extraRoles.includes(role.role as ExtraRole) && <Check className="size-3" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {entityType === "user" && currentStep === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">El usuario será creado con acceso directo a estas ligas (opcional).</p>
                  <div className="p-4 rounded-xl border border-dashed border-border/60 bg-muted/5 flex flex-col items-center justify-center gap-2">
                    <Globe className="size-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">Configuración avanzada de acceso</p>
                    <p className="text-[10px] text-muted-foreground/60 italic">Se podrá configurar más tarde desde el panel de permisos.</p>
                  </div>
                </div>
              )}

              {entityType === "user" && currentStep === 3 && (
                <div className="text-center py-8 space-y-4">
                  <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto border border-primary/20 shadow-glow">
                    <Users className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">Resumen de Usuario</h3>
                    <p className="text-sm text-muted-foreground">
                      Se creará la cuenta para <strong>{userData.email}</strong>.
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl text-left text-xs space-y-2 border border-border/40">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground uppercase font-black tracking-tighter">Email:</span>
                      <span className="font-bold">{userData.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground uppercase font-black tracking-tighter">Roles:</span>
                      <span className="font-bold">{userData.extraRoles.join(', ') || 'Usuario Estándar'}</span>
                    </div>
                  </div>
                </div>
              )}

              {entityType === "org" && currentStep === 0 && (

                <div className="grid gap-4">
                  <Label>Tipo de Organización</Label>
                  {["Federación", "Asociación", "Liga", "Club", "Academia", "Otro"].map((type) => (
                    <div 
                      key={type} 
                      onClick={() => setOrgWizardData({ ...orgWizardData, type })}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:bg-primary/5 ${
                        orgWizardData.type === type 
                          ? "border-primary bg-primary/10 shadow-glow" 
                          : "border-border/60 hover:border-primary/40"
                      }`}
                    >
                      <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        orgWizardData.type === type ? "border-primary" : "border-primary/20"
                      }`}>
                        {orgWizardData.type === type && (
                          <div className="size-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className={`font-medium ${orgWizardData.type === type ? "text-primary" : ""}`}>{type}</span>
                    </div>
                  ))}
                </div>
              )}

              {entityType === "org" && currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="org-name">Nombre de la Organización</Label>
                    <Input 
                      id="org-name" 
                      placeholder="Ej: Club Atlético Rally" 
                      className="h-11"
                      value={orgWizardData.name}
                      onChange={(e) => setOrgWizardData({ ...orgWizardData, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="org-slug">Slug / Identificador</Label>
                    <div className="flex gap-2">
                      <div className="bg-muted px-3 flex items-center rounded-lg text-xs font-mono border border-border/60">rally.app/</div>
                      <Input 
                        id="org-slug" 
                        placeholder="club-rally" 
                        className="h-11"
                        value={orgWizardData.slug}
                        onChange={(e) => setOrgWizardData({ ...orgWizardData, slug: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Logo</Label>
                    <div className="border-2 border-dashed border-border/60 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-primary/40 transition-colors cursor-pointer">
                      <Building2 className="size-8 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground font-medium">Subir imagen (PNG/JPG)</p>
                    </div>
                  </div>
                </div>
              )}

              {entityType === "org" && currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="org-country">País</Label>
                    <Input 
                      id="org-country" 
                      placeholder="Ej: Argentina" 
                      className="h-11"
                      value={orgWizardData.country}
                      onChange={(e) => setOrgWizardData({ ...orgWizardData, country: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="org-city">Ciudad / Región</Label>
                    <Input 
                      id="org-city" 
                      placeholder="Ej: Córdoba" 
                      className="h-11"
                      value={orgWizardData.city}
                      onChange={(e) => setOrgWizardData({ ...orgWizardData, city: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="org-address">Dirección (Opcional)</Label>
                    <Input 
                      id="org-address" 
                      placeholder="Ej: Av. Colón 1234" 
                      className="h-11"
                      value={orgWizardData.address}
                      onChange={(e) => setOrgWizardData({ ...orgWizardData, address: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {entityType === "org" && currentStep === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">Seleccione el plan de suscripción inicial para esta organización.</p>
                  {["Free", "Coach", "Club", "League", "Enterprise"].map((plan) => (
                    <div 
                      key={plan}
                      onClick={() => setOrgWizardData({ ...orgWizardData, plan })}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        orgWizardData.plan === plan 
                          ? "border-primary bg-primary/10 shadow-glow" 
                          : "border-border/60 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className={`size-5 ${orgWizardData.plan === plan ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <p className={`font-bold ${orgWizardData.plan === plan ? "text-primary" : ""}`}>{plan}</p>
                          <p className="text-[10px] text-muted-foreground">Detalles del plan {plan.toLowerCase()}</p>
                        </div>
                      </div>
                      <Badge variant={orgWizardData.plan === plan ? "default" : "outline"}>
                        {orgWizardData.plan === plan ? "Seleccionado" : "Seleccionar"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {entityType === "org" && currentStep === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">Módulos que estarán disponibles para esta organización.</p>
                  {["Live Scoring", "Advanced Scouting", "Video Analysis", "Performance Intelligence"].map((mod) => (
                    <div 
                      key={mod} 
                      onClick={() => {
                        const newModules = orgWizardData.modules.includes(mod)
                          ? orgWizardData.modules.filter(m => m !== mod)
                          : [...orgWizardData.modules, mod];
                        setOrgWizardData({ ...orgWizardData, modules: newModules });
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        orgWizardData.modules.includes(mod)
                          ? "border-primary/40 bg-primary/5" 
                          : "border-border/40 bg-muted/5 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Package className={`size-4 ${orgWizardData.modules.includes(mod) ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${orgWizardData.modules.includes(mod) ? "text-primary" : ""}`}>{mod}</span>
                      </div>
                      <div className={`size-5 rounded-md border flex items-center justify-center transition-all ${
                        orgWizardData.modules.includes(mod) 
                          ? "border-primary bg-primary text-primary-foreground shadow-sm" 
                          : "border-border bg-background"
                      }`}>
                        {orgWizardData.modules.includes(mod) && <Check className="size-3" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {entityType === "org" && currentStep === 5 && (
                <div className="text-center py-8 space-y-4">
                  <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto border border-primary/20 shadow-glow">
                    <Building2 className="size-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">Resumen de Organización</h3>
                    <p className="text-sm text-muted-foreground">
                      Se creará una organización de tipo <strong>{orgWizardData.type}</strong>.
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-xl text-left text-xs space-y-2 border border-border/40">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground uppercase font-black tracking-tighter">Tipo:</span>
                      <span className="font-bold">{orgWizardData.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground uppercase font-black tracking-tighter">Nombre:</span>
                      <span className="font-bold">{orgWizardData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground uppercase font-black tracking-tighter">Plan:</span>
                      <span className="font-bold">{orgWizardData.plan}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/40 bg-background flex items-center justify-between">
          {currentStep > 0 ? (
            <Button variant="ghost" onClick={handleBack} className="font-bold">
              <ChevronLeft className="size-4 mr-2" /> Anterior
            </Button>
          ) : (
            <div className="w-[100px]" />
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="font-bold">
              Cancelar
            </Button>
            <Button 
              onClick={handleNext} 
              className={`font-bold px-8 ${currentStep === totalSteps - 1 ? "bg-green-600 hover:bg-green-700 text-white" : "shadow-glow"}`}
              disabled={isNextDisabled() || isSubmitting} // Solo permitir finalizar si está implementado
            >
              {isSubmitting ? "Procesando..." : (currentStep === totalSteps - 1 ? "Finalizar" : "Siguiente")}
              {!isSubmitting && currentStep < totalSteps - 1 && <ChevronRight className="size-4 ml-2" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
