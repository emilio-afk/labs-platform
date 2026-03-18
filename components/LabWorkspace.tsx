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
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-[var(--ast-sky)]/28 text-[#8fa6cc]">
          Selecciona un día para comenzar.
        </div>
      )}

      {/* Back to top FAB */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Volver arriba"
        className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ast-sky)]/40 bg-[rgba(2,14,48,0.88)] text-[var(--ast-sky)] shadow-[0_8px_24px_rgba(1,8,28,0.5)] backdrop-blur-sm transition-all duration-300 hover:border-[var(--ast-mint)]/60 hover:text-[var(--ast-mint)] hover:shadow-[0_0_18px_rgba(4,164,90,0.2)] active:scale-95 ${
          showBackToTop ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15V5M5 10l5-5 5 5" />
        </svg>
      </button>

      {/* Day completion modal */}
      {completionPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,6,18,0.78)] px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-complete-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--ast-mint)]/30 bg-[linear-gradient(160deg,rgba(3,22,44,0.98),rgba(2,12,28,0.98))] shadow-[0_24px_60px_rgba(1,6,18,0.7),0_0_40px_rgba(4,164,90,0.1)]">
            {/* Green header strip */}
            <div className="border-b border-[var(--ast-mint)]/20 bg-[rgba(4,164,90,0.1)] px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ast-mint)]/45 bg-[rgba(4,164,90,0.22)] text-lg text-[var(--ast-mint)]">
                  ✓
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6ee7b7]">
                    Día completado
                  </p>
                  <h3
                    id="day-complete-title"
                    className="text-lg font-black tracking-tight text-[#d9fff0]"
                  >
                    ¡Día {completionPrompt.currentDayNumber} listo!
                  </h3>
                </div>
              </div>
            </div>

            <div className="p-5">
              <p className="text-sm leading-relaxed text-[#c0d8f5]">
                Completaste el Día {completionPrompt.currentDayNumber}. El Día{" "}
                {completionPrompt.nextDayNumber} ya está disponible.
                ¿Avanzas ahora o prefieres retomar mañana?
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGoToNextDay}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ui-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--ast-atlantic)] active:scale-[0.99]"
                >
                  Ir al Día {completionPrompt.nextDayNumber}
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  onClick={handleContinueTomorrow}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--ast-sky)]/30 bg-transparent px-4 py-2.5 text-sm font-semibold text-[#a0bfe0] transition hover:border-[var(--ast-sky)]/50 hover:text-[#d0e8ff] active:scale-[0.99]"
                >
                  Continuar mañana
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
