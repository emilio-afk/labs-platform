import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
      user: null,
      admin: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }),
      user: null,
      admin: null,
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      error: NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 },
      ),
      user: null,
      admin: null,
    };
  }

  return { error: null, user, admin };
}
