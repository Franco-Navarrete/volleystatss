import { describe, it, expect } from "vitest";
import { validateLiveMatch, sportingTeam, type LiveSnapshot } from "./live-contract";
import { eventContexts, filteredEvents, filteredAttacks, evidenceAlerts, defaultRules, rotationEvidence, type CoachFilters } from "./live-analytics";
import type { Match, Team } from "../volley-store";

const team = (id: string): Team => ({ id, name: id, shortName: id, color: "coral", players: Array.from({ length: 6 }, (_, i) => ({ id: `${id}${i}`, number: i + 1, name: `${id}${i}`, birthDate: "2000-01-01" })) });
const A = team("A"), B = team("B");
const match = (): Match => ({ id: "test", teamAId: "A", teamBId: "B", startingLineupA: A.players.map((p) => p.id), startingLineupB: B.players.map((p) => p.id), onCourtA: A.players.map((p) => p.id), onCourtB: B.players.map((p) => p.id), status: "live", currentSet: 1, setsToWin: 3, pointsPerSet: 25, sets: [{ number: 1, scoreA: 0, scoreB: 0, finished: false }], events: [], servingSide: "A", initialServingSide: "A", scheduledAt: 0, createdAt: 0 });
const snapshot = (m: Match): LiveSnapshot => ({ match: m, teamA: A, teamB: B });
const filters: CoachFilters = { set: "all", side: "A", player: "all", skill: "all", rotation: "all", zone: "all", phase: "all", view: "summary" };

describe("shared scouting rules", () => {
  it("recomputes official score rather than trusting the device", () => {
    const m = match(); m.sets[0].scoreA = 99;
    m.events.push({ id: "p", playerSide: "A", scoringSide: "A", playerId: "A0", type: "attack", setNumber: 1, timestamp: 1 });
    expect(validateLiveMatch(m, snapshot(match())).sets[0].scoreA).toBe(1);
  });
  it("rejects repeated event IDs instead of counting a second point", () => {
    const m = match(); const e = { id: "same", playerSide: "A" as const, scoringSide: "A" as const, playerId: "A0", type: "attack" as const, setNumber: 1, timestamp: 1 }; m.events = [e, e];
    expect(() => validateLiveMatch(m, snapshot(match()))).toThrow("duplicada");
  });
  it("rejects players belonging to the other team", () => {
    const m = match(); m.events = [{ id: "r", kind: "reception", side: "A", playerId: "B0", rating: "positive", setNumber: 1, timestamp: 1 }];
    expect(() => validateLiveMatch(m, snapshot(match()))).toThrow("no pertenece");
  });
  it("keeps finished terminal", () => { const old = match(); old.status = "finished"; expect(validateLiveMatch(match(), snapshot(old)).status).toBe("finished"); });
  it("strips arbitrary private properties from shared matches and events", () => {
    const m = match();
    const result = validateLiveMatch({ ...m, secret: "private", events: [{ id: "p", playerSide: "A", scoringSide: "A", playerId: "A0", type: "attack", setNumber: 1, timestamp: 1, privateEmail: "private" }] }, snapshot(m));
    expect(result).not.toHaveProperty("secret"); expect(result.events[0]).not.toHaveProperty("privateEmail");
  });
  it("rejects a blocker from the attacking team", () => {
    const m = match(); m.events = [{ id: "p", playerSide: "A", scoringSide: "A", playerId: "A0", type: "attack", setNumber: 1, timestamp: 1, rivalBlockerId: "A1" }];
    expect(() => validateLiveMatch(m, snapshot(match()))).toThrow("rival ajena");
  });
  it("does not expose birth dates in a live roster", () => { expect(sportingTeam(A).players[0]).not.toHaveProperty("birthDate"); });
  it("recalculates a correction and an annulment", () => {
    const m = match(); m.events = [{ id: "p", playerSide: "A", scoringSide: "A", playerId: "A0", type: "attack", setNumber: 1, timestamp: 1 }];
    const corrected = { ...m, events: [{ ...m.events[0], playerSide: "B" as const, scoringSide: "B" as const, playerId: "B0" }] };
    expect(validateLiveMatch(corrected, snapshot(m)).sets[0].scoreB).toBe(1);
    expect(validateLiveMatch({ ...m, events: [] }, snapshot(m)).sets[0].scoreA).toBe(0);
  });
});

describe("tactical evidence", () => {
  it("counts both sides' points at the selected team's rotation", () => {
    const m = match(); m.events = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, scoringSide: "B" as const, playerSide: "B" as const, playerId: "B0", type: "attack" as const, setNumber: 1, timestamp: i }));
    expect(rotationEvidence(m, filters)[0]).toEqual({ rotation: 1, sample: 3, pf: 0, pc: 3 });
    expect(rotationEvidence(m, { ...filters, set: "2" })[0].sample).toBe(0);
  });
  it("does not infer K2 from an omitted defense", () => {
    const m = match(); m.events = [{ id: "d", kind: "defense", side: "A", playerId: "A0", rating: "neutral", setNumber: 1, timestamp: 1 }, { id: "a", kind: "attackAttempt", side: "A", playerId: "A0", attackZone: 4, setNumber: 1, timestamp: 2 }];
    expect(filteredAttacks(m, A, B, filters)[0].phase).toBeNull();
  });
  it("assigns rotation before filtering the point sequence", () => {
    const m = match(); m.events = [{ id: "p1", scoringSide: "B", playerSide: "B", playerId: "B0", type: "attack", setNumber: 1, timestamp: 1 }, { id: "p2", scoringSide: "A", playerSide: "A", playerId: "A0", type: "attack", setNumber: 1, timestamp: 2 }, { id: "r", kind: "reception", side: "A", playerId: "A1", rating: "positive", setNumber: 1, timestamp: 3 }];
    expect(eventContexts(m).get("r")?.A).toBe(2);
    expect(filteredEvents(m, { ...filters, rotation: "2", skill: "reception" }).map((e) => e.id)).toEqual(["r"]);
  });
  it("separates reception K1 and defense K2", () => {
    const m = match(); m.events = [{ id: "r", kind: "reception", side: "A", playerId: "A0", rating: "positive", setNumber: 1, timestamp: 1 }, { id: "a", kind: "attackAttempt", side: "A", playerId: "A0", attackZone: 4, setNumber: 1, timestamp: 2 }, { id: "d", kind: "defense", side: "A", playerId: "A0", rating: "controlled", setNumber: 1, timestamp: 3 }, { id: "a2", kind: "attackAttempt", side: "A", playerId: "A0", attackZone: 4, isCounter: true, setNumber: 1, timestamp: 4 }];
    expect(filteredAttacks(m, A, B, { ...filters, phase: "K1" })).toHaveLength(1);
    expect(filteredAttacks(m, A, B, { ...filters, phase: "K2" })).toHaveLength(1);
  });
  it("does not count an incomplete setting as an observed attack", () => {
    const m = match(); m.events = [{ id: "s", kind: "setting", side: "A", setterId: "A0", quality: "+", attackZone: "z3", setNumber: 1, timestamp: 1 }];
    expect(filteredAttacks(m, A, B, filters)).toHaveLength(0);
  });
  it("requires the configured minimum sample for a concentration alert", () => {
    const m = match(); const attacks = Array.from({ length: defaultRules.minimum - 1 }, (_, i) => ({ side: "A" as const, playerId: "A0", origin: 4 as const, direction: null, subzone: null, result: "positive" as const, setNumber: 1, rotation: 1, setterZone: null, phase: "K1" as const, timestamp: i }));
    expect(evidenceAlerts(m, [], attacks, filters, defaultRules)).toHaveLength(0);
    const withMinimum = [...attacks, { ...attacks[0], timestamp: 99 }];
    expect(evidenceAlerts(m, [], withMinimum, filters, defaultRules).find((a) => a.id === "zone")?.sample).toBe(8);
  });
});