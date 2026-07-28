import { createServerFn } from "@tanstack/react-start";

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  entity: string;
  details: string;
  ip: string;
  status: 'success' | 'failure';
}

export interface Subscription {
  id: string;
  orgName: string;
  plan: string;
  status: 'active' | 'past_due' | 'canceled';
  startDate: string;
  nextBilling: string;
  amount: number;
}

export const adminGetAuditLogs = createServerFn({ method: "GET" })
  .handler(async () => {
    // Simulación de auditoría para el panel enterprise
    return [
      { id: '1', timestamp: new Date().toISOString(), userId: 'u1', userEmail: 'admin@rally.com', action: 'CREATE_ORG', entity: 'Club Quilino', details: 'Nueva organización creada en jerarquía FeVA', ip: '192.168.1.1', status: 'success' },
      { id: '2', timestamp: new Date(Date.now() - 3600000).toISOString(), userId: 'u2', userEmail: 'franco@rally.com', action: 'UPDATE_PLAN', entity: 'Federación Córdoba', details: 'Upgrade a Plan Enterprise', ip: '186.12.43.2', status: 'success' },
      { id: '3', timestamp: new Date(Date.now() - 7200000).toISOString(), userId: 'u3', userEmail: 'error@bot.com', action: 'LOGIN_ATTEMPT', entity: 'Auth', details: 'Fallo de autenticación: Password incorrecto', ip: '45.12.1.99', status: 'failure' },
    ] as AuditLog[];
  });

export const adminGetSubscriptions = createServerFn({ method: "GET" })
  .handler(async () => {
    return [
      { id: 's1', orgName: 'FeVA', plan: 'Enterprise', status: 'active', startDate: '2024-01-01', nextBilling: '2025-01-01', amount: 499 },
      { id: 's2', orgName: 'Federación Córdoba', plan: 'Federation', status: 'active', startDate: '2024-03-15', nextBilling: '2024-04-15', amount: 150 },
      { id: 's3', orgName: 'Club Atlético Belgrano', plan: 'Club', status: 'past_due', startDate: '2023-12-01', nextBilling: '2024-03-01', amount: 45 },
    ] as Subscription[];
  });
