import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

interface AppStateData {
  teams?: Array<{
    id: string;
    name: string;
    shortName?: string;
    color?: string;
    players?: Array<{ id: string; name: string; number: number; position?: string }>;
    category?: string;
  }>;
}

export default defineTool({
  name: "list_teams",
  title: "List teams",
  description:
    "List all volleyball teams owned by the signed-in RALLY user. Returns name, short name, category, and roster size.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
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
    const teams = (state.teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      category: t.category,
      color: t.color,
      players: t.players?.length ?? 0,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(teams, null, 2) }],
      structuredContent: { teams },
    };
  },
});
