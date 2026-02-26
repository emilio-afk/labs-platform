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
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--ui-bg)] px-4 py-8 text-[var(--ui-text)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,86,198,0.36),transparent_42%),radial-gradient(circle_at_85%_20%,rgba(4,164,90,0.22),transparent_34%),linear-gradient(180deg,rgba(1,25,99,0.35),rgba(1,25,99,0.65))]" />

      <div className="relative w-full max-w-lg space-y-5 rounded-2xl border border-[var(--ui-border)] bg-[linear-gradient(165deg,rgba(10,21,52,0.94),rgba(5,14,34,0.96))] p-7 shadow-[0_24px_44px_rgba(2,7,21,0.5)]">
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
        <h1 className="text-center font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-tight text-[var(--ui-text)]">
          Restablecer contraseña
        </h1>
        <p className="text-center text-sm text-[var(--ui-muted)]">
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--ui-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)] disabled:opacity-60"
          >
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {loading ? "Procesando..." : "Actualizar contraseña"}
          </button>
        </form>

        {message && (
          <p
            className={`text-sm rounded-lg border px-3 py-2 ${
              messageType === "error"
                ? "border-red-400/45 bg-red-950/30 text-red-200"
                : messageType === "success"
                  ? "border-emerald-400/45 bg-emerald-950/30 text-emerald-200"
                  : "border-[var(--ast-sky)]/45 bg-[rgba(10,86,198,0.24)] text-[var(--ast-sky)]"
            }`}
          >
            {message}
          </p>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-[var(--ui-secondary)] hover:text-[var(--ui-accent)]"
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
      className="w-full rounded-lg border border-[var(--ui-border)] bg-[rgba(2,9,24,0.72)] p-3 text-[var(--ui-text)] placeholder:text-[var(--ui-muted)] transition focus:border-[var(--ui-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/25"
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
