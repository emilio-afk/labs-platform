"use client";

import { useEffect, useMemo, useState } from "react";
import LabContent from "@/components/LabContent";

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
  labPathId?: string;
  days: WorkspaceDay[];
  initialDayNumber: number;
  completedDayNumbers: number[];
  previewMode?: boolean;
};

export default function LabWorkspace({
  labId,
  labPathId,
  days,
  initialDayNumber,
  completedDayNumbers,
  previewMode = false,
}: LabWorkspaceProps) {
  const routeLabId = labPathId?.trim() || labId;
  const defaultDay = days[0]?.day_number ?? 1;
  const [currentDayNumber, setCurrentDayNumber] = useState(() => {
    const exists = days.some((d) => d.day_number === initialDayNumber);
    const candidate = exists ? initialDayNumber : defaultDay;
    if (previewMode && candidate > 1) return defaultDay;
    if (candidate <= 1) return candidate;
    const completedSeed = new Set(completedDayNumbers);
    return completedSeed.has(candidate - 1) ? candidate : defaultDay;
  });
  const [completedDays, setCompletedDays] = useState<number[]>(
    Array.from(new Set(completedDayNumbers)),
  );
  const [previewNotice, setPreviewNotice] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const completedDaySet = useMemo(() => new Set(completedDays), [completedDays]);

  const currentDay = useMemo(
    () => days.find((d) => d.day_number === currentDayNumber),
    [currentDayNumber, days],
  );

  const isDayLocked = useMemo(
    () => (dayNumber: number) => {
      if (previewMode && dayNumber > 1) return true;
      if (dayNumber <= 1) return false;
      return !completedDaySet.has(dayNumber - 1);
    },
    [completedDaySet, previewMode],
  );

  const highestUnlockedDay = useMemo(() => {
    const firstDay = days[0]?.day_number ?? 1;
    if (previewMode) return firstDay;

    let highest = firstDay;
    for (const dayItem of days) {
      if (isDayLocked(dayItem.day_number)) continue;
      highest = Math.max(highest, dayItem.day_number);
    }
    return highest;
  }, [days, isDayLocked, previewMode]);

  const handleSelectDay = (dayNumber: number) => {
    if (isDayLocked(dayNumber)) {
      setPreviewNotice(
        previewMode
          ? "Solo puedes ver el Día 1 en modo vista previa."
          : `Completa el Día ${dayNumber - 1} para desbloquear este módulo.`,
      );
      return;
    }
    if (dayNumber === currentDayNumber) return;
    setCurrentDayNumber(dayNumber);
    setPreviewNotice("");
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/labs/${routeLabId}?day=${dayNumber}`);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const nextDay = Number.parseInt(url.searchParams.get("day") ?? "", 10);
      if (!Number.isFinite(nextDay)) return;
      if (!days.some((d) => d.day_number === nextDay)) return;
      if (isDayLocked(nextDay)) {
        setCurrentDayNumber(highestUnlockedDay);
        return;
      }
      setCurrentDayNumber(nextDay);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [days, highestUnlockedDay, isDayLocked]);

  useEffect(() => {
    const onScroll = () => {
      const shouldShow = window.scrollY > 520;
      setShowBackToTop((prev) => (prev === shouldShow ? prev : shouldShow));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const handleDayCompleted = (dayNumber: number) => {
    setCompletedDays((prev) => {
      if (prev.includes(dayNumber)) return prev;
      return [...prev, dayNumber];
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#2a4b7d]/65 bg-[linear-gradient(140deg,rgba(8,18,45,0.94),rgba(5,14,36,0.94))] p-4 shadow-[0_12px_30px_rgba(3,8,22,0.44)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-[#cfe0fa]">Módulos</h2>
          {previewNotice && (
            <p className="text-xs text-[var(--ast-yellow)]">{previewNotice}</p>
          )}
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
          {days.map((d) => {
            const locked = isDayLocked(d.day_number);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSelectDay(d.day_number)}
                className={`rounded-md border px-3 py-2 transition text-left min-h-[74px] ${currentDayNumber === d.day_number ? "border-[var(--ast-mint)] bg-[color:rgba(4,73,44,0.45)]" : "border-gray-800 bg-gray-900 hover:border-gray-600"} ${locked ? "opacity-65" : ""}`}
              >
                <div className="grid grid-cols-[24px_1fr_auto] items-start gap-2">
                  <span
                    className={`h-6 min-w-6 rounded-full px-1 flex items-center justify-center text-xs font-bold ${currentDayNumber === d.day_number ? "bg-[var(--ast-mint)] text-black" : "bg-gray-800 text-[var(--ast-sky)]"}`}
                  >
                    {d.day_number}
                  </span>
                  <span className="text-xs font-medium leading-snug line-clamp-2">
                    {d.title}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider ${locked ? "text-[var(--ast-yellow)]" : "invisible"}`}
                  >
                    Bloqueado
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {currentDay ? (
        <>
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

      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 right-5 z-40 rounded-full border border-[var(--ast-sky)]/50 bg-[rgba(1,25,99,0.82)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--ast-sky)] shadow-lg transition hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
        >
          Arriba
        </button>
      )}
    </div>
  );
}
