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
            ? "bg-green-700 text-white border border-green-400/70"
            : "bg-transparent border border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-500"
        } ${saving ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        {completed ? "Completado" : saving ? "Guardando..." : "Marcar como terminado"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
