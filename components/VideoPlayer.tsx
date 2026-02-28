"use client";
import { useEffect, useMemo, useState } from "react";
import YouTube, { YouTubeProps } from "react-youtube";

export default function VideoPlayer({
  videoId,
  onFinished,
  posterUrl,
  posterTitle,
}: {
  videoId: string;
  onFinished: () => void;
  posterUrl?: string | null;
  posterTitle?: string;
}) {
  const [started, setStarted] = useState(false);
  const hasLabPoster = typeof posterUrl === "string" && posterUrl.trim().length > 0;
  const fallbackPosterUrl = useMemo(
    () => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    [videoId],
  );

  const resolvedPosterUrl = useMemo(() => {
    if (hasLabPoster) return posterUrl.trim();
    return fallbackPosterUrl;
  }, [fallbackPosterUrl, hasLabPoster, posterUrl]);
  const [posterSrc, setPosterSrc] = useState(resolvedPosterUrl);
  const [posterLoadFailed, setPosterLoadFailed] = useState(false);

  useEffect(() => {
    setPosterSrc(resolvedPosterUrl);
    setPosterLoadFailed(false);
  }, [resolvedPosterUrl]);

  const onStateChange: YouTubeProps["onStateChange"] = (event) => {
    if (event.data === 1 && !started) {
      setStarted(true);
    }
    if (event.data === 0) {
      onFinished();
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--ast-sky)]/30 bg-[rgba(1,9,24,0.9)] shadow-[0_16px_38px_rgba(2,6,23,0.58)]">
      {!started && (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="group absolute inset-0 z-20 cursor-pointer text-left transition-opacity duration-200 active:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ast-mint)]/85 focus-visible:ring-inset motion-reduce:transition-none"
          aria-label="Iniciar video del recurso principal"
        >
          {!posterLoadFailed ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterSrc}
                alt={posterTitle ? `Portada de ${posterTitle}` : "Portada del video"}
                className="h-full w-full object-cover transition duration-200 group-hover:brightness-110 motion-reduce:transition-none"
                loading="lazy"
                onError={() => {
                  if (hasLabPoster) {
                    setPosterLoadFailed(true);
                    return;
                  }
                  if (posterSrc !== fallbackPosterUrl) {
                    setPosterSrc(fallbackPosterUrl);
                  }
                }}
              />
            </>
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_18%_22%,rgba(76,150,255,0.35),transparent_44%),linear-gradient(145deg,rgba(6,20,52,0.98),rgba(3,12,31,0.96))]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,9,24,0.24),rgba(1,9,24,0.78))]" />
          <div className="absolute left-4 top-4 rounded-full border border-[var(--ast-sky)]/45 bg-[rgba(2,14,39,0.62)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#dcedff]">
            Portada del lab
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
            {posterTitle && (
              <p className="max-w-[88%] text-lg font-black leading-tight text-[#eaf3ff] drop-shadow-[0_4px_12px_rgba(2,7,18,0.74)] md:text-2xl">
                {posterTitle}
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--ast-sky)]/45 bg-[rgba(2,14,39,0.64)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.11em] text-[#dcedff] transition group-hover:border-[var(--ast-mint)]/55 group-hover:text-[var(--ast-mint)]">
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(4,164,90,0.24)] text-[13px] leading-none text-[var(--ast-mint)]"
              >
                ▶
              </span>
              Reproducir recurso
            </div>
          </div>
        </button>
      )}

      <div className="h-full w-full">
        {started && (
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
                autoplay: 1,
              },
            }}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
