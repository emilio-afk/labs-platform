import { useState } from "react";
import type { createClient } from "@/utils/supabase/client";

type SupabaseClient = ReturnType<typeof createClient>;

export function useHeroTab(
  supabase: SupabaseClient,
  initialTitle: string,
  initialSubtitle: string,
) {
  const [heroTitle, setHeroTitle] = useState(initialTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(initialSubtitle);
  const [heroMsg, setHeroMsg] = useState("");

  const saveHeroSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHeroMsg("Guardando portada...");

    const { error } = await supabase.from("app_settings").upsert(
      [{ id: 1, hero_title: heroTitle.trim(), hero_subtitle: heroSubtitle.trim() }],
      { onConflict: "id" },
    );

    if (error) {
      setHeroMsg("Error: " + error.message);
      return;
    }

    setHeroMsg("Portada guardada");
  };

  return { heroTitle, setHeroTitle, heroSubtitle, setHeroSubtitle, heroMsg, saveHeroSettings };
}
