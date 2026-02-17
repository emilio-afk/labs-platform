import AdminPanel, { type AdminLab } from "@/components/AdminPanel";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

type SiteSettings = {
  hero_title: string | null;
  hero_subtitle: string | null;
};

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
  const { data: settings } = (await supabase
    .from("app_settings")
    .select("hero_title, hero_subtitle")
    .eq("id", 1)
    .maybeSingle()) as { data: SiteSettings | null };

  return (
    <AdminPanel
      initialLabs={(labs as AdminLab[] | null) ?? []}
      initialHeroTitle={settings?.hero_title ?? ""}
      initialHeroSubtitle={settings?.hero_subtitle ?? ""}
    />
  );
}
