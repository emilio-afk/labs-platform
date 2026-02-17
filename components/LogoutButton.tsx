"use client";

import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Forzamos el refresco para que el servidor vea que ya no hay usuario
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
