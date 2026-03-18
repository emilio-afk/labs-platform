"use client";

import type { DayBlock as DayBlockType } from "@/utils/dayBlocks";
import type { WorkflowTone } from "./types";
import { DayBlock } from "./DayBlock";
import { ResourceSidebarItem } from "./ResourceSidebarItem";

type ResourceSectionProps = {
  dayNumber: number;
  resourceBlocksForRender: DayBlockType[];
  primaryResourceVideoBlock: DayBlockType | null;
  resourceSidebarBlocks: DayBlockType[];
  remainingResourceBlocks: DayBlockType[];
  useResourceSidebarLayout: boolean;
  estimatedMinutes: number;
  resourceCollapsed: boolean;
  setResourceCollapsed: (fn: (prev: boolean) => boolean) => void;
  resourceTone: WorkflowTone;
  resourceContainerToneClass: string;
  resourceActiveHaloClass: string;
  resourceStepMeta: { order: number; status: string; isActive: boolean } | undefined;
  resourceStepCompleted: boolean;
  toggleResourceStep: () => void;
  progressSyncError: string;
  previewMode: boolean;
  // DayBlock interaction props
  primaryResourceBlockId: string | null;
  primaryResourceVideoId: string | null;
  labPosterUrl?: string | null;
  labTitle?: string;
  checklistSelections: Record<string, string[]>;
  quizAnswers: Record<string, Record<string, number>>;
  revealedQuizzes: Record<string, boolean>;
  toggleChecklistItem: (blockId: string, itemId: string) => void;
  answerQuizQuestion: (blockId: string, questionId: string, optionIndex: number) => void;
  revealQuiz: (blockId: string) => void;
  challengeSurfaceToneClass: string;
  challengeLabelToneClass: string;
  challengeAccentBorderClass: string;
};

export function ResourceSection({
  dayNumber,
  resourceBlocksForRender,
  primaryResourceVideoBlock,
  resourceSidebarBlocks,
  remainingResourceBlocks,
  useResourceSidebarLayout,
  estimatedMinutes,
  resourceCollapsed,
  setResourceCollapsed,
  resourceTone,
  resourceContainerToneClass,
  resourceActiveHaloClass,
  resourceStepMeta,
  resourceStepCompleted,
  toggleResourceStep,
  progressSyncError,
  previewMode,
  primaryResourceBlockId,
  primaryResourceVideoId,
  labPosterUrl,
  labTitle,
  checklistSelections,
  quizAnswers,
  revealedQuizzes,
  toggleChecklistItem,
  answerQuizQuestion,
  revealQuiz,
  challengeSurfaceToneClass,
  challengeLabelToneClass,
  challengeAccentBorderClass,
}: ResourceSectionProps) {
  const tone = { challengeSurfaceToneClass, challengeLabelToneClass, challengeAccentBorderClass };

  return (
    <section
      id="day-resource"
      className={`relative overflow-hidden rounded-2xl border bg-[linear-gradient(160deg,rgba(7,17,42,0.97),rgba(3,10,27,0.96))] shadow-[0_14px_30px_rgba(3,8,22,0.4)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px ${resourceContainerToneClass} ${resourceCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"} ${resourceActiveHaloClass}`}
    >
      <div className={resourceCollapsed ? "mb-0" : "mb-5 border-b border-[var(--ast-sky)]/18 pb-3"}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
            {resourceStepMeta && (
              <span
                className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${resourceTone.stepBadgeClass}`}
              >
                {resourceStepMeta.order}
              </span>
            )}
            <div className="min-w-0">
              {resourceStepMeta && (
                <p
                  className={`inline-flex rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] ${resourceTone.statusBadgeClass}`}
                >
                  {resourceStepMeta.status}
                </p>
              )}
              <h2
                className={`mt-1 font-black tracking-tight ${resourceTone.titleClass} ${resourceCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}
              >
                Recurso principal del Dia {dayNumber}
              </h2>
              {resourceCollapsed && (
                <p className={`mt-1 text-sm ${resourceTone.metaClass}`}>
                  {resourceBlocksForRender.length} bloques · ~{estimatedMinutes} min
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setResourceCollapsed((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${resourceTone.toggleButtonClass}`}
          >
            {resourceCollapsed ? "Expandir" : "Colapsar"}
            <span aria-hidden="true" className="text-[11px] leading-none">
              {resourceCollapsed ? "▾" : "▴"}
            </span>
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${resourceCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="min-h-0 overflow-hidden">
      <div className="pt-1">
          {resourceBlocksForRender.length === 0 ? (
            <p className="text-[var(--ui-muted)]">
              Este dia no tiene bloques en recurso principal todavia.
            </p>
          ) : useResourceSidebarLayout && primaryResourceVideoBlock ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <DayBlock
                    key={primaryResourceVideoBlock.id}
                    block={primaryResourceVideoBlock}
                    index={0}
                    section="resource"
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
                </div>
                <aside className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.56)] p-3 lg:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ast-sky)]/85">
                    Recursos
                  </p>
                  <div className="mt-3 space-y-3">
                    {resourceSidebarBlocks.length > 0 ? (
                      resourceSidebarBlocks.map((block, index) => (
                        <div key={block.id}>
                          <ResourceSidebarItem block={block} index={index} />
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-[var(--ast-sky)]/24 bg-[rgba(7,27,63,0.32)] p-2.5">
                        <p className="text-[11px] leading-relaxed text-[var(--ui-muted)]">
                          Configura desde Admin qué recursos mostrar en este panel.
                        </p>
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {remainingResourceBlocks.length > 0 && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {remainingResourceBlocks.map((block, index) => (
                    <DayBlock
                      key={block.id}
                      block={block}
                      index={index + 1}
                      section="resource"
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
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {resourceBlocksForRender.map((block, index) => (
                <DayBlock
                  key={block.id}
                  block={block}
                  index={index}
                  section="resource"
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
          )}

          {!previewMode && (
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
