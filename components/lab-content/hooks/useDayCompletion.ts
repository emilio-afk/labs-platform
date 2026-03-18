import { useEffect, useRef, useState } from "react";
import { persistDayCompletion } from "../utils/cloudSync";

export function useDayCompletion({
  labId,
  dayNumber,
  initialCompleted,
  previewMode,
  allStepsCompleted,
  bootCompleted,
  challengeManualLoaded,
  forumMarkerLoaded,
  onDayCompleted,
}: {
  labId: string;
  dayNumber: number;
  initialCompleted: boolean;
  previewMode: boolean;
  allStepsCompleted: boolean;
  bootCompleted: boolean;
  challengeManualLoaded: boolean;
  forumMarkerLoaded: boolean;
  onDayCompleted?: (dayNumber: number, completed: boolean) => void;
}) {
  const [dayCompletionSynced, setDayCompletionSynced] = useState(initialCompleted);
  const [progressSyncError, setProgressSyncError] = useState("");
  const progressSyncInFlightRef = useRef(false);

  useEffect(() => {
    setDayCompletionSynced(initialCompleted);
    setProgressSyncError("");
  }, [initialCompleted, dayNumber, labId]);

  useEffect(() => {
    if (previewMode) return;
    if (!bootCompleted || !challengeManualLoaded || !forumMarkerLoaded) return;
    if (progressSyncInFlightRef.current) return;
    if (allStepsCompleted === dayCompletionSynced) return;

    progressSyncInFlightRef.current = true;
    setProgressSyncError("");

    void persistDayCompletion({ labId, dayNumber, completed: allStepsCompleted })
      .then((result) => {
        if (!result.ok) {
          setProgressSyncError("No se pudo sincronizar el estado del día.");
          return;
        }
        setDayCompletionSynced(result.completed);
        onDayCompleted?.(dayNumber, result.completed);
      })
      .finally(() => {
        progressSyncInFlightRef.current = false;
      });
  }, [
    allStepsCompleted,
    bootCompleted,
    challengeManualLoaded,
    dayNumber,
    dayCompletionSynced,
    forumMarkerLoaded,
    labId,
    onDayCompleted,
    previewMode,
  ]);

  const clearProgressError = () => setProgressSyncError("");

  return { progressSyncError, clearProgressError };
}
