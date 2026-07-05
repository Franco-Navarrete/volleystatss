import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

interface AppStateData {
  teams?: Array<{ id: string; name: string; shortName?: string }>;
  matches?: Array<{
    id: string;
    teamAId: string;
    teamBId: string;
    status: string;
    currentSet: number;
    sets?: Array<{ number: number; scoreA: number; scoreB: number; finished: boolean }>;
    leagueId?: string;
    createdAt?: number;
  }>;
}

export default defineTool({
  name: "list_matches",
  title: "List matches",
  description:
    "List volleyball matches owned by the signed-in RALLY user with scores by set and current status. Filter by status (live/finished/scheduled).",
  inputSchema: {
    status: z.enum(["live", "finished", "scheduled", "all"]).optional().describe("Filter by match status. Default: all."),
    limit: z.number().int().min(1).max(100).optional().describe("Max results (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data, error } = await supabase
      .from("app_state")
      .select("data")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const state = (data?.data ?? {}) as AppStateData;
    const teamName = (id: string) => state.teams?.find((t) => t.id === id)?.name ?? id;
    let matches = (state.matches ?? []).map((m) => ({
      id: m.id,
      teamA: teamName(m.teamAId),
      teamB: teamName(m.teamBId),
      status: m.status,
      currentSet: m.currentSet,
      sets: m.sets ?? [],
      createdAt: m.createdAt,
    }));
    if (status && status !== "all") matches = matches.filter((m) => m.status === status);
    matches.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    if (limit) matches = matches.slice(0, limit);
    else matches = matches.slice(0, 25);
    return {
      content: [{ type: "text", text: JSON.stringify(matches, null, 2) }],
      structuredContent: { matches },
    };
  },
});
