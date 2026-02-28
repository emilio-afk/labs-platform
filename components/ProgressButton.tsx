"use client";

import { useEffect, useState } from "react";

export default function ProgressButton({
  labId,
  dayNumber,
  initialCompleted,
  onProgressChange,
}: {
  labId: string;
  dayNumber: number;
  initialCompleted: boolean;
  onProgressChange?: (dayNumber: number, completed: boolean) => void;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCompleted(initialCompleted);
  }, [initialCompleted]);

  const toggleCompleted = async () => {
    if (saving) return;
    const nextCompleted = !completed;

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, dayNumber, completed: nextCompleted }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar tu progreso");
        return;
      }

      setCompleted(nextCompleted);
      onProgressChange?.(dayNumber, nextCompleted);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={toggleCompleted}
        disabled={saving}
        className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${
          completed
            ? "border border-[var(--ast-sky)]/55 bg-[rgba(7,68,168,0.34)] text-[var(--ast-sky)] hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
            : "bg-transparent border border-[var(--ast-sky)]/35 text-[var(--ast-sky)]/90 hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
        } ${saving ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        {saving
          ? "Guardando..."
          : completed
            ? "Marcar como pendiente"
            : "Marcar como terminado"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
