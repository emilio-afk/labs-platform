"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  labTitle?: string;
  labPosterUrl?: string | null;
};

export default function LabWorkspace({
  labId,
  days,
  initialDayNumber,
  completedDayNumbers,
  previewMode = false,
  labTitle,
  labPosterUrl,
}: LabWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [completedDays, setCompletedDays] = useState<number[]>(
    Array.from(new Set(completedDayNumbers)),
  );
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [completionPrompt, setCompletionPrompt] = useState<{
    currentDayNumber: number;
    nextDayNumber: number;
  } | null>(null);
  const completedDaysRef = useRef<number[]>(Array.from(new Set(completedDayNumbers)));

  const currentDay = useMemo(
    () => days.find((d) => d.day_number === initialDayNumber) ?? days[0],
    [days, initialDayNumber],
  );
  const completionPromptStorageKey = useMemo(
    () => `astrolab_completion_prompt_${labId}`,
    [labId],
  );

  useEffect(() => {
    const normalized = Array.from(new Set(completedDayNumbers));
    setCompletedDays(normalized);
    completedDaysRef.current = normalized;
  }, [completedDayNumbers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawPrompt = window.sessionStorage.getItem(completionPromptStorageKey);
    if (!rawPrompt) return;

    try {
      const parsed = JSON.parse(rawPrompt) as {
        currentDayNumber?: unknown;
        nextDayNumber?: unknown;
      };
      const currentDayNumber =
        typeof parsed.currentDayNumber === "number" ? parsed.currentDayNumber : null;
      const nextDayNumber =
        typeof parsed.nextDayNumber === "number" ? parsed.nextDayNumber : null;

      const hasValidDays =
        currentDayNumber !== null &&
        nextDayNumber !== null &&
        days.some((day) => day.day_number === currentDayNumber) &&
        days.some((day) => day.day_number === nextDayNumber);

      if (!hasValidDays) {
        window.sessionStorage.removeItem(completionPromptStorageKey);
        return;
      }

      setCompletionPrompt({
        currentDayNumber: currentDayNumber as number,
        nextDayNumber: nextDayNumber as number,
      });
    } catch {
      window.sessionStorage.removeItem(completionPromptStorageKey);
    }
  }, [completionPromptStorageKey, days]);

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

  const handleDayProgressChange = (dayNumber: number, completed: boolean) => {
    const currentCompletedDays = completedDaysRef.current;
    let nextCompletedDays = currentCompletedDays;

    if (completed) {
      if (!currentCompletedDays.includes(dayNumber)) {
        nextCompletedDays = [...currentCompletedDays, dayNumber];
      }
    } else if (currentCompletedDays.includes(dayNumber)) {
      nextCompletedDays = currentCompletedDays.filter((value) => value !== dayNumber);
    }

    if (nextCompletedDays === currentCompletedDays) return;

    completedDaysRef.current = nextCompletedDays;
    setCompletedDays(nextCompletedDays);

    if (completed) {
      if (!previewMode) {
        const currentIndex = days.findIndex((dayItem) => dayItem.day_number === dayNumber);
        const nextDay = currentIndex >= 0 ? days[currentIndex + 1] : undefined;

        if (nextDay && !nextCompletedDays.includes(nextDay.day_number)) {
          const nextPrompt = {
            currentDayNumber: dayNumber,
            nextDayNumber: nextDay.day_number,
          };
          setCompletionPrompt(nextPrompt);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(completionPromptStorageKey, JSON.stringify(nextPrompt));
          }
        }
      }

      // Force refresh when a day changes to completed so next day unlocks immediately.
      router.refresh();
    }
  };

  const clearStoredCompletionPrompt = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(completionPromptStorageKey);
  };

  const handleGoToNextDay = () => {
    if (!completionPrompt) return;
    const targetDay = completionPrompt.nextDayNumber;
    setCompletionPrompt(null);
    clearStoredCompletionPrompt();
    router.push(`${pathname}?day=${targetDay}`, { scroll: false });
  };

  const handleContinueTomorrow = () => {
    setCompletionPrompt(null);
    clearStoredCompletionPrompt();
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
            onDayCompleted={handleDayProgressChange}
            previewMode={previewMode}
            labTitle={labTitle}
            labPosterUrl={labPosterUrl}
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

      {completionPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,8,24,0.72)] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-complete-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--ast-sky)]/35 bg-[linear-gradient(160deg,rgba(8,19,46,0.96),rgba(4,11,29,0.96))] p-5 shadow-[0_18px_50px_rgba(2,8,22,0.56)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fccff]">
              Día completado
            </p>
            <h3
              id="day-complete-title"
              className="mt-1 text-xl font-black tracking-tight text-[#e5f2ff]"
            >
              Excelente trabajo en el Día {completionPrompt.currentDayNumber}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#c8dbf6]">
              ¿Quieres ir al Día {completionPrompt.nextDayNumber} ahora o prefieres continuar
              hasta mañana?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGoToNextDay}
                className="rounded-md border border-[#4da3ff]/58 bg-[rgba(77,163,255,0.18)] px-3 py-2 text-xs font-semibold text-[#9fd3ff] transition hover:border-[#4da3ff]/78 hover:bg-[rgba(77,163,255,0.24)]"
              >
                Ir al Día {completionPrompt.nextDayNumber}
              </button>
              <button
                type="button"
                onClick={handleContinueTomorrow}
                className="rounded-md border border-[var(--ast-mint)]/54 bg-[rgba(4,164,90,0.16)] px-3 py-2 text-xs font-semibold text-[#98efc3] transition hover:border-[var(--ast-mint)]/75 hover:bg-[rgba(4,164,90,0.24)]"
              >
                Prefiero hasta mañana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
