// Rally Intelligence — motores de insights programáticos (sin IA).
// Cada motor recibe el snapshot IntelligenceMatchStats y devuelve
// una lista de Insight etiquetada por categoría.

import type { IntelligenceMatchStats } from "@/lib/intelligence/stats";
import type { EngineResult, Insight, InsightCategory } from "@/lib/intelligence/types";
import { RULES } from "./rules";

const mkId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

function ins(
  category: InsightCategory,
  severity: Insight["severity"],
  title: string,
  detail: string,
  extra?: Partial<Insight>,
): Insight {
  return { id: mkId(category), category, severity, title, detail, ...extra };
}

// ---------- Ataque ----------
export function attackEngine(s: IntelligenceMatchStats): EngineResult {
  const insights: Insight[] = [];
  for (const p of s.players) {
    const attempts = p.attack + p.attackError;
    if (attempts < RULES.attack.minAttempts) continue;
    const eff = attempts > 0 ? (p.attack / attempts) * 100 : 0;
    if (eff <= RULES.attack.lowEfficiency) {
      insights.push(
        ins("attack", "warning", `Baja eficiencia de ataque de #${p.number}`,
          `${p.name} tiene ${p.attack}/${attempts} intentos (${eff.toFixed(0)}%).`,
          { playerId: p.playerId, metrics: { attempts, kills: p.attack, efficiency: +eff.toFixed(1) } }),
      );
    } else if (eff >= RULES.attack.highEfficiency) {
      insights.push(
        ins("attack", "positive", `Ataque letal de #${p.number}`,
          `${p.name} rinde ${eff.toFixed(0)}% (${p.attack}/${attempts}).`,
          { playerId: p.playerId, metrics: { attempts, kills: p.attack, efficiency: +eff.toFixed(1) } }),
      );
    }
    if (p.attackError >= RULES.attack.highErrors) {
      insights.push(
        ins("attack", "critical", `Errores de ataque de #${p.number}`,
          `${p.name} cometió ${p.attackError} errores de ataque.`,
          { playerId: p.playerId, metrics: { errors: p.attackError } }),
      );
    }
  }
  return { category: "attack", insights };
}

// ---------- Recepción ----------
export function receptionEngine(s: IntelligenceMatchStats): EngineResult {
  const insights: Insight[] = [];
  for (const r of s.reception) {
    if (r.total < RULES.reception.minTotal) continue;
    if (r.efficiency <= RULES.reception.lowEfficiency) {
      insights.push(
        ins("reception", "warning", "Recepción vulnerable",
          `Jugadora con eficiencia ${r.efficiency.toFixed(0)}% sobre ${r.total} recepciones.`,
          { playerId: r.playerId, metrics: { total: r.total, efficiency: +r.efficiency.toFixed(1), overpass: r.overpass } }),
      );
    } else if (r.efficiency >= RULES.reception.highEfficiency) {
      insights.push(
        ins("reception", "positive", "Muralla en recepción",
          `Eficiencia ${r.efficiency.toFixed(0)}% en ${r.total} recepciones.`,
          { playerId: r.playerId, metrics: { total: r.total, efficiency: +r.efficiency.toFixed(1) } }),
      );
    }
  }
  return { category: "reception", insights };
}

// ---------- Saque ----------
export function serveEngine(s: IntelligenceMatchStats): EngineResult {
  const insights: Insight[] = [];
  for (const p of s.players) {
    if (p.ace >= RULES.serve.highAces) {
      insights.push(
        ins("serve", "positive", `Sacadora destacada #${p.number}`,
          `${p.name} consiguió ${p.ace} aces.`,
          { playerId: p.playerId, metrics: { aces: p.ace } }),
      );
    }
    if (p.serveError >= RULES.serve.highErrors) {
      insights.push(
        ins("serve", "warning", `Errores de saque de #${p.number}`,
          `${p.name} cometió ${p.serveError} errores desde la línea.`,
          { playerId: p.playerId, metrics: { errors: p.serveError } }),
      );
    }
  }
  const totalErr = s.team?.serveErrors ?? 0;
  const totalAces = s.team?.ace ?? 0;
  if (totalAces + totalErr >= 8) {
    const ratio = totalAces / Math.max(1, totalErr);
    insights.push(
      ins("serve", ratio >= 1 ? "positive" : "warning",
        "Balance de saque del equipo",
        `Aces ${totalAces} vs errores ${totalErr} (ratio ${ratio.toFixed(2)}).`,
        { metrics: { aces: totalAces, errors: totalErr, ratio: +ratio.toFixed(2) } }),
    );
  }
  return { category: "serve", insights };
}

// ---------- Bloqueo ----------
export function blockEngine(s: IntelligenceMatchStats): EngineResult {
  const insights: Insight[] = [];
  for (const p of s.players) {
    if (p.block >= RULES.block.highBlocks) {
      insights.push(
        ins("block", "positive", `Bloqueadora clave #${p.number}`,
          `${p.name} sumó ${p.block} bloqueos.`,
          { playerId: p.playerId, metrics: { blocks: p.block } }),
      );
    }
    if (p.blockError >= RULES.block.highErrors) {
      insights.push(
        ins("block", "warning", `Errores de bloqueo de #${p.number}`,
          `${p.name} cometió ${p.blockError} errores de bloqueo.`,
          { playerId: p.playerId, metrics: { errors: p.blockError } }),
      );
    }
  }
  return { category: "block", insights };
}

// ---------- Armado ----------
export function settingEngine(s: IntelligenceMatchStats): EngineResult {
  // Sin agregados dedicados aún; deducimos ratio de continuidad vs punto.
  const insights: Insight[] = [];
  const team = s.team;
  if (team && team.attack >= RULES.setting.minSettings) {
    insights.push(
      ins("setting", "info", "Volumen ofensivo",
        `El equipo generó ${team.attack} intentos ofensivos, con ${team.counterAttack} contraataques.`,
        { metrics: { attacks: team.attack, counterAttacks: team.counterAttack } }),
    );
  }
  return { category: "setting", insights };
}

// ---------- Rotaciones ----------
export function rotationEngine(s: IntelligenceMatchStats): EngineResult {
  const insights: Insight[] = [];
  for (const set of s.rotations) {
    const side = s.side === "A" ? set.A : set.B;
    for (const b of side.buckets) {
      const delta = b.pf - b.pc;
      const played = b.pf + b.pc;
      if (played < 3) continue;
      if (delta <= RULES.rotation.criticalDelta) {
        insights.push(
          ins("rotation", "critical", `Rotación ${b.rotation} en apuros (Set ${set.setNumber})`,
            `PF ${b.pf} · PC ${b.pc} (${delta}).`,
            { rotation: b.rotation, metrics: { setNumber: set.setNumber, pf: b.pf, pc: b.pc, delta } }),
        );
      } else if (delta >= RULES.rotation.positiveDelta) {
        insights.push(
          ins("rotation", "positive", `Rotación ${b.rotation} dominante (Set ${set.setNumber})`,
            `PF ${b.pf} · PC ${b.pc} (+${delta}).`,
            { rotation: b.rotation, metrics: { setNumber: set.setNumber, pf: b.pf, pc: b.pc, delta } }),
        );
      }
    }
  }
  return { category: "rotation", insights };
}

// ---------- Orquestador ----------
export function runAllEngines(s: IntelligenceMatchStats): Insight[] {
  return [
    attackEngine(s),
    receptionEngine(s),
    serveEngine(s),
    settingEngine(s),
    blockEngine(s),
    rotationEngine(s),
  ].flatMap((r) => r.insights);
}
