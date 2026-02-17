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
  // Estado para saber si el video terminó
  const [videoDone, setVideoDone] = useState(false);

  return (
    <div className="space-y-6">
      {/* 1. Video Player Inteligente */}
      {videoId && (
        <VideoPlayer
          videoId={videoId}
          onFinished={() => {
            console.log("¡Señal recibida! Video terminado.");
            setVideoDone(true);
          }}
        />
      )}

      {/* 2. Cuadro del Reto con Bloqueo Visual */}
      <div
        className={`p-8 rounded-xl border transition-all duration-500 ${
          videoDone
            ? "bg-gray-900 border-gray-700"
            : "bg-gray-900/30 border-gray-800 opacity-80"
        }`}
      >
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-green-400">
            Reto del Día {currentDay.day_number}
          </h2>

          {/* El botón se desbloquea solo si videoDone es true */}
          <div
            className={
              videoDone ? "opacity-100" : "opacity-20 pointer-events-none"
            }
          >
            <ProgressButton labId={labId} dayNumber={currentDay.day_number} />
          </div>
        </div>

        {!videoDone && (
          <p className="text-xs text-yellow-500/70 mb-4 animate-pulse">
            ⚠️ Debes ver el video completo para marcar este día como terminado.
          </p>
        )}

        <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">
          {currentDay.content}
        </div>
      </div>

      {/* 3. Foro del día */}
      <Forum labId={labId} dayNumber={currentDay.day_number} />
    </div>
  );
}
