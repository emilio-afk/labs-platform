"use client";
import YouTube, { YouTubeProps } from "react-youtube";

export default function VideoPlayer({
  videoId,
  onFinished,
}: {
  videoId: string;
  onFinished: () => void;
}) {
  const onPlayerStateChange: YouTubeProps["onStateChange"] = (event) => {
    if (event.data === 0) {
      console.log("Video terminado correctamente");
      onFinished();
    }
  };

  const opts: YouTubeProps["opts"] = {
    height: "100%",
    width: "100%",
    playerVars: {
      rel: 0,
      modestbranding: 1,
    },
  };

  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden border border-gray-800 shadow-2xl bg-black">
      {/* Quitamos containerClassName y usamos este div wrapper */}
      <div className="w-full h-full">
        <YouTube
          videoId={videoId}
          opts={opts}
          onStateChange={onPlayerStateChange}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
