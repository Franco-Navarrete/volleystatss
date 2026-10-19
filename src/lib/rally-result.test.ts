import { describe, expect, it } from "vitest";
import { resolveAction } from "./rally-result";

describe("Finta closes the rally with an attacking point", () => {
  it("scores a winning attack after reception", () => {
    expect(resolveAction("block", false)).toBe("rotation_attack");
  });
  it("scores a winning counterattack after defense", () => {
    expect(resolveAction("block", true)).toBe("counter_attack");
  });
});