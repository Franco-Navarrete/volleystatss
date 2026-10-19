import { describe, expect, it } from "vitest";
import { hasManagedMatchTeam } from "./scouting-access";

describe("managed scouting teams", () => {
  const match = { teamAId: "barrio-parque", teamBId: "rival" };
  it("recognizes the coach's assigned club team without transferring ownership", () => {
    expect(hasManagedMatchTeam("coach", match, [{ id: "barrio-parque", ownerId: "admin" }], [
      { id: "barrio-parque", ownerId: "admin", managesDirectly: true },
    ])).toBe(true);
  });
  it("does not treat visible unrelated teams as assigned", () => {
    expect(hasManagedMatchTeam("coach", match, [], [
      { id: "barrio-parque", managesDirectly: false },
      { id: "other-club", managesDirectly: true },
    ])).toBe(false);
  });
  it("does not grant access without a signed-in user", () => {
    expect(hasManagedMatchTeam(undefined, match, [], [{ id: "barrio-parque", managesDirectly: true }])).toBe(false);
  });
});