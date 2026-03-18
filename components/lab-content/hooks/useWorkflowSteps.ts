import { useMemo } from "react";
import type { WorkflowStep, WorkflowStepId, WorkflowStatus } from "../types";
import { getWorkflowTone, getWorkflowCompletionHint } from "../utils/workflowUtils";

export function useWorkflowSteps({
  primaryRouteLabel,
  videoStepDone,
  challengeStepDone,
  forumStepDone,
  hasChallengeWork,
  hasForumStep,
  challengeHasInteractiveBlocks,
  goToResource,
  goToChallenge,
  goToForum,
}: {
  primaryRouteLabel: string;
  videoStepDone: boolean;
  challengeStepDone: boolean;
  forumStepDone: boolean;
  hasChallengeWork: boolean;
  hasForumStep: boolean;
  challengeHasInteractiveBlocks: boolean;
  goToResource: () => void;
  goToChallenge: () => void;
  goToForum: () => void;
}) {
  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const steps: WorkflowStep[] = [
      {
        id: "resource",
        label: primaryRouteLabel,
        done: videoStepDone,
        helperText: "Revisa el recurso base para alinear criterio antes de avanzar.",
        onClick: () => goToResource(),
      },
    ];

    if (hasChallengeWork) {
      steps.push({
        id: "challenge",
        label: "Resolver reto",
        done: challengeStepDone,
        helperText: "Aplica lo aprendido en una acción concreta del día.",
        onClick: () => goToChallenge(),
      });
    }

    if (hasForumStep) {
      steps.push({
        id: "forum",
        label: "Publicar en foro",
        done: forumStepDone,
        helperText: "Comparte tu síntesis para cerrar el aprendizaje.",
        onClick: () => goToForum(),
      });
    }

    return steps;
  }, [
    challengeStepDone,
    forumStepDone,
    goToChallenge,
    goToForum,
    goToResource,
    hasChallengeWork,
    hasForumStep,
    primaryRouteLabel,
    videoStepDone,
  ]);

  const activeWorkflowStepId =
    workflowSteps.find((step) => !step.done)?.id ?? workflowSteps[workflowSteps.length - 1]?.id;
  const activeWorkflowStep =
    workflowSteps.find((step) => step.id === activeWorkflowStepId) ?? workflowSteps[0];
  const workflowTotalCount = workflowSteps.length;
  const workflowCompletedCount = workflowSteps.filter((step) => step.done).length;
  const activeWorkflowStepIndex = Math.max(
    0,
    workflowSteps.findIndex((step) => step.id === activeWorkflowStep?.id),
  );
  const allWorkflowStepsCompleted =
    workflowTotalCount > 0 && workflowCompletedCount === workflowTotalCount;
  const nextWorkflowStep = workflowSteps[activeWorkflowStepIndex + 1] ?? null;
  const activeWorkflowHint =
    activeWorkflowStep?.id === "challenge" && challengeHasInteractiveBlocks
      ? 'Completa los bloques del reto (quiz/checklist) o guarda una reflexión con "Guardar respuesta".'
      : getWorkflowCompletionHint(activeWorkflowStep?.id);
  const nextWorkflowHint = allWorkflowStepsCompleted
    ? "Ruta completada. Puedes repasar cualquier sección o avanzar al siguiente día."
    : nextWorkflowStep
      ? `Siguiente paso recomendado: ${nextWorkflowStep.label}.`
      : "Este es el último paso del día.";

  const sectionStepMeta = useMemo(() => {
    const meta = new Map<
      WorkflowStepId,
      { order: number; status: WorkflowStatus; isActive: boolean }
    >();

    workflowSteps.forEach((step, index) => {
      const isActive = step.id === activeWorkflowStepId;
      meta.set(step.id, {
        order: index + 1,
        status: step.done ? "Listo" : isActive ? "Actual" : "Pendiente",
        isActive,
      });
    });

    return meta;
  }, [activeWorkflowStepId, workflowSteps]);

  const resourceStepMeta = sectionStepMeta.get("resource");
  const challengeStepMeta = sectionStepMeta.get("challenge");
  const forumStepMeta = sectionStepMeta.get("forum");
  const resourceStatus: WorkflowStatus = resourceStepMeta?.status ?? "Pendiente";
  const challengeStatus: WorkflowStatus = challengeStepMeta?.status ?? "Pendiente";
  const forumStatus: WorkflowStatus = forumStepMeta?.status ?? "Pendiente";
  const resourceTone = getWorkflowTone(resourceStatus);
  const challengeTone = getWorkflowTone(challengeStatus);
  const forumTone = getWorkflowTone(forumStatus);

  const resourceContainerToneClass =
    resourceStatus === "Actual"
      ? "border-[rgba(77,163,255,0.5)] before:bg-[linear-gradient(90deg,rgba(77,163,255,0.05),rgba(77,163,255,0.72),rgba(77,163,255,0.05))]"
      : resourceStatus === "Listo"
        ? "border-[rgba(4,164,90,0.46)] before:bg-[linear-gradient(90deg,rgba(4,164,90,0.05),rgba(4,164,90,0.58),rgba(4,164,90,0.05))]"
        : "border-[#2d5387]/58 before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.65),rgba(76,150,255,0.05))]";
  const challengeContainerToneClass =
    challengeStatus === "Actual"
      ? "border-[rgba(77,163,255,0.5)] before:bg-[linear-gradient(90deg,rgba(77,163,255,0.05),rgba(77,163,255,0.72),rgba(77,163,255,0.05))]"
      : challengeStatus === "Listo"
        ? "border-[rgba(4,164,90,0.46)] before:bg-[linear-gradient(90deg,rgba(4,164,90,0.05),rgba(4,164,90,0.58),rgba(4,164,90,0.05))]"
        : "border-[#2d5387]/58 before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.65),rgba(76,150,255,0.05))]";
  const forumContainerToneClass =
    forumStatus === "Actual"
      ? "border-[rgba(77,163,255,0.54)] bg-[linear-gradient(160deg,rgba(9,21,52,0.95),rgba(5,13,32,0.95))] before:bg-[linear-gradient(90deg,rgba(77,163,255,0.06),rgba(77,163,255,0.78),rgba(77,163,255,0.06))]"
      : forumStatus === "Listo"
        ? "border-[rgba(4,164,90,0.48)] bg-[linear-gradient(160deg,rgba(4,30,46,0.96),rgba(3,22,38,0.96))] ring-1 ring-[rgba(4,164,90,0.22)] before:bg-[linear-gradient(90deg,rgba(4,164,90,0.08),rgba(4,164,90,0.72),rgba(4,164,90,0.08))]"
        : forumStatus === "Pendiente"
          ? "border-[rgba(76,150,255,0.68)] bg-[linear-gradient(160deg,rgba(13,33,78,0.96),rgba(7,18,45,0.96))] ring-1 ring-[rgba(76,150,255,0.2)] before:bg-[linear-gradient(90deg,rgba(76,150,255,0.12),rgba(76,150,255,0.82),rgba(76,150,255,0.12))]"
          : "border-[#2d5387]/62 bg-[linear-gradient(160deg,rgba(9,21,52,0.95),rgba(5,13,32,0.95))] before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.62),rgba(76,150,255,0.05))]";
  const challengeSurfaceToneClass =
    challengeStatus === "Actual"
      ? "border-[#4da3ff]/36 bg-[rgba(10,86,198,0.24)]"
      : challengeStatus === "Listo"
        ? "border-[var(--ast-mint)]/34 bg-[rgba(0,73,44,0.18)]"
        : "border-[var(--ast-sky)]/30 bg-[rgba(7,27,63,0.4)]";
  const challengeLabelToneClass =
    challengeStatus === "Actual"
      ? "text-[#93d0ff]"
      : challengeStatus === "Listo"
        ? "text-[var(--ast-mint)]/90"
        : "text-[var(--ast-sky)]/90";
  const challengeAccentBorderClass =
    challengeStatus === "Actual"
      ? "border-[#4da3ff]/36"
      : challengeStatus === "Listo"
        ? "border-[var(--ast-mint)]/35"
        : "border-[var(--ast-sky)]/30";
  const challengeFocusBorderClass =
    challengeStatus === "Actual"
      ? "focus:border-[#4da3ff]"
      : challengeStatus === "Listo"
        ? "focus:border-[var(--ast-mint)]"
        : "focus:border-[var(--ast-sky)]";
  const challengeHintToneClass =
    challengeStatus === "Actual"
      ? "text-[#9bcaf8]"
      : challengeStatus === "Listo"
        ? "text-[#9bcfc0]"
        : "text-[#9fb7da]";
  const resourceActiveHaloClass = resourceStepMeta?.isActive
    ? "ring-1 ring-[#4da3ff]/60 shadow-[0_0_0_1px_rgba(77,163,255,0.45),0_0_30px_rgba(77,163,255,0.28),0_16px_34px_rgba(3,8,22,0.46)]"
    : "";
  const challengeActiveHaloClass = challengeStepMeta?.isActive
    ? "ring-1 ring-[#4da3ff]/60 shadow-[0_0_0_1px_rgba(77,163,255,0.45),0_0_30px_rgba(77,163,255,0.28),0_16px_34px_rgba(2,12,11,0.5)]"
    : "";
  const forumActiveHaloClass = forumStepMeta?.isActive
    ? "ring-1 ring-[#4da3ff]/56 shadow-[0_0_0_1px_rgba(77,163,255,0.42),0_0_28px_rgba(77,163,255,0.24),0_16px_34px_rgba(3,10,24,0.5)]"
    : "";

  return {
    workflowSteps,
    activeWorkflowStepId,
    activeWorkflowStep,
    activeWorkflowStepIndex,
    workflowTotalCount,
    workflowCompletedCount,
    allWorkflowStepsCompleted,
    activeWorkflowHint,
    nextWorkflowHint,
    sectionStepMeta,
    resourceStepMeta,
    challengeStepMeta,
    forumStepMeta,
    resourceStatus,
    challengeStatus,
    forumStatus,
    resourceTone,
    challengeTone,
    forumTone,
    resourceContainerToneClass,
    challengeContainerToneClass,
    forumContainerToneClass,
    challengeSurfaceToneClass,
    challengeLabelToneClass,
    challengeAccentBorderClass,
    challengeFocusBorderClass,
    challengeHintToneClass,
    resourceActiveHaloClass,
    challengeActiveHaloClass,
    forumActiveHaloClass,
  };
}
