import { createFileRoute } from "@tanstack/react-router";

// Temporary bootstrap endpoint: creates the first admin account.
// It refuses to run once an admin already exists.
export const Route = createFileRoute("/api/seed-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { email, password } = (await request.json()) as {
          email?: string;
          password?: string;
        };
        if (!email || !password) {
          return Response.json({ error: "missing credentials" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: existing } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("role", "admin")
          .limit(1);
        if (existing && existing.length > 0) {
          return Response.json({ error: "admin already exists" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) {
          return Response.json({ error: error?.message ?? "create failed" }, { status: 400 });
        }

        await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
        await supabaseAdmin.from("profiles").insert({ id: data.user.id, email });

        return Response.json({ ok: true, userId: data.user.id });
      },
    },
  },
});
