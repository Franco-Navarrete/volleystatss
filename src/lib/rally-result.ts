export type RallyAction =
  | "serve" | "serve_error" | "rotation_attack" | "attack_neutral"
  | "counter_attack" | "counter_neutral" | "attack_error" | "block" | "unforced_error";

export type AttackResult = "serve" | "serve_error" | "point" | "continue" | "block" | "attack_error" | "unforced" | "blocked_by_rival" | "defended";

export function resolveAction(kind: AttackResult, isCounter: boolean): RallyAction {
  if (kind === "serve") return "serve";
  if (kind === "serve_error") return "serve_error";
  // The legacy UI key "block" labels Finta, an attacker-winning shot, not a block.
  if (kind === "block") return isCounter ? "counter_attack" : "rotation_attack";
  if (kind === "unforced") return "unforced_error";
  if (kind === "attack_error" || kind === "blocked_by_rival") return "attack_error";
  if (kind === "defended" || kind === "continue") return isCounter ? "counter_neutral" : "attack_neutral";
  return isCounter ? "counter_attack" : "rotation_attack";
}