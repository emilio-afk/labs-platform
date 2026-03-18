export type DayContent = {
  id: string;
  day_number: number;
  content: string | null;
  video_url: string | null;
};

export type DayLocalState = {
  notes: string;
  checklistSelections: Record<string, string[]>;
  quizAnswers: Record<string, Record<string, number>>;
};

export type CloudSyncStatus = "loading" | "saving" | "saved" | "local" | "error";

export type DayStateApiResponse = {
  state?: {
    notes?: unknown;
    checklistSelections?: unknown;
    quizAnswers?: unknown;
  } | null;
  error?: string;
};

export type WorkflowStepId = "resource" | "challenge" | "forum";

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  done: boolean;
  helperText: string;
  onClick: () => void;
};

export type WorkflowStatus = "Listo" | "Actual" | "Pendiente";

export type WorkflowTone = {
  stepBadgeClass: string;
  statusBadgeClass: string;
  titleClass: string;
  metaClass: string;
  toggleButtonClass: string;
};

export const EMPTY_DAY_STATE: DayLocalState = {
  notes: "",
  checklistSelections: {},
  quizAnswers: {},
};
