import AdminPanel, { type AdminLab } from "@/components/AdminPanel";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const { data: labs } = await supabase
    .from("labs")
    .select("id, title, description, created_at")
    .order("created_at", { ascending: false });

  return <AdminPanel initialLabs={(labs as AdminLab[] | null) ?? []} />;
}
