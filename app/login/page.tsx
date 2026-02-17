"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useMemo, useState } from "react";

type AuthMode = "login" | "signup" | "reset";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const initialMode: AuthMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "reset"
      ? "reset"
      : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    initialMode === "reset"
      ? "Abre el enlace del correo de recuperación y luego define tu nueva contraseña aquí."
      : "",
  );
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsRecoverySession(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setIsRecoverySession(true);
        setMessage("Sesión de recuperación detectada. Define tu nueva contraseña.");
        setMessageType("info");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const setUiMessage = (type: "success" | "error" | "info", text: string) => {
    setMessageType(type);
    setMessage(text);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setUiMessage("info", "Iniciando sesión...");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setUiMessage("error", translateAuthError(error.message));
      setLoading(false);
      return;
    }

    setUiMessage("success", "Sesión iniciada. Redirigiendo...");
    window.location.href = "/";
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setUiMessage("error", "El nombre es obligatorio.");
      return;
    }
    if (password.length < 8) {
      setUiMessage("error", "La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setUiMessage("error", "Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setUiMessage("info", "Creando cuenta...");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
        data: {
          full_name: fullName.trim(),
          company: company.trim(),
          job_title: jobTitle.trim(),
        },
      },
    });

    if (error) {
      setUiMessage("error", translateAuthError(error.message));
      setLoading(false);
      return;
    }

    const identities = (data.user as { identities?: unknown[] } | null)
      ?.identities;
    if (Array.isArray(identities) && identities.length === 0) {
      setUiMessage(
        "error",
        "Ese correo ya existe. Intenta ingresar o usa 'Olvidé mi contraseña'.",
      );
      setLoading(false);
      return;
    }

    setUiMessage(
      "success",
      "Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego inicia sesión.",
    );
    setMode("login");
    setConfirmPassword("");
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setUiMessage("error", "Escribe primero tu correo para enviar la recuperación.");
      return;
    }

    setLoading(true);
    setUiMessage("info", "Enviando correo de recuperación...");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/login?mode=reset`
          : undefined,
    });

    if (error) {
      setUiMessage("error", translateAuthError(error.message));
      setLoading(false);
      return;
    }

    setUiMessage(
      "success",
      "Correo enviado. Revisa tu bandeja y abre el enlace para cambiar tu contraseña.",
    );
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isRecoverySession) {
      setUiMessage(
        "error",
        "No hay sesión de recuperación activa. Abre el enlace que te llegó por correo.",
      );
      return;
    }
    if (newPassword.length < 8) {
      setUiMessage("error", "La nueva contraseña debe tener mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setUiMessage("error", "Las nuevas contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    setUiMessage("info", "Actualizando contraseña...");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setUiMessage("error", translateAuthError(error.message));
      setLoading(false);
      return;
    }

    setUiMessage("success", "Contraseña actualizada. Ya puedes ingresar.");
    setMode("login");
    setNewPassword("");
    setNewPasswordConfirm("");
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--ast-black)] text-[var(--ast-white)] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(4,164,90,0.15),transparent_40%),radial-gradient(circle_at_bottom,rgba(11,25,99,0.4),transparent_45%)]" />

      <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-black/55 backdrop-blur-sm p-7 space-y-5 shadow-2xl transition-all duration-300">
        <h1 className="text-2xl font-black text-center tracking-tight">
          Bienvenido a ASTROLAB
        </h1>
        <p className="text-center text-sm text-gray-300">
          Ingresa o crea tu cuenta para guardar progreso y desbloquear labs.
        </p>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "login"
                ? "bg-[var(--ast-yellow)] text-[var(--ast-black)]"
                : "text-gray-300 hover:bg-white/10"
            }`}
            onClick={() => setMode("login")}
          >
            Ingresar
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "signup"
                ? "bg-[var(--ast-yellow)] text-[var(--ast-black)]"
                : "text-gray-300 hover:bg-white/10"
            }`}
            onClick={() => setMode("signup")}
          >
            Crear cuenta
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "reset"
                ? "bg-[var(--ast-yellow)] text-[var(--ast-black)]"
                : "text-gray-300 hover:bg-white/10"
            }`}
            onClick={() => setMode("reset")}
          >
            Recuperar
          </button>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4 animate-[fadeIn_.25s_ease]">
            <Field
              type="email"
              placeholder="Tu correo"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                className="text-sm text-[var(--ast-sky)] hover:text-white transition"
                disabled={loading}
              >
                Olvidé mi contraseña
              </button>
              <SubmitButton loading={loading} label="Entrar" />
            </div>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4 animate-[fadeIn_.25s_ease]">
            <Field
              type="text"
              placeholder="Nombre completo"
              value={fullName}
              onChange={setFullName}
              autoComplete="name"
            />
            <Field
              type="text"
              placeholder="Empresa"
              value={company}
              onChange={setCompany}
              autoComplete="organization"
            />
            <Field
              type="text"
              placeholder="Cargo (opcional)"
              value={jobTitle}
              onChange={setJobTitle}
              autoComplete="organization-title"
            />
            <Field
              type="email"
              placeholder="Correo"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              type="password"
              placeholder="Contraseña (mínimo 8)"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <Field
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            <SubmitButton loading={loading} label="Crear cuenta" fullWidth />
          </form>
        )}

        {mode === "reset" && (
          <form
            onSubmit={handleResetPassword}
            className="space-y-4 animate-[fadeIn_.25s_ease]"
          >
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
              value={newPasswordConfirm}
              onChange={setNewPasswordConfirm}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-400">
              Si llegaste aquí desde el correo de recuperación, esta acción actualiza tu
              contraseña de inmediato.
            </p>
            <SubmitButton loading={loading} label="Actualizar contraseña" fullWidth />
          </form>
        )}

        {message && (
          <p
            className={`text-sm rounded-lg border px-3 py-2 ${
              messageType === "error"
                ? "text-red-200 border-red-500/40 bg-red-950/30"
                : messageType === "success"
                  ? "text-green-200 border-green-500/40 bg-green-950/30"
                  : "text-blue-100 border-blue-500/40 bg-blue-950/30"
            }`}
          >
            {message}
          </p>
        )}
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
      className="w-full rounded-lg border border-white/15 bg-black/50 p-3 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--ast-emerald)]/60 focus:border-transparent transition"
      required={type !== "text" || !placeholder.toLowerCase().includes("opcional")}
    />
  );
}

type SubmitButtonProps = {
  loading: boolean;
  label: string;
  fullWidth?: boolean;
};

function SubmitButton({ loading, label, fullWidth = false }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ast-yellow)] px-5 py-2.5 text-sm font-bold text-[var(--ast-black)] hover:opacity-90 transition disabled:opacity-60 ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
      )}
      {loading ? "Procesando..." : label}
    </button>
  );
}

function translateAuthError(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return "Correo o contraseña incorrectos.";
  }
  if (normalized.includes("user already registered")) {
    return "Ese correo ya está registrado.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Tu correo aún no está confirmado. Revisa tu bandeja.";
  }
  if (normalized.includes("password should be at least")) {
    return "La contraseña es demasiado corta.";
  }
  if (normalized.includes("unable to validate email address")) {
    return "El correo no es válido.";
  }
  return `Error: ${errorMessage}`;
}
