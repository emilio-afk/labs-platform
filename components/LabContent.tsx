"use client";

import { extractYouTubeVideoId, parseDayBlocks } from "@/utils/dayBlocks";
import Link from "next/link";
import { useState } from "react";
import VideoPlayer from "./VideoPlayer";
import ProgressButton from "./ProgressButton";
import Forum from "./Forum";

type DayContent = {
  id: string;
  day_number: number;
  content: string | null;
  video_url: string | null;
};

export default function LabContent({
  currentDay,
  labId,
  initialCompleted,
  onDayCompleted,
  previewMode = false,
}: {
  currentDay: DayContent;
  labId: string;
  initialCompleted: boolean;
  onDayCompleted?: (dayNumber: number) => void;
  previewMode?: boolean;
}) {
  const blocks = parseDayBlocks(currentDay.content, currentDay.video_url);
  const primaryYouTubeVideo = findPrimaryYouTubeVideo(blocks);

  const requiresWatch = Boolean(primaryYouTubeVideo && !initialCompleted);
  const [videoDone, setVideoDone] = useState(initialCompleted || !requiresWatch);

  return (
    <div className="space-y-6">
      {primaryYouTubeVideo?.videoId && (
        <VideoPlayer
          videoId={primaryYouTubeVideo.videoId}
          onFinished={() => setVideoDone(true)}
          allowSkip={initialCompleted}
        />
      )}

      <div
        className={`p-8 rounded-xl border transition-all duration-500 ${videoDone ? "bg-gray-900 border-gray-700" : "bg-gray-900/40 border-gray-800 opacity-90"}`}
      >
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-green-400">
            Reto del Día {currentDay.day_number}
          </h2>
          {!previewMode && (
            <div
              className={
                videoDone ? "opacity-100" : "opacity-20 pointer-events-none"
              }
            >
              <ProgressButton
                labId={labId}
                dayNumber={currentDay.day_number}
                initialCompleted={initialCompleted}
                onCompleted={onDayCompleted}
              />
            </div>
          )}
        </div>

        {!videoDone && requiresWatch && (
          <p className="text-xs text-yellow-500/70 mb-4 animate-pulse">
            🔒 Seguridad Activa: No puedes adelantar el video hasta terminarlo.
          </p>
        )}

        <div className="space-y-4">
          {blocks.length === 0 && (
            <p className="text-gray-500">
              Este día no tiene bloques de contenido todavía.
            </p>
          )}
          {blocks.map((block, index) => {
            if (
              primaryYouTubeVideo &&
              block.type === "video" &&
              index === primaryYouTubeVideo.index
            ) {
              if (block.caption) {
                return (
                  <p key={block.id} className="text-sm text-gray-400 italic">
                    {block.caption}
                  </p>
                );
              }
              return null;
            }

            if (block.type === "text") {
              return (
                <div
                  key={block.id}
                  className="text-gray-300 whitespace-pre-wrap leading-relaxed"
                >
                  {block.text}
                </div>
              );
            }

            if (block.type === "image") {
              return (
                <div key={block.id} className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.url}
                    alt={block.caption || "Imagen del día"}
                    className="w-full rounded-lg border border-gray-700"
                    loading="lazy"
                  />
                  {block.caption && (
                    <p className="text-sm text-gray-400">{block.caption}</p>
                  )}
                </div>
              );
            }

            if (block.type === "audio") {
              return (
                <div key={block.id} className="space-y-2">
                  <audio controls className="w-full" src={block.url} />
                  {block.caption && (
                    <p className="text-sm text-gray-400">{block.caption}</p>
                  )}
                </div>
              );
            }

            const embeddedVideoId = extractYouTubeVideoId(block.url);
            return (
              <div key={block.id} className="space-y-2">
                {embeddedVideoId ? (
                  <iframe
                    title={block.caption || `Video ${index + 1}`}
                    className="w-full aspect-video rounded-lg border border-gray-700"
                    src={`https://www.youtube.com/embed/${embeddedVideoId}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    controls
                    className="w-full rounded-lg border border-gray-700"
                    src={block.url}
                  />
                )}
                {block.caption && (
                  <p className="text-sm text-gray-400">{block.caption}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {previewMode ? (
        <div className="mt-8 p-6 rounded-xl border border-dashed border-white/20 bg-black/20">
          <h3 className="text-lg font-bold mb-2 text-[var(--ast-yellow)]">
            Te gustó este lab?
          </h3>
          <p className="text-gray-300 mb-4">
            Crea una cuenta para desbloquear todos los días y participar en el
            foro.
          </p>
          <Link
            href="/login"
            className="inline-block px-5 py-2 rounded-full bg-[var(--ast-emerald)] hover:bg-[var(--ast-forest)] font-semibold"
          >
            Desbloquear contenido
          </Link>
        </div>
      ) : (
        <Forum labId={labId} dayNumber={currentDay.day_number} />
      )}
    </div>
  );
}

function findPrimaryYouTubeVideo(
  blocks: ReturnType<typeof parseDayBlocks>,
): { index: number; videoId: string } | null {
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (block.type !== "video") continue;
    const videoId = extractYouTubeVideoId(block.url);
    if (videoId) return { index: i, videoId };
  }
  return null;
}
