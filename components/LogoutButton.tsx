"use client";

import { useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
  const supabase = useMemo(() => createClient(), []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-gray-400 hover:text-red-400 transition"
    >
      Cerrar Sesión
    </button>
  );
}
