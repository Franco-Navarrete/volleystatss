import { buildEnrichedAttacks, aggregateAttacks, settingZoneToOrigin, type EnrichedAttack } from "@/lib/attack-heatmap";
import { computeReceptionStats, type Match, type MatchEvent, type Team } from "@/lib/volley-store";

export interface CoachFilters { set: string; side: "A" | "B"; player: string; skill: string; rotation: string; zone: string; phase: string; view: string }
export interface EvidenceAlert { id: string; title: string; evidence: string; rule: string; sample: number; period: string }
export interface AlertRules { minimum: number; concentration: number; receptionDrop: number; rotationDeficit: number }
export const defaultRules: AlertRules = { minimum: 8, concentration: 60, receptionDrop: 20, rotationDeficit: 3 };

/** Context is assigned BEFORE filters so removing points cannot change rotation or phase. */
export function eventContexts(match: Match) {
  const contexts = new Map<string, { A: number; B: number; phaseA: string | null; phaseB: string | null }>();
  let set = -1, A = 1, B = 1;
  let serving = match.initialServingSide;
  let phaseA: string | null = null, phaseB: string | null = null;
  for (const ev of [...match.events].sort((a, b) => a.timestamp - b.timestamp)) {
    if (set !== ev.setNumber) { set = ev.setNumber; A = 1; B = 1; serving = set % 2 === 1 ? match.initialServingSide : match.initialServingSide === "A" ? "B" : "A"; phaseA = null; phaseB = null; }
    if ("kind" in ev && (ev.kind === "reception" || ev.kind === "defense")) {
      const phase = ev.kind === "reception" ? "K1" : "K2";
      if (ev.side === "A") phaseA = phase; else phaseB = phase;
    }
    if ("kind" in ev && ev.kind === "attackAttempt" && ev.isCounter) { if (ev.side === "A") phaseA = "K2"; else phaseB = "K2"; }
    if ("type" in ev && ev.type === "counter_attack") { if (ev.playerSide === "A") phaseA = "K2"; else phaseB = "K2"; }
    contexts.set(ev.id, { A, B, phaseA, phaseB });
    if ("scoringSide" in ev) {
      if (ev.scoringSide !== serving) { if (ev.scoringSide === "A") A = A % 6 + 1; else B = B % 6 + 1; serving = ev.scoringSide; }
      phaseA = null; phaseB = null;
    }
  }
  return contexts;
}

export function skillOf(ev: MatchEvent) {
  if ("kind" in ev) return ev.kind === "attackAttempt" ? "attack" : ev.kind;
  if (["attack", "counter_attack", "rotation_attack", "attack_error"].includes(ev.type)) return "attack";
  if (["block", "block_error"].includes(ev.type)) return "block";
  if (["ace", "serve_error"].includes(ev.type)) return "serve";
  return "point";
}

export function filteredEvents(match: Match, filters: CoachFilters): MatchEvent[] {
  const contexts = eventContexts(match);
  return match.events.filter((ev) => {
    const side = "side" in ev ? ev.side : ev.playerSide ?? ev.scoringSide;
    const ctx = contexts.get(ev.id);
    const player = "setterId" in ev ? ev.setterId : "playerId" in ev ? ev.playerId : null;
    const zone = "attackZone" in ev ? typeof ev.attackZone === "string" ? settingZoneToOrigin(ev.attackZone) : ev.attackZone : null;
    return side === filters.side && (filters.set === "all" || ev.setNumber === Number(filters.set)) &&
      (filters.player === "all" || player === filters.player || ("attackerId" in ev && ev.attackerId === filters.player)) &&
      (filters.skill === "all" || skillOf(ev) === filters.skill) &&
      (filters.rotation === "all" || ctx?.[filters.side] === Number(filters.rotation)) &&
      (filters.zone === "all" || zone === Number(filters.zone)) &&
      (filters.phase === "all" || (filters.side === "A" ? ctx?.phaseA : ctx?.phaseB) === filters.phase);
  });
}

export function filteredAttacks(match: Match, a: Team, b: Team, f: CoachFilters): EnrichedAttack[] {
  // An incomplete setting is not an attack; require an observed result before enriching it.
  const eligible = { ...match, events: match.events.filter((e) => !("kind" in e && e.kind === "setting" && !e.attackResult)) };
  const contexts = eventContexts(match);
  return buildEnrichedAttacks(eligible, a, b).map((attack) => {
    const source = match.events.find((e) => e.timestamp === attack.timestamp && ("side" in e ? e.side : e.playerSide) === attack.side);
    const ctx = source ? contexts.get(source.id) : undefined;
    return { ...attack, phase: (attack.side === "A" ? ctx?.phaseA : ctx?.phaseB) === "K1" ? "K1" as const : (attack.side === "A" ? ctx?.phaseA : ctx?.phaseB) === "K2" ? "K2" as const : null };
  }).filter((at) => at.side === f.side && (f.set === "all" || at.setNumber === Number(f.set)) &&
    (f.player === "all" || at.playerId === f.player) && (f.rotation === "all" || at.rotation === Number(f.rotation)) &&
    (f.zone === "all" || at.origin === Number(f.zone)) && (f.phase === "all" || at.phase === f.phase) &&
    (f.skill === "all" || f.skill === "attack"));
}

export function receptionSummary(events: MatchEvent[], side: "A" | "B") {
  const rows = [...computeReceptionStats(events, side).values()];
  const total = rows.reduce((n, r) => n + r.total, 0);
  const positive = rows.reduce((n, r) => n + r.doublePositive + r.positive, 0);
  return { total, positive, positivity: total ? positive / total * 100 : null };
}

export function evidenceAlerts(match: Match, events: MatchEvent[], attacks: EnrichedAttack[], f: CoachFilters, rules: AlertRules): EvidenceAlert[] {
  const period = f.set === "all" ? "Todos los sets seleccionados" : `Set ${f.set}`;
  const out: EvidenceAlert[] = [];
  const agg = aggregateAttacks(attacks, f.side);
  if (agg.total >= rules.minimum && agg.topZone && agg.topZonePct >= rules.concentration) out.push({ id: "zone", title: `Concentración en zona ${agg.topZone}`, sample: agg.total, period, evidence: `${agg.origin[agg.topZone].count}/${agg.total} ataques (${agg.topZonePct}%)`, rule: `≥${rules.concentration}% en una zona; mínimo ${rules.minimum} ataques` });
  const playerCounts = new Map<string, number>();
  for (const at of attacks) if (at.playerId) playerCounts.set(at.playerId, (playerCounts.get(at.playerId) ?? 0) + 1);
  for (const [id, count] of playerCounts) if (attacks.length >= rules.minimum && count / attacks.length * 100 >= rules.concentration) out.push({ id: `player:${id}`, title: "Concentración por atacante", sample: attacks.length, period, evidence: `${count}/${attacks.length} ataques de la misma jugadora`, rule: `≥${rules.concentration}%; mínimo ${rules.minimum} ataques` });
  const contexts = eventContexts(match);
  for (let rotation = 1; rotation <= 6; rotation++) {
    const points = events.filter((e) => "scoringSide" in e && contexts.get(e.id)?.[f.side] === rotation);
    const pf = points.filter((e) => "scoringSide" in e && e.scoringSide === f.side).length;
    const pc = points.length - pf;
    if (points.length >= rules.minimum && pc - pf >= rules.rotationDeficit) out.push({ id: `rotation:${rotation}`, title: `Rotación R${rotation} en desventaja`, sample: points.length, period, evidence: `${pf} puntos a favor / ${pc} en contra`, rule: `Déficit ≥${rules.rotationDeficit}; mínimo ${rules.minimum} rallies` });
  }
  const receptions = events.filter((e) => "kind" in e && e.kind === "reception").sort((a, b) => a.timestamp - b.timestamp);
  if (receptions.length >= rules.minimum * 2) {
    const recent = receptionSummary(receptions.slice(-rules.minimum), f.side), prior = receptionSummary(receptions.slice(-rules.minimum * 2, -rules.minimum), f.side);
    if (prior.positivity !== null && recent.positivity !== null && prior.positivity - recent.positivity >= rules.receptionDrop) out.push({ id: "reception", title: "Baja reciente de recepción positiva", sample: rules.minimum * 2, period, evidence: `${prior.positivity.toFixed(0)}% → ${recent.positivity.toFixed(0)}% en dos ventanas de ${rules.minimum}`, rule: `Caída ≥${rules.receptionDrop} puntos porcentuales` });
  }
  return out;
}