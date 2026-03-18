import { useCallback, useEffect, useMemo, useState } from "react";

export function useResourceStep(
  labId: string,
  dayNumber: number,
  initialCompleted: boolean,
) {
  const resourceManualStateKey = useMemo(
    () => `astrolab_resource_manual_${labId}_${dayNumber}`,
    [dayNumber, labId],
  );

  const [resourceStepCompleted, setResourceStepCompleted] = useState(initialCompleted);

  useEffect(() => {
    setResourceStepCompleted(initialCompleted);
  }, [initialCompleted, dayNumber, labId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawResource = window.localStorage.getItem(resourceManualStateKey);
    if (rawResource === "1") {
      setResourceStepCompleted(true);
    } else if (rawResource === "0") {
      setResourceStepCompleted(false);
    } else {
      setResourceStepCompleted(initialCompleted);
    }
  }, [initialCompleted, resourceManualStateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(resourceManualStateKey, resourceStepCompleted ? "1" : "0");
  }, [resourceManualStateKey, resourceStepCompleted]);

  const toggleResourceStep = useCallback(() => {
    setResourceStepCompleted((prev) => !prev);
  }, []);

  return { resourceStepCompleted, toggleResourceStep };
}
