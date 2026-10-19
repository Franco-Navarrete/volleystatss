import { describe, expect, it } from "vitest";
import { resolveAction } from "./rally-result";
import { useVolley } from "./volley-store";

describe("Finta closes the rally with an attacking point", () => {
  it("scores a winning attack after reception", () => {
    expect(resolveAction("block", false)).toBe("rotation_attack");
  });
  it("scores a winning counterattack after defense", () => {
    expect(resolveAction("block", true)).toBe("counter_attack");
  });
  it("adds exactly one point for the attacker rather than an ongoing attack attempt", () => {
    const previous = useVolley.getState();
    try {
      useVolley.setState({ teams: [], matches: [], leagues: [] });
      const id = useVolley.getState().seedDemoMatch();
      const source = useVolley.getState().matches.find(match => match.id === id);
      if (!source) throw new Error("Test match missing");
      const match = { ...source, status: "live" as const, events: [], currentSet: 1,
        sets: [{ number: 1, scoreA: 0, scoreB: 0, finished: false }] };
      useVolley.setState({ matches: [match] });
      useVolley.getState().recordPoint(match.id, "A", resolveAction("block", false), match.onCourtA[0]);
      const result = useVolley.getState().matches[0];
      expect(result.sets[0].scoreA).toBe(1);
      expect(result.sets[0].scoreB).toBe(0);
      expect(result.events.filter(event => event.kind === "point")).toHaveLength(1);
      expect(result.events.filter(event => event.kind === "attackAttempt")).toHaveLength(0);
    } finally {
      useVolley.setState(previous);
    }
  });
});