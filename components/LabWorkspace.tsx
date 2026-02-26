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
  const [completedDays, setCompletedDays] = useState<number[]>(
    Array.from(new Set(completedDayNumbers)),
  );
  const [showBackToTop, setShowBackToTop] = useState(false);

  const currentDay = useMemo(
    () => days.find((d) => d.day_number === initialDayNumber) ?? days[0],
    [days, initialDayNumber],
  );

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
        <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-[var(--ast-sky)]/28 text-[#8fa6cc]">
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
