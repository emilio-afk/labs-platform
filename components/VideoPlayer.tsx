"use client";
import YouTube, { YouTubeProps } from "react-youtube";

export default function VideoPlayer({
  videoId,
  onFinished,
}: {
  videoId: string;
  onFinished: () => void;
}) {
  const onStateChange: YouTubeProps["onStateChange"] = (event) => {
    if (event.data === 0) {
      onFinished();
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--ast-sky)]/30 bg-[rgba(1,9,24,0.9)] shadow-[0_16px_38px_rgba(2,6,23,0.58)]">
      <div className="w-full h-full">
        <YouTube
          videoId={videoId}
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
