import type { CloudSyncStatus, DayLocalState } from "../types";

export async function persistCloudState({
  labId,
  dayNumber,
  payload,
  onStatus,
}: {
  labId: string;
  dayNumber: number;
  payload: DayLocalState;
  onStatus: (status: CloudSyncStatus) => void;
}) {
  try {
    onStatus("saving");
    const response = await fetch("/api/day-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labId,
        dayNumber,
        notes: payload.notes,
        checklistSelections: payload.checklistSelections,
        quizAnswers: payload.quizAnswers,
      }),
    });

    if (response.status === 401) {
      onStatus("local");
      return;
    }

    if (!response.ok) {
      onStatus("error");
      return;
    }

    onStatus("saved");
  } catch {
    onStatus("error");
  }
}

export async function persistDayCompletion({
  labId,
  dayNumber,
  completed,
}: {
  labId: string;
  dayNumber: number;
  completed: boolean;
}): Promise<{ ok: boolean; completed: boolean }> {
  try {
    const response = await fetch("/api/progress/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labId, dayNumber, completed }),
    });

    let payload: { completed?: boolean } | null = null;
    try {
      payload = (await response.json()) as { completed?: boolean };
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return { ok: false, completed };
    }

    return {
      ok: true,
      completed: typeof payload?.completed === "boolean" ? payload.completed : completed,
    };
  } catch {
    return { ok: false, completed };
  }
}
