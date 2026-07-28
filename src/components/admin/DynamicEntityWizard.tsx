import React, { useState, useEffect } from "react";
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

export type EntityType = "org" | "user" | "role" | "permission" | "module" | "plan" | "subscription";

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
      { title: "Módulo", description: "Nombre y versión" },
      { title: "Dependencias", description: "Requisitos técnicos" }
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
      { title: "Configuración", description: "Periodo y facturación" }
    ]
  }
};

interface DynamicEntityWizardProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
}

export function DynamicEntityWizard({ isOpen, onClose, entityType }: DynamicEntityWizardProps) {
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

  const handleNext = () => {
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
    }
  }, [isOpen]);

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
    return currentStep === totalSteps - 1 && entityType !== "user";
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
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Plan</Label>
                      <div className="font-bold text-lg">{planData.name} ({planData.code})</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Precio</Label>
                      <div className="font-bold text-xl text-primary">{planData.price} {planData.currency} / {planData.billing}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Módulos</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {planData.modules.length > 0 ? planData.modules.map(m => (
                          <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                        )) : <span className="text-xs text-muted-foreground italic">Sin módulos seleccionados</span>}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase">Características</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {planData.features.length > 0 ? planData.features.map(f => (
                          <Badge key={f} variant="outline" className="text-[10px] border-primary/20 text-primary">{f}</Badge>
                        )) : <span className="text-xs text-muted-foreground italic">Sin características adicionales</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {entityType === "user" && currentStep === 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" placeholder="Ej: Juan Francisco" className="h-11" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="surname">Apellido</Label>
                    <Input id="surname" placeholder="Ej: Castro" className="h-11" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo</Label>
                    <Input id="email" type="email" placeholder="usuario@rally.com" className="h-11" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pass">Contraseña temporal</Label>
                    <Input id="pass" type="password" placeholder="••••••••" className="h-11" />
                  </div>
                </>
              )}

              {entityType === "org" && currentStep === 0 && (
                <div className="grid gap-4">
                  <Label>Tipo de Organización</Label>
                  {["Federación", "Asociación", "Liga", "Club", "Academia", "Otro"].map((type) => (
                    <div key={type} className="flex items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-primary/40 cursor-pointer transition-all hover:bg-primary/5">
                      <div className="size-5 rounded-full border-2 border-primary/20 flex items-center justify-center">
                        <div className="size-2 rounded-full bg-primary opacity-0" />
                      </div>
                      <span className="font-medium">{type}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Mensaje de desarrollo elegante si el paso no está completo */}
              {((entityType === "permission" && currentStep > 0) || 
                entityType === "module" || 
                entityType === "subscription" ||
                (entityType === "role" && currentStep > 0) ||
                (entityType === "user" && currentStep > 0) || 
                (entityType === "org" && currentStep > 0)) && (
                <div className="p-8 rounded-2xl border border-dashed border-border/60 bg-muted/5 flex flex-col items-center text-center">
                  <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Info className="size-6 text-muted-foreground" />
                  </div>
                  <h4 className="font-bold text-foreground">Configuración de {config.steps[currentStep].title}</h4>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                    Este componente está resolviendo las reglas de negocio para la entidad.
                  </p>
                  <Badge variant="outline" className="mt-6 font-bold text-[10px] uppercase tracking-widest py-1">
                    En Desarrollo
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/40 bg-background flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0} className="font-bold">
            <ChevronLeft className="size-4 mr-2" /> Anterior
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="font-bold">
              Cancelar
            </Button>
            <Button 
              onClick={handleNext} 
              className={`font-bold px-8 ${currentStep === totalSteps - 1 ? "bg-green-600 hover:bg-green-700 text-white" : "shadow-glow"}`}
              disabled={isNextDisabled()} // Solo permitir finalizar si está implementado
            >
              {currentStep === totalSteps - 1 ? "Finalizar" : "Siguiente"}
              {currentStep < totalSteps - 1 && <ChevronRight className="size-4 ml-2" />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
