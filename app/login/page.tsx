"use client";

import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { useMemo, useState } from "react";

type AuthMode = "login" | "signup" | "recover";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );

  const subtitle =
    mode === "login"
      ? "Ingresa para continuar tu progreso."
      : mode === "signup"
        ? "Crea tu cuenta para desbloquear labs y guardar avance."
        : "Te enviaremos un enlace seguro para restablecer tu contraseña.";

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
        "Ese correo ya existe. Intenta ingresar o recuperar contraseña.",
      );
      setLoading(false);
      return;
    }

    setUiMessage(
      "success",
      "Cuenta creada. Revisa tu correo para confirmar tu cuenta.",
    );
    setMode("login");
    setConfirmPassword("");
    setLoading(false);
  };

  const handleSendRecovery = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      setUiMessage("error", "Escribe tu correo para enviar la recuperación.");
      return;
    }

    setLoading(true);
    setUiMessage("info", "Enviando enlace de recuperación...");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });

    if (error) {
      setUiMessage("error", translateAuthError(error.message));
      setLoading(false);
      return;
    }

    setUiMessage(
      "success",
      "Listo. Revisa tu correo y abre el enlace para cambiar contraseña en una pantalla separada.",
    );
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--ast-black)] text-[var(--ast-white)] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,86,198,0.35),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(4,164,90,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(1,25,99,0.6),transparent_55%)]" />

      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--ast-sky)]/35 bg-[linear-gradient(180deg,rgba(10,86,198,0.2),rgba(1,25,99,0.38))] backdrop-blur-sm p-7 space-y-5 shadow-2xl transition-all duration-300">
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
          Bienvenido
        </h1>
        <p className="text-center text-sm text-[var(--ast-bone)]/80">{subtitle}</p>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--ast-indigo)]/35 p-1 border border-[var(--ast-sky)]/25">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "login"
                ? "bg-[var(--ast-mint)] text-[var(--ast-black)]"
                : "text-[var(--ast-bone)]/80 hover:bg-[var(--ast-sky)]/10"
            }`}
            onClick={() => setMode("login")}
          >
            Ingresar
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "signup"
                ? "bg-[var(--ast-mint)] text-[var(--ast-black)]"
                : "text-[var(--ast-bone)]/80 hover:bg-[var(--ast-sky)]/10"
            }`}
            onClick={() => setMode("signup")}
          >
            Crear cuenta
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === "recover"
                ? "bg-[var(--ast-mint)] text-[var(--ast-black)]"
                : "text-[var(--ast-bone)]/80 hover:bg-[var(--ast-sky)]/10"
            }`}
            onClick={() => setMode("recover")}
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
                onClick={() => setMode("recover")}
                className="text-sm text-[var(--ast-sky)] hover:text-[var(--ast-mint)] transition"
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

        {mode === "recover" && (
          <form
            onSubmit={handleSendRecovery}
            className="space-y-4 animate-[fadeIn_.25s_ease]"
          >
            <Field
              type="email"
              placeholder="Correo para recuperar"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <p className="text-xs text-[var(--ast-bone)]/70">
              Te enviaremos una liga para restablecer contraseña en una pantalla
              separada.
            </p>
            <SubmitButton loading={loading} label="Enviar enlace de recuperación" fullWidth />
          </form>
        )}

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
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ast-mint)] px-5 py-2.5 text-sm font-bold text-[var(--ast-black)] hover:bg-[var(--ast-forest)] transition disabled:opacity-60 ${
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
