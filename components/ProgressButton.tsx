"use client";

import { useState } from "react";

export default function ProgressButton({
  labId,
  dayNumber,
  initialCompleted,
  onCompleted,
}: {
  labId: string;
  dayNumber: number;
  initialCompleted: boolean;
  onCompleted?: (dayNumber: number) => void;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const markAsCompleted = async () => {
    if (completed || saving) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, dayNumber }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar tu progreso");
        return;
      }

      setCompleted(true);
      onCompleted?.(dayNumber);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={markAsCompleted}
        disabled={completed || saving}
        className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${
          completed
            ? "border border-[var(--ast-mint)]/65 bg-[rgba(4,73,44,0.66)] text-[var(--ast-bone)]"
            : "bg-transparent border border-[var(--ast-sky)]/35 text-[var(--ast-sky)]/90 hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
        } ${saving ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        {completed ? "Completado" : saving ? "Guardando..." : "Marcar como terminado"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
