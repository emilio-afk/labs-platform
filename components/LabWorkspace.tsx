"use client";

import { useEffect, useMemo, useState } from "react";
import LabContent from "@/components/LabContent";
import ProgressBar from "@/components/ProgressBar";

export type WorkspaceDay = {
  id: string;
  lab_id: string;
  day_number: number;
  title: string;
  video_url: string | null;
  content: string | null;
};

type LabWorkspaceProps = {
  labId: string;
  days: WorkspaceDay[];
  initialDayNumber: number;
  completedDayNumbers: number[];
  previewMode?: boolean;
};

export default function LabWorkspace({
  labId,
  days,
  initialDayNumber,
  completedDayNumbers,
  previewMode = false,
}: LabWorkspaceProps) {
  const defaultDay = days[0]?.day_number ?? 1;
  const [currentDayNumber, setCurrentDayNumber] = useState(() => {
    const exists = days.some((d) => d.day_number === initialDayNumber);
    return exists ? initialDayNumber : defaultDay;
  });
  const [completedDays, setCompletedDays] = useState<number[]>(
    Array.from(new Set(completedDayNumbers)),
  );
  const [previewNotice, setPreviewNotice] = useState("");

  const currentDay = useMemo(
    () => days.find((d) => d.day_number === currentDayNumber),
    [currentDayNumber, days],
  );

  const handleSelectDay = (dayNumber: number) => {
    if (previewMode && dayNumber > 1) {
      setPreviewNotice("Solo puedes ver el Día 1 en modo vista previa.");
      return;
    }
    if (dayNumber === currentDayNumber) return;
    setCurrentDayNumber(dayNumber);
    setPreviewNotice("");
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/labs/${labId}?day=${dayNumber}`);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const nextDay = Number.parseInt(url.searchParams.get("day") ?? "", 10);
      if (!Number.isFinite(nextDay)) return;
      if (previewMode && nextDay > 1) {
        setCurrentDayNumber(1);
        return;
      }
      if (!days.some((d) => d.day_number === nextDay)) return;
      setCurrentDayNumber(nextDay);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [days, previewMode]);

  const handleDayCompleted = (dayNumber: number) => {
    setCompletedDays((prev) => {
      if (prev.includes(dayNumber)) return prev;
      return [...prev, dayNumber];
    });
  };

  return (
    <>
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-xl font-bold mb-4">Módulos</h2>
        {previewMode && previewNotice && (
          <p className="text-xs text-[var(--ast-yellow)]">{previewNotice}</p>
        )}
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleSelectDay(d.day_number)}
            className={`w-full p-4 mb-3 rounded-lg border transition text-left ${currentDayNumber === d.day_number ? "border-[var(--ast-mint)] bg-[color:rgba(4,73,44,0.5)]" : "border-gray-800 bg-gray-900 hover:border-gray-600"} ${previewMode && d.day_number > 1 ? "opacity-65" : ""}`}
          >
            <div className="flex items-center">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold ${currentDayNumber === d.day_number ? "bg-[var(--ast-mint)] text-black" : "bg-gray-800 text-[var(--ast-sky)]"}`}
              >
                {d.day_number}
              </span>
              <span className="font-medium flex-1">{d.title}</span>
              {previewMode && d.day_number > 1 && (
                <span className="text-[10px] uppercase tracking-wider text-[var(--ast-yellow)]">
                  Bloqueado
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="lg:col-span-2 space-y-6">
        {currentDay ? (
          <>
            {!previewMode && (
              <ProgressBar completed={completedDays.length} total={days.length} />
            )}
            <LabContent
              key={currentDay.id}
              currentDay={currentDay}
              labId={labId}
              initialCompleted={completedDays.includes(currentDay.day_number)}
              onDayCompleted={handleDayCompleted}
              previewMode={previewMode}
            />
          </>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
            Selecciona un día para comenzar.
          </div>
        )}
      </div>
    </>
  );
}
