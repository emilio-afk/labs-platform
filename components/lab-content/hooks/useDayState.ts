import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CloudSyncStatus, DayLocalState, DayStateApiResponse } from "../types";
import { normalizeDayState, normalizeChallengeSnapshot, getInitialDayState } from "../utils/dayStateUtils";
import { persistCloudState } from "../utils/cloudSync";

export function useDayState(labId: string, dayNumber: number) {
  const localStateKey = useMemo(
    () => `astrolab_day_state_${labId}_${dayNumber}`,
    [dayNumber, labId],
  );
  const challengeManualStateKey = useMemo(
    () => `astrolab_challenge_manual_${labId}_${dayNumber}`,
    [dayNumber, labId],
  );

  const [checklistSelections, setChecklistSelections] = useState<Record<string, string[]>>({});
  const [challengeNotes, setChallengeNotes] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<string, number>>>({});
  const [revealedQuizzes, setRevealedQuizzes] = useState<Record<string, boolean>>({});
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("loading");
  const [bootCompleted, setBootCompleted] = useState(false);
  const [challengeResponseSaved, setChallengeResponseSaved] = useState(false);
  const [challengeSavedSnapshot, setChallengeSavedSnapshot] = useState("");
  const [challengeSaveFeedback, setChallengeSaveFeedback] = useState("");
  const [challengeManualLoaded, setChallengeManualLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on day/lab change
  useEffect(() => {
    setChallengeManualLoaded(false);
  }, [dayNumber, labId]);

  // Load local state after hydration (avoids SSR mismatch)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const localState = getInitialDayState(localStateKey);
    setChecklistSelections(localState.checklistSelections);
    setChallengeNotes(localState.notes);
    setQuizAnswers(localState.quizAnswers);
  }, [localStateKey]);

  // Load challenge manual state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(challengeManualStateKey);
    setChallengeSaveFeedback("");
    if (!raw) {
      setChallengeResponseSaved(false);
      setChallengeSavedSnapshot("");
      setChallengeManualLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { saved?: boolean; snapshot?: string };
      setChallengeResponseSaved(Boolean(parsed.saved));
      setChallengeSavedSnapshot(typeof parsed.snapshot === "string" ? parsed.snapshot : "");
    } catch {
      setChallengeResponseSaved(false);
      setChallengeSavedSnapshot("");
    }
    setChallengeManualLoaded(true);
  }, [challengeManualStateKey]);

  // Persist challenge manual state to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      challengeManualStateKey,
      JSON.stringify({ saved: challengeResponseSaved, snapshot: challengeSavedSnapshot }),
    );
  }, [challengeManualStateKey, challengeResponseSaved, challengeSavedSnapshot]);

  // Load cloud state on mount
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadCloudState = async () => {
      try {
        setCloudSyncStatus("loading");
        const params = new URLSearchParams({
          labId,
          dayNumber: String(dayNumber),
        });
        const response = await fetch(`/api/day-state?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });
        const payload = (await response.json()) as DayStateApiResponse;

        if (cancelled) return;

        if (response.status === 401) {
          setCloudSyncStatus("local");
          setBootCompleted(true);
          return;
        }

        if (!response.ok) {
          setCloudSyncStatus("error");
          setBootCompleted(true);
          return;
        }

        if (payload.state) {
          const normalized = normalizeDayState(payload.state);
          setChallengeNotes(normalized.notes);
          setChecklistSelections(normalized.checklistSelections);
          setQuizAnswers(normalized.quizAnswers);
        }

        setCloudSyncStatus("saved");
      } catch {
        if (cancelled) return;
        setCloudSyncStatus("error");
      } finally {
        if (!cancelled) {
          setBootCompleted(true);
        }
      }
    };

    void loadCloudState();

    return () => {
      cancelled = true;
      controller.abort();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [dayNumber, labId, localStateKey]);

  // Debounced local + cloud persist
  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: DayLocalState = { notes: challengeNotes, checklistSelections, quizAnswers };
    window.localStorage.setItem(localStateKey, JSON.stringify(payload));

    if (!bootCompleted) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      void persistCloudState({ labId, dayNumber, payload, onStatus: setCloudSyncStatus });
    }, 700);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [bootCompleted, challengeNotes, checklistSelections, dayNumber, labId, localStateKey, quizAnswers]);

  // Unsave challenge if notes change after saving
  useEffect(() => {
    if (!challengeResponseSaved) return;
    const currentSnapshot = normalizeChallengeSnapshot(challengeNotes);
    if (!currentSnapshot || currentSnapshot !== challengeSavedSnapshot) {
      setChallengeResponseSaved(false);
      setChallengeSaveFeedback("");
    }
  }, [challengeNotes, challengeResponseSaved, challengeSavedSnapshot]);

  const toggleChecklistItem = (blockId: string, itemId: string) => {
    setChecklistSelections((prev) => {
      const selected = new Set(prev[blockId] ?? []);
      if (selected.has(itemId)) {
        selected.delete(itemId);
      } else {
        selected.add(itemId);
      }
      return { ...prev, [blockId]: Array.from(selected) };
    });
  };

  const answerQuizQuestion = (blockId: string, questionId: string, optionIndex: number) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [blockId]: { ...(prev[blockId] ?? {}), [questionId]: optionIndex },
    }));
  };

  const revealQuiz = (blockId: string) => {
    setRevealedQuizzes((prev) => ({ ...prev, [blockId]: true }));
  };

  const saveChallengeResponse = useCallback(() => {
    const snapshot = normalizeChallengeSnapshot(challengeNotes);
    if (!snapshot) {
      setChallengeSaveFeedback("Escribe una respuesta antes de guardar.");
      setChallengeResponseSaved(false);
      setChallengeSavedSnapshot("");
      return;
    }

    setChallengeSavedSnapshot(snapshot);
    setChallengeResponseSaved(true);
    setChallengeSaveFeedback("Respuesta guardada. Paso marcado como listo.");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        challengeManualStateKey,
        JSON.stringify({ saved: true, snapshot }),
      );
    }

    if (bootCompleted) {
      const payload: DayLocalState = { notes: challengeNotes, checklistSelections, quizAnswers };
      void persistCloudState({ labId, dayNumber, payload, onStatus: setCloudSyncStatus });
    }
  }, [
    bootCompleted,
    challengeManualStateKey,
    challengeNotes,
    checklistSelections,
    dayNumber,
    labId,
    quizAnswers,
  ]);

  return {
    checklistSelections,
    challengeNotes, setChallengeNotes,
    quizAnswers,
    revealedQuizzes,
    cloudSyncStatus,
    bootCompleted,
    challengeResponseSaved,
    challengeSavedSnapshot,
    challengeSaveFeedback,
    challengeManualLoaded,
    toggleChecklistItem,
    answerQuizQuestion,
    revealQuiz,
    saveChallengeResponse,
  };
}
