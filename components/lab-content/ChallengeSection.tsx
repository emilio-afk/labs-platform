"use client";

import type { DayBlock as DayBlockType } from "@/utils/dayBlocks";
import type { WorkflowTone } from "./types";
import { DayBlock } from "./DayBlock";
import { normalizeChallengeSnapshot } from "./utils/dayStateUtils";

type ChallengeSectionProps = {
  dayNumber: number;
  challengeBlocks: DayBlockType[];
  challengeNotes: string;
  setChallengeNotes: (value: string) => void;
  challengeResponseSaved: boolean;
  challengeSavedSnapshot: string;
  challengeSaveFeedback: string;
  challengeStepDone: boolean;
  challengeHasInteractiveBlocks: boolean;
  challengeCollapsed: boolean;
  setChallengeCollapsed: (fn: (prev: boolean) => boolean) => void;
  challengeTone: WorkflowTone;
  challengeStatus: "Listo" | "Actual" | "Pendiente";
  challengeContainerToneClass: string;
  challengeActiveHaloClass: string;
  challengeSurfaceToneClass: string;
  challengeLabelToneClass: string;
  challengeAccentBorderClass: string;
  challengeFocusBorderClass: string;
  challengeHintToneClass: string;
  challengeStepMeta: { order: number; status: string; isActive: boolean } | undefined;
  showResourceSection: boolean;
  previewMode: boolean;
  resourceStepCompleted: boolean;
  toggleResourceStep: () => void;
  progressSyncError: string;
  saveChallengeResponse: () => void;
  // DayBlock interaction props
  checklistSelections: Record<string, string[]>;
  quizAnswers: Record<string, Record<string, number>>;
  revealedQuizzes: Record<string, boolean>;
  toggleChecklistItem: (blockId: string, itemId: string) => void;
  answerQuizQuestion: (blockId: string, questionId: string, optionIndex: number) => void;
  revealQuiz: (blockId: string) => void;
  primaryResourceBlockId: string | null;
  primaryResourceVideoId: string | null;
  labPosterUrl?: string | null;
  labTitle?: string;
};

export function ChallengeSection({
  dayNumber,
  challengeBlocks,
  challengeNotes,
  setChallengeNotes,
  challengeResponseSaved,
  challengeSavedSnapshot,
  challengeSaveFeedback,
  challengeStepDone,
  challengeHasInteractiveBlocks,
  challengeCollapsed,
  setChallengeCollapsed,
  challengeTone,
  challengeStatus,
  challengeContainerToneClass,
  challengeActiveHaloClass,
  challengeSurfaceToneClass,
  challengeLabelToneClass,
  challengeAccentBorderClass,
  challengeFocusBorderClass,
  challengeHintToneClass,
  challengeStepMeta,
  showResourceSection,
  previewMode,
  resourceStepCompleted,
  toggleResourceStep,
  progressSyncError,
  saveChallengeResponse,
  checklistSelections,
  quizAnswers,
  revealedQuizzes,
  toggleChecklistItem,
  answerQuizQuestion,
  revealQuiz,
  primaryResourceBlockId,
  primaryResourceVideoId,
  labPosterUrl,
  labTitle,
}: ChallengeSectionProps) {
  const tone = { challengeSurfaceToneClass, challengeLabelToneClass, challengeAccentBorderClass };

  return (
    <section
      id="day-challenge"
      className={`relative overflow-hidden rounded-2xl border bg-[linear-gradient(160deg,rgba(5,27,38,0.97),rgba(3,18,27,0.96))] shadow-[0_14px_30px_rgba(2,12,11,0.44)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px ${challengeContainerToneClass} ${challengeCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"} ${challengeActiveHaloClass}`}
    >
      <div
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 ${challengeCollapsed ? "mb-0" : `mb-5 border-b ${challengeStatus === "Actual" ? "border-[var(--ast-sky-bright)]/24" : "border-[var(--ast-sky)]/18"} pb-3`}`}
      >
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
          {challengeStepMeta && (
            <span
              className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${challengeTone.stepBadgeClass}`}
            >
              {challengeStepMeta.order}
            </span>
          )}
          <div className="min-w-0">
            {challengeStepMeta && (
              <p
                className={`inline-flex rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] ${challengeTone.statusBadgeClass}`}
              >
                {challengeStepMeta.status}
              </p>
            )}
            <h2
              className={`mt-1 font-black tracking-tight ${challengeTone.titleClass} ${challengeCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}
            >
              Reto del Dia {dayNumber}
            </h2>
            {challengeCollapsed && (
              <p className={`mt-1 text-sm ${challengeTone.metaClass}`}>
                {challengeBlocks.length} bloques · estado: {challengeStepDone ? "listo" : "pendiente"}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setChallengeCollapsed((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${challengeTone.toggleButtonClass}`}
        >
          {challengeCollapsed ? "Expandir" : "Colapsar"}
          <span aria-hidden="true" className="text-[11px] leading-none">
            {challengeCollapsed ? "▾" : "▴"}
          </span>
        </button>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${challengeCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="min-h-0 overflow-hidden">
      <div className="pt-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {challengeBlocks.map((block, index) => (
              <DayBlock
                key={block.id}
                block={block}
                index={index}
                section="challenge"
                primaryResourceBlockId={primaryResourceBlockId}
                primaryResourceVideoId={primaryResourceVideoId}
                labPosterUrl={labPosterUrl}
                labTitle={labTitle}
                checklistSelections={checklistSelections}
                quizAnswers={quizAnswers}
                revealedQuizzes={revealedQuizzes}
                toggleChecklistItem={toggleChecklistItem}
                answerQuizQuestion={answerQuizQuestion}
                revealQuiz={revealQuiz}
                tone={tone}
              />
            ))}
          </div>

          <div className={`mt-4 rounded-lg border p-4 transition-all duration-300 ${
            challengeResponseSaved
              ? "border-[var(--ast-mint)]/42 bg-[rgba(4,164,90,0.08)]"
              : challengeSurfaceToneClass
          }`}>
            <p className={`text-xs uppercase tracking-wider ${challengeLabelToneClass}`}>
              Tu respuesta del reto
            </p>
            <textarea
              value={challengeNotes}
              onChange={(e) => {
                const nextValue = e.target.value;
                setChallengeNotes(nextValue);
                const nextSnapshot = normalizeChallengeSnapshot(nextValue);
                if (challengeResponseSaved && nextSnapshot !== challengeSavedSnapshot) {
                  // unsave handled by useDayState effect
                }
              }}
              placeholder="Escribe aquí tu respuesta o reflexión del reto de hoy..."
              rows={5}
              className={`mt-2 w-full rounded-lg border bg-[rgba(4,12,31,0.72)] p-3 text-sm text-[var(--ast-bone)] outline-none transition-colors duration-300 ${
                challengeResponseSaved
                  ? "border-[var(--ast-mint)]/50"
                  : `${challengeAccentBorderClass} ${challengeFocusBorderClass}`
              }`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveChallengeResponse}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                  challengeResponseSaved
                    ? "border-[var(--ast-mint)]/50 bg-[rgba(4,164,90,0.16)] text-[var(--state-done-text)]"
                    : "border-[var(--ast-mint)]/55 bg-[rgba(4,164,90,0.18)] text-[var(--ast-mint)] hover:bg-[rgba(4,164,90,0.28)]"
                }`}
              >
                <span className="text-base leading-none">
                  {challengeResponseSaved ? "✓" : "↑"}
                </span>
                {challengeResponseSaved ? "Guardado" : "Guardar respuesta"}
              </button>
              {challengeSaveFeedback && (
                <p className="text-[12px] font-medium text-[var(--ast-sky-text)]">{challengeSaveFeedback}</p>
              )}
              {challengeResponseSaved && !challengeSaveFeedback && (
                <p className="text-[12px] text-[var(--state-done-hint)]">
                  Paso listo — edita y vuelve a guardar si quieres actualizar.
                </p>
              )}
            </div>
            <p className={`mt-2 text-[11px] ${challengeHintToneClass}`}>
              {challengeHasInteractiveBlocks
                ? "Este paso queda listo al completar los bloques interactivos o al guardar tu reflexión."
                : "Este paso se marca como listo cuando guardas tu reflexión."}
            </p>
          </div>

          {!showResourceSection && !previewMode && (
            <div className="mt-6 flex flex-col items-end gap-1.5">
              <button
                type="button"
                onClick={toggleResourceStep}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${
                  resourceStepCompleted
                    ? "border-[var(--ast-mint)]/50 bg-[rgba(4,164,90,0.16)] text-[var(--state-done-text)] hover:bg-[rgba(4,164,90,0.08)] hover:text-[var(--state-done)]"
                    : "border-[var(--ast-sky)]/40 bg-[rgba(77,163,255,0.08)] text-[var(--ast-sky)] hover:border-[var(--ast-sky)]/62 hover:bg-[rgba(77,163,255,0.14)] hover:text-[var(--ui-text)]"
                }`}
              >
                <span className="text-base leading-none">
                  {resourceStepCompleted ? "✓" : "○"}
                </span>
                {resourceStepCompleted ? "Recurso listo" : "Marcar como listo"}
              </button>
              {progressSyncError && (
                <p className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(220,60,40,0.28)] bg-[rgba(180,40,20,0.08)] px-2.5 py-1 text-[11px] text-[var(--state-error-text)]">
                  <span aria-hidden="true">⚠</span>
                  {progressSyncError}
                </p>
              )}
            </div>
          )}
      </div>
      </div>
      </div>
    </section>
  );
}
