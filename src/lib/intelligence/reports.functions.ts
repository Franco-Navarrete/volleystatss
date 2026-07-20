// Rally Intelligence — server functions para generar y persistir informes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RALLY_SYSTEM_PROMPT, buildUserPrompt } from "./ai/prompt.server";
import type { MatchAnalysis } from "./analysis";
import type { Insight } from "./types";

export interface IntelligenceReport {
  id?: string;
  scope: "match" | "team";
  scopeRef: string;
  title: string;
  insights: Insight[];
  analysis?: MatchAnalysis;
  summaryMd: string;
  model?: string;
  createdAt?: number;
}

// Validación laxa del análisis (solo verificamos que exista y sea versión 1).
const AnalysisSchema = z.object({ version: z.literal(1) }).passthrough();

const GenerateInput = z.object({
  scope: z.enum(["match", "team"]),
  scopeRef: z.string().min(1),
  title: z.string().min(1).max(200),
  analysis: AnalysisSchema,
  /** ID del equipo analizado — obligatorio para validar ownership en backend. */
  teamId: z.string().uuid().optional(),
});

async function assertCanAnalyzeTeam(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  teamId: string | undefined,
) {
  if (!teamId) return; // scope=team libre por ahora; scope=match debería pasarlo.
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return;
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, owner_id")
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!team || team.owner_id !== userId) {
    throw new Error("Permisos insuficientes: no podés analizar este equipo.");
  }
}


const MODEL = "google/gemini-3.5-flash";

export const generateIntelligenceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }): Promise<IntelligenceReport> => {
    await assertCanAnalyzeTeam(context.supabase, context.userId, data.teamId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Falta LOVABLE_API_KEY");

    const analysis = data.analysis as unknown as MatchAnalysis;
    const userPrompt = buildUserPrompt(analysis);

    let summary = "";
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
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
      summary = json.choices?.[0]?.message?.content?.trim() ?? "";
    } catch (e) {
      // Guardamos el informe aunque falle la IA: el análisis visual ya vale por sí solo.
      summary = `_No fue posible generar la síntesis narrativa: ${e instanceof Error ? e.message : "error desconocido"}_`;
    }

    const { data: row, error } = await context.supabase
      .from("intelligence_reports")
      .insert({
        user_id: context.userId,
        scope: data.scope,
        scope_ref: data.scopeRef,
        title: data.title,
        insights: [] as unknown as never,
        analysis: analysis as unknown as never,
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
      insights: [],
      analysis,
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
      .select("id, scope, scope_ref, title, insights, analysis, summary_md, model, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const rowAny = r as unknown as {
        id: string; scope: string; scope_ref: string | null; title: string;
        insights: unknown; analysis: unknown; summary_md: string | null;
        model: string | null; created_at: string;
      };
      return {
        id: rowAny.id,
        scope: (rowAny.scope as "match" | "team") ?? "match",
        scopeRef: rowAny.scope_ref ?? "",
        title: rowAny.title,
        insights: (Array.isArray(rowAny.insights) ? rowAny.insights : []) as Insight[],
        analysis: (rowAny.analysis ?? undefined) as MatchAnalysis | undefined,
        summaryMd: rowAny.summary_md ?? "",
        model: rowAny.model ?? undefined,
        createdAt: new Date(rowAny.created_at).getTime(),
      };
    });
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
