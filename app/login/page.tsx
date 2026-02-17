"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async () => {
    setLoading(true);
    // Registro simple
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("¡Usuario creado! Intenta iniciar sesión.");
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Error: " + error.message);
      setLoading(false);
    } else {
      // CAMBIO CLAVE: Usamos window.location.href en lugar de router.push
      // Esto obliga al navegador a recargar todo y enviar las nuevas credenciales al servidor
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="w-full max-w-md space-y-4 border border-gray-800 p-8 rounded-lg">
        <h1 className="text-2xl font-bold text-center">Bienvenido a LABS</h1>

        <input
          type="email"
          placeholder="Tu correo"
          className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex gap-4 pt-4">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="flex-1 bg-white text-black py-2 rounded hover:bg-gray-200 transition"
          >
            {loading ? "..." : "Entrar"}
          </button>

          <button
            onClick={handleSignup}
            disabled={loading}
            className="flex-1 bg-gray-800 text-white py-2 rounded hover:bg-gray-700 transition"
          >
            Registrarse
          </button>
        </div>

        {message && (
          <p className="text-center text-sm text-yellow-400 mt-4">{message}</p>
        )}
      </div>
    </div>
  );
}
