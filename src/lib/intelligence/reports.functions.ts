// Rally Intelligence — server functions para generar y persistir informes.
// Solo declaraciones createServerFn + imports. Helpers viven en *.server.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RALLY_SYSTEM_PROMPT, buildUserPrompt } from "./ai/prompt.server";
import type { Insight, IntelligenceReport } from "./types";

const InsightSchema = z.object({
  id: z.string(),
  category: z.enum(["attack", "reception", "serve", "setting", "block", "rotation"]),
  severity: z.enum(["info", "positive", "warning", "critical"]),
  title: z.string(),
  detail: z.string(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  playerId: z.string().optional(),
  rotation: z.number().optional(),
});

const GenerateInput = z.object({
  scope: z.enum(["match", "team"]),
  scopeRef: z.string().min(1),
  title: z.string().min(1).max(200),
  insights: z.array(InsightSchema).max(200),
});

const MODEL = "google/gemini-3.5-flash";

export const generateIntelligenceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }): Promise<IntelligenceReport> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Falta LOVABLE_API_KEY");

    const insights = data.insights as Insight[];
    const userPrompt = buildUserPrompt(data.title, insights);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: RALLY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Límite de IA alcanzado. Intentá nuevamente en unos minutos.");
      if (res.status === 402) throw new Error("Sin créditos de IA en el workspace.");
      throw new Error(`Error de IA (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const summary = json.choices?.[0]?.message?.content?.trim() ?? "";

    const { data: row, error } = await context.supabase
      .from("intelligence_reports")
      .insert({
        user_id: context.userId,
        scope: data.scope,
        scope_ref: data.scopeRef,
        title: data.title,
        insights: insights as unknown as never,
        summary_md: summary,
        model: MODEL,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id,
      scope: data.scope,
      scopeRef: data.scopeRef,
      title: data.title,
      insights,
      summaryMd: summary,
      model: MODEL,
      createdAt: new Date(row.created_at).getTime(),
    };
  });

export const listIntelligenceReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntelligenceReport[]> => {
    const { data, error } = await context.supabase
      .from("intelligence_reports")
      .select("id, scope, scope_ref, title, insights, summary_md, model, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      scope: r.scope as "match" | "team",
      scopeRef: r.scope_ref ?? "",
      title: r.title,
      insights: (r.insights ?? []) as unknown as Insight[],
      summaryMd: r.summary_md ?? "",
      model: r.model ?? undefined,
      createdAt: new Date(r.created_at).getTime(),
    }));
  });

export const deleteIntelligenceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("intelligence_reports")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
