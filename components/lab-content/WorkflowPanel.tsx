"use client";

import type { WorkflowStep } from "./types";

type WorkflowPanelProps = {
  heroRouteSlot: HTMLElement | null;
  allWorkflowStepsCompleted: boolean;
  activeWorkflowStep: WorkflowStep | undefined;
  activeWorkflowStepIndex: number;
  workflowTotalCount: number;
  workflowSteps: WorkflowStep[];
  activeWorkflowStepId: string | undefined;
  activeWorkflowHint: string;
  nextWorkflowHint: string;
};

export function WorkflowPanel({
  heroRouteSlot,
  allWorkflowStepsCompleted,
  activeWorkflowStep,
  activeWorkflowStepIndex,
  workflowTotalCount,
  workflowSteps,
  activeWorkflowStepId,
  activeWorkflowHint,
  nextWorkflowHint,
}: WorkflowPanelProps) {
  return (
    <section
      id="day-focus"
      className={
        heroRouteSlot
          ? "h-full lg:flex lg:items-center"
          : `mb-5 rounded-xl border px-3 py-3.5 transition-all duration-500 md:px-4 md:py-4 ${
              allWorkflowStepsCompleted
                ? "border-[var(--ast-mint)]/38 bg-[linear-gradient(135deg,rgba(3,24,16,0.96),rgba(2,16,12,0.93))] shadow-[0_0_28px_rgba(4,164,90,0.14),0_8px_20px_rgba(2,10,6,0.4)]"
                : "border-[var(--ast-sky)]/24 bg-[linear-gradient(135deg,rgba(8,21,52,0.9),rgba(6,16,40,0.84))]"
            }`
      }
    >
      <div className={`space-y-3 ${heroRouteSlot ? "w-full" : ""}`}>

        {/* Label */}
        <p
          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            allWorkflowStepsCompleted ? "text-[var(--state-done-text)]" : "text-[var(--ast-sky-text)]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              allWorkflowStepsCompleted
                ? "animate-pulse bg-[var(--ast-mint)]"
                : "bg-[var(--ast-sky-bright)]"
            }`}
          />
          Ruta del día
        </p>

        {/* Step rail — circles + connecting lines */}
        <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ol className="flex min-w-max items-start gap-0">
            {workflowSteps.map((step, index) => {
              const isActive = step.id === activeWorkflowStepId;
              const isLast = index === workflowSteps.length - 1;
              const nextIsDone = workflowSteps[index + 1]?.done;
              return (
                <li key={`workflow_rail_${step.id}`} className="flex items-start">
                  <button
                    type="button"
                    onClick={step.onClick}
                    title={step.label}
                    className="group flex flex-col items-center gap-1.5 px-1"
                  >
                    {/* Circle */}
                    <span
                      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-[12px] font-bold transition-all duration-300 ${
                        step.done
                          ? "border-[var(--ast-mint)] bg-[rgba(4,164,90,0.22)] text-[var(--ast-mint)] shadow-[0_0_14px_rgba(4,164,90,0.32)]"
                          : isActive
                            ? "border-[var(--ast-sky-bright)] bg-[rgba(77,163,255,0.18)] text-[var(--ast-sky-text)] shadow-[0_0_14px_rgba(77,163,255,0.28)]"
                            : "border-[rgba(185,214,254,0.28)] bg-[rgba(6,18,43,0.5)] text-[var(--ui-muted)]"
                      }`}
                    >
                      {step.done ? "✓" : index + 1}
                      {isActive && !step.done && (
                        <span className="absolute inset-0 animate-ping rounded-full border-2 border-[var(--ast-sky-bright)]/40" />
                      )}
                    </span>
                    {/* Label */}
                    <span
                      className={`text-[10px] font-semibold whitespace-nowrap transition-colors ${
                        step.done
                          ? "text-[var(--state-done-text)]"
                          : isActive
                            ? "text-[var(--ast-sky-text)]"
                            : "text-[var(--ui-muted)] group-hover:text-[var(--ast-sky)]"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>

                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      aria-hidden="true"
                      className={`mt-4 h-px w-10 flex-shrink-0 transition-all duration-500 ${
                        step.done && nextIsDone
                          ? "bg-[rgba(4,164,90,0.48)]"
                          : step.done
                            ? "bg-[linear-gradient(90deg,rgba(4,164,90,0.45),rgba(77,163,255,0.2))]"
                            : isActive
                              ? "bg-[rgba(77,163,255,0.22)]"
                              : "bg-[rgba(185,214,254,0.14)]"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Bottom callout: celebration or current step hint */}
        {allWorkflowStepsCompleted ? (
          <div className="rounded-lg border border-[var(--ast-mint)]/32 bg-[rgba(4,164,90,0.1)] p-3">
            <p className="text-sm font-bold text-[var(--state-done-text)]">
              ¡Ruta completada! 🎉
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--state-done-hint)]/85">
              {nextWorkflowHint}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--ast-sky)]/20 bg-[rgba(4,14,36,0.5)] p-2.5">
            <p className="text-[11px] font-semibold text-[var(--ui-text)]">
              Ahora:{" "}
              <span className="text-[var(--ast-sky-text)]">{activeWorkflowStep?.label}</span>
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ui-muted)]">
              {activeWorkflowHint}
            </p>
            {nextWorkflowHint && (
              <p className="mt-1 border-t border-[var(--ast-sky)]/14 pt-1 text-[11px] text-[var(--ui-muted)]/75">
                {nextWorkflowHint}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
