"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ProgressButton({
  labId,
  dayNumber,
}: {
  labId: string;
  dayNumber: number;
}) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkProgress = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("progress")
        .select("*")
        .eq("lab_id", labId)
        .eq("day_number", dayNumber)
        .maybeSingle();

      if (data) setCompleted(true);
      setLoading(false);
    };
    checkProgress();
  }, [labId, dayNumber]);

  const toggleProgress = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (completed) {
      await supabase
        .from("progress")
        .delete()
        .eq("lab_id", labId)
        .eq("day_number", dayNumber)
        .eq("user_id", user.id);
      setCompleted(false);
    } else {
      await supabase
        .from("progress")
        .insert([{ lab_id: labId, day_number: dayNumber, user_id: user.id }]);
      setCompleted(true);
    }
  };

  if (loading)
    return <div className="h-10 w-32 bg-gray-800 animate-pulse rounded"></div>;

  return (
    <button
      onClick={toggleProgress}
      className={`px-6 py-2 rounded-full font-bold transition ${
        completed
          ? "bg-green-600 text-white border-2 border-green-400"
          : "bg-transparent border-2 border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-500"
      }`}
    >
      {completed ? "✅ ¡Completado!" : "Marcar como terminado"}
    </button>
  );
}
