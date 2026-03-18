import type { DayLocalState } from "../types";
import { EMPTY_DAY_STATE } from "../types";

export function normalizeChallengeSnapshot(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function normalizeNotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, 20000);
}

export function normalizeChecklistSelections(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const output: Record<string, string[]> = {};

  for (const [blockId, itemIds] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof blockId !== "string" || !Array.isArray(itemIds)) continue;
    output[blockId] = itemIds
      .filter((item): item is string => typeof item === "string")
      .slice(0, 300);
  }

  return output;
}

export function normalizeQuizAnswers(
  raw: unknown,
): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== "object") return {};
  const output: Record<string, Record<string, number>> = {};

  for (const [blockId, answers] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof blockId !== "string" || !answers || typeof answers !== "object") continue;

    const answersByQuestion: Record<string, number> = {};
    for (const [questionId, answer] of Object.entries(
      answers as Record<string, unknown>,
    )) {
      if (typeof questionId !== "string") continue;
      if (typeof answer !== "number" || !Number.isInteger(answer)) continue;
      if (answer < 0 || answer > 20) continue;
      answersByQuestion[questionId] = answer;
    }

    output[blockId] = answersByQuestion;
  }

  return output;
}

export function normalizeDayState(raw: unknown): DayLocalState {
  if (!raw || typeof raw !== "object") return EMPTY_DAY_STATE;
  const data = raw as Record<string, unknown>;

  return {
    notes: normalizeNotes(data.notes),
    checklistSelections: normalizeChecklistSelections(data.checklistSelections),
    quizAnswers: normalizeQuizAnswers(data.quizAnswers),
  };
}

export function parseStoredDayState(raw: string | null): DayLocalState {
  if (!raw) return EMPTY_DAY_STATE;

  try {
    return normalizeDayState(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_DAY_STATE;
  }
}

export function getInitialDayState(localStateKey: string): DayLocalState {
  if (typeof window === "undefined") return EMPTY_DAY_STATE;
  return parseStoredDayState(window.localStorage.getItem(localStateKey));
}
