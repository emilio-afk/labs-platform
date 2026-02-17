"use client";

import { useEffect, useMemo, useState } from "react";
import LabContent from "@/components/LabContent";
import ProgressBar from "@/components/ProgressBar";

export type WorkspaceDay = {
  id: string;
  lab_id: string;
  day_number: number;
  title: string;
  video_url: string | null;
  content: string;
};

type LabWorkspaceProps = {
  labId: string;
  days: WorkspaceDay[];
  initialDayNumber: number;
  completedDayNumbers: number[];
};

function getYouTubeID(url: string | null): string | null {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function LabWorkspace({
  labId,
  days,
  initialDayNumber,
  completedDayNumbers,
}: LabWorkspaceProps) {
  const defaultDay = days[0]?.day_number ?? 1;
  const [currentDayNumber, setCurrentDayNumber] = useState(() => {
    const exists = days.some((d) => d.day_number === initialDayNumber);
    return exists ? initialDayNumber : defaultDay;
  });
  const [completedDays, setCompletedDays] = useState<number[]>(
    Array.from(new Set(completedDayNumbers)),
  );

  const currentDay = useMemo(
    () => days.find((d) => d.day_number === currentDayNumber),
    [currentDayNumber, days],
  );

  const handleSelectDay = (dayNumber: number) => {
    if (dayNumber === currentDayNumber) return;
    setCurrentDayNumber(dayNumber);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", `/labs/${labId}?day=${dayNumber}`);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const nextDay = Number.parseInt(url.searchParams.get("day") ?? "", 10);
      if (!Number.isFinite(nextDay)) return;
      if (!days.some((d) => d.day_number === nextDay)) return;
      setCurrentDayNumber(nextDay);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [days]);

  const handleDayCompleted = (dayNumber: number) => {
    setCompletedDays((prev) => {
      if (prev.includes(dayNumber)) return prev;
      return [...prev, dayNumber];
    });
  };

  return (
    <>
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-xl font-bold mb-4">Módulos</h2>
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleSelectDay(d.day_number)}
            className={`w-full p-4 mb-3 rounded-lg border transition text-left ${currentDayNumber === d.day_number ? "border-green-500 bg-green-950/30" : "border-gray-800 bg-gray-900 hover:border-gray-600"}`}
          >
            <div className="flex items-center">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold ${currentDayNumber === d.day_number ? "bg-green-500 text-black" : "bg-gray-800 text-green-400"}`}
              >
                {d.day_number}
              </span>
              <span className="font-medium">{d.title}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="lg:col-span-2 space-y-6">
        {currentDay ? (
          <>
            <ProgressBar completed={completedDays.length} total={days.length} />
            <LabContent
              key={currentDay.id}
              currentDay={currentDay}
              labId={labId}
              videoId={getYouTubeID(currentDay.video_url) || ""}
              initialCompleted={completedDays.includes(currentDay.day_number)}
              onDayCompleted={handleDayCompleted}
            />
          </>
        ) : (
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
            Selecciona un día para comenzar.
          </div>
        )}
      </div>
    </>
  );
}
