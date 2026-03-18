import { useEffect, useState } from "react";

export function useHeroPortal(dayId: string) {
  const [routeMounted, setRouteMounted] = useState(false);
  const [heroRouteSlot, setHeroRouteSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setRouteMounted(true);
    setHeroRouteSlot(document.getElementById("day-route-hero-slot"));
  }, [dayId]);

  return { routeMounted, heroRouteSlot };
}
