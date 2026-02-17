"use client";

import { useState } from "react";
import VideoPlayer from "./VideoPlayer";
import ProgressButton from "./ProgressButton";
import Forum from "./Forum";

export default function LabContent({
  currentDay,
  labId,
  videoId,
}: {
  currentDay: any;
  labId: string;
  videoId: string;
}) {
  const [videoDone, setVideoDone] = useState(false);

  return (
    <div className="space-y-6">
      {videoId ? (
        <VideoPlayer videoId={videoId} onFinished={() => setVideoDone(true)} />
      ) : (
        <div className="aspect-video w-full bg-gray-900 rounded-xl flex items-center justify-center border border-dashed border-gray-700 text-gray-500">
          No hay video disponible para este módulo.
        </div>
      )}

      <div
        className={`p-8 rounded-xl border transition-all duration-500 ${videoDone ? "bg-gray-900 border-gray-700" : "bg-gray-900/40 border-gray-800 opacity-90"}`}
      >
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-green-400">
            Reto del Día {currentDay.day_number}
          </h2>
          <div
            className={
              videoDone ? "opacity-100" : "opacity-20 pointer-events-none"
            }
          >
            <ProgressButton labId={labId} dayNumber={currentDay.day_number} />
          </div>
        </div>

        {!videoDone && videoId && (
          <p className="text-xs text-yellow-500/70 mb-4 animate-pulse">
            ⚠️ Mira el video completo para desbloquear este paso.
          </p>
        )}

        <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
          {currentDay.content}
        </div>
      </div>

      <Forum labId={labId} dayNumber={currentDay.day_number} />
    </div>
  );
}
