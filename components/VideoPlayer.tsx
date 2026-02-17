"use client";
import { useRef, useEffect } from "react";
import YouTube, { YouTubeProps } from "react-youtube";

export default function VideoPlayer({
  videoId,
  onFinished,
  allowSkip,
}: {
  videoId: string;
  onFinished: () => void;
  allowSkip: boolean;
}) {
  const playerRef = useRef<any>(null);
  const lastTimeRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Limpiar intervalo al salir
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const onPlayerReady: YouTubeProps["onReady"] = (event) => {
    playerRef.current = event.target;
    lastTimeRef.current = 0; // Reset al cargar nuevo video

    // Iniciamos el Guardián del Tiempo
    if (!allowSkip) {
      intervalRef.current = setInterval(() => {
        checkAntiCheat(event.target);
      }, 1000); // Revisar cada segundo
    }
  };

  const checkAntiCheat = (player: any) => {
    // Si el video no se está reproduciendo (1 = Playing), no hacemos nada
    if (player.getPlayerState() !== 1) return;

    const currentTime = player.getCurrentTime();
    const rate = player.getPlaybackRate(); // Velocidad actual (1x, 1.5x, 2x...)

    // MATEMÁTICA DE SEGURIDAD:
    // Permitimos avanzar según la velocidad + un pequeño margen de error (lag de internet)
    // Si va a 2x, en 1 seg real avanza 2 seg de video. Damos 3 seg de tolerancia.
    const maxAllowedJump = 2 * rate + 1.5;

    // ¿Hubo un salto sospechoso hacia adelante?
    if (currentTime > lastTimeRef.current + maxAllowedJump) {
      console.log("🚫 Salto detectado. Regresando...");
      player.seekTo(lastTimeRef.current, true); // Castigo: Regresar al último punto válido
    } else {
      // Todo bien, guardamos este punto como válido
      lastTimeRef.current = currentTime;
    }
  };

  const onStateChange: YouTubeProps["onStateChange"] = (event) => {
    // 0 = Ended
    if (event.data === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      onFinished();
    }
  };

  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden border border-gray-800 shadow-2xl bg-black relative">
      <div className="w-full h-full">
        <YouTube
          videoId={videoId}
          onReady={onPlayerReady}
          onStateChange={onStateChange}
          opts={{
            width: "100%",
            height: "100%",
            playerVars: { rel: 0, modestbranding: 1 },
          }}
          className="w-full h-full"
        />
      </div>
      {/* Capa invisible opcional: Si quieres bloquear clics en la barra (muy estricto), descomenta esto: */}
      {/* {!allowSkip && <div className="absolute bottom-0 left-0 w-full h-12 bg-transparent z-10" />} */}
    </div>
  );
}
