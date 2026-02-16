import { supabase } from "@/lib/supabaseClient";

export async function requireRole(role: "ADMIN" | "CASHIER") {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (!session) return { ok: false, reason: "NO_SESSION" as const };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", session.user.id)
    .single();

  if (error || !profile) return { ok: false, reason: "NO_PROFILE" as const };

  if (profile.role !== role) return { ok: false, reason: "FORBIDDEN" as const };

  return { ok: true, session };
}
