"use client";

import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Abre esta pantalla desde el enlace de recuperación enviado a tu correo.",
  );
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasRecoverySession(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(true);
        setMessage("Enlace validado. Ya puedes establecer tu nueva contraseña.");
        setMessageType("info");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!hasRecoverySession) {
      setMessage(
        "No hay sesión de recuperación activa. Solicita un nuevo enlace desde 'Olvidé mi contraseña'.",
      );
      setMessageType("error");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      setMessageType("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("Actualizando contraseña...");
    setMessageType("info");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(translateAuthError(error.message));
      setMessageType("error");
      setLoading(false);
      return;
    }

    // Revoca refresh tokens en todos los dispositivos/sesiones del usuario.
    await supabase.auth.signOut({ scope: "global" });
    setMessage("Contraseña actualizada. Ahora puedes ingresar con la nueva contraseña.");
    setMessageType("success");
    setLoading(false);

    window.setTimeout(() => {
      window.location.href = "/login";
    }, 1200);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--ast-black)] text-[var(--ast-white)] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,86,198,0.35),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(4,164,90,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(1,25,99,0.6),transparent_55%)]" />

      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--ast-sky)]/35 bg-[linear-gradient(180deg,rgba(10,86,198,0.2),rgba(1,25,99,0.38))] backdrop-blur-sm p-7 space-y-5 shadow-2xl">
        <div className="flex justify-center">
          <Image
            src="/logo-astrolab-cobalt.png"
            alt="Astrolab"
            width={210}
            height={39}
            className="h-10 w-auto"
            priority
          />
        </div>
        <h1 className="text-2xl font-black text-center tracking-tight text-[var(--ast-bone)]">
          Restablecer contraseña
        </h1>
        <p className="text-center text-sm text-[var(--ast-bone)]/80">
          Este proceso es independiente del login y signup.
        </p>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <Field
            type="password"
            placeholder="Nueva contraseña"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <Field
            type="password"
            placeholder="Confirmar nueva contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ast-mint)] px-5 py-2.5 text-sm font-bold text-[var(--ast-black)] hover:bg-[var(--ast-forest)] transition disabled:opacity-60"
          >
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            )}
            {loading ? "Procesando..." : "Actualizar contraseña"}
          </button>
        </form>

        {message && (
          <p
            className={`text-sm rounded-lg border px-3 py-2 ${
              messageType === "error"
                ? "text-red-200 border-red-500/40 bg-red-950/30"
                : messageType === "success"
                  ? "text-green-200 border-green-500/40 bg-green-950/30"
                  : "text-blue-100 border-[var(--ast-sky)]/40 bg-[var(--ast-cobalt)]/30"
            }`}
          >
            {message}
          </p>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-[var(--ast-sky)] hover:text-[var(--ast-mint)]"
          >
            Volver a login
          </Link>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
};

function Field({ type, placeholder, value, onChange, autoComplete }: FieldProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      className="w-full rounded-lg border border-[var(--ast-sky)]/20 bg-[var(--ast-indigo)]/30 p-3 text-white placeholder:text-[var(--ast-bone)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--ast-mint)]/60 focus:border-transparent transition"
      required
    />
  );
}

function translateAuthError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("session")) {
    return "La sesión de recuperación expiró. Solicita un nuevo enlace.";
  }
  if (normalized.includes("password should be at least")) {
    return "La contraseña es demasiado corta.";
  }
  return `Error: ${errorMessage}`;
}
