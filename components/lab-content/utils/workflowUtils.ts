import type { WorkflowStatus, WorkflowStepId, WorkflowTone } from "../types";

export function getWorkflowTone(status: WorkflowStatus): WorkflowTone {
  if (status === "Actual") {
    return {
      stepBadgeClass: "bg-[#4da3ff] text-[#04142e]",
      statusBadgeClass:
        "border-[#4da3ff]/58 bg-[rgba(77,163,255,0.18)] text-[#8fccff]",
      titleClass: "text-[#79beff]",
      metaClass: "text-[#a7d5ff]",
      toggleButtonClass:
        "border-[#4da3ff]/36 bg-[rgba(10,86,198,0.2)] text-[#c7e5ff] hover:border-[#4da3ff]/58 hover:text-[#eef7ff]",
    };
  }

  if (status === "Listo") {
    return {
      stepBadgeClass: "bg-[var(--ast-mint)]/82 text-[var(--ast-black)]",
      statusBadgeClass:
        "border-[var(--ast-mint)]/44 bg-[rgba(4,164,90,0.2)] text-[#96f2c8]",
      titleClass: "text-[#d9ffe9]",
      metaClass: "text-[#9fd8bd]",
      toggleButtonClass:
        "border-[var(--ast-mint)]/28 bg-[rgba(0,73,44,0.24)] text-[#b8f3d4] hover:border-[var(--ast-mint)]/52 hover:text-[#effff7]",
    };
  }

  return {
    stepBadgeClass: "bg-[#d9e8ff] text-[#0f2348]",
    statusBadgeClass:
      "border-[var(--ast-sky)]/24 bg-[rgba(4,12,31,0.46)] text-[#9fb7da]",
    titleClass: "text-[#d8e7ff]",
    metaClass: "text-[#93abd0]",
    toggleButtonClass:
      "border-[var(--ast-sky)]/22 bg-[rgba(4,12,31,0.34)] text-[#bcd2ef] hover:border-[var(--ast-sky)]/42 hover:text-[#e2efff]",
  };
}

export function getWorkflowCompletionHint(stepId: WorkflowStepId | undefined): string {
  if (stepId === "resource") {
    return 'Revisa el recurso completo y presiona "Marcar recurso como listo".';
  }
  if (stepId === "challenge") {
    return 'Completa la actividad del reto o guarda una reflexión para marcar este paso.';
  }
  if (stepId === "forum") {
    return "Publica un comentario en el foro para cerrar este paso.";
  }
  return "Sigue el paso activo para continuar.";
}
