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
  const lastTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPunishingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const onPlayerReady: YouTubeProps["onReady"] = (event) => {
    const player = event.target as YT.Player;
    lastTimeRef.current = 0;

    if (!allowSkip) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        checkAntiCheat(player);
      }, 2000);
    }
  };

  const checkAntiCheat = (player: YT.Player) => {
    if (isPunishingRef.current) return;

    const playerState = player.getPlayerState();

    if (playerState !== 1) return;

    const currentTime = player.getCurrentTime();
    const rate = player.getPlaybackRate() || 1;
    const maxAllowedJump = 2 * rate + 3;

    if (currentTime > lastTimeRef.current + maxAllowedJump) {
      isPunishingRef.current = true;

      console.warn("Salto detectado. Regresando...");
      player.seekTo(lastTimeRef.current, true);

      setTimeout(() => {
        isPunishingRef.current = false;
      }, 1000);
    } else {
      if (currentTime > lastTimeRef.current) {
        lastTimeRef.current = currentTime;
      }
    }
  };

  const onStateChange: YouTubeProps["onStateChange"] = (event) => {
    if (event.data === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      onFinished();
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
            playerVars: {
              rel: 0,
              modestbranding: 1,
              origin,
              enablejsapi: 1,
            },
          }}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
