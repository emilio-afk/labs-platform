"use client";

import {
  extractYouTubeVideoId,
  parseDayBlocks,
  type DayBlock,
} from "@/utils/dayBlocks";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import VideoPlayer from "./VideoPlayer";
import ProgressButton from "./ProgressButton";
import Forum from "./Forum";

type DayContent = {
  id: string;
  day_number: number;
  content: string | null;
  video_url: string | null;
};

type DayLocalState = {
  notes: string;
  checklistSelections: Record<string, string[]>;
  quizAnswers: Record<string, Record<string, number>>;
};

type CloudSyncStatus =
  | "loading"
  | "saving"
  | "saved"
  | "local"
  | "error";

type DayStateApiResponse = {
  state?: {
    notes?: unknown;
    checklistSelections?: unknown;
    quizAnswers?: unknown;
  } | null;
  error?: string;
};

const EMPTY_DAY_STATE: DayLocalState = {
  notes: "",
  checklistSelections: {},
  quizAnswers: {},
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
  const blocks = useMemo(
    () => parseDayBlocks(currentDay.content, currentDay.video_url),
    [currentDay.content, currentDay.video_url],
  );
  const primaryYouTubeVideo = findPrimaryYouTubeVideo(blocks);

  const requiresWatch = Boolean(primaryYouTubeVideo && !initialCompleted);
  const [videoDone, setVideoDone] = useState(
    () => initialCompleted || !requiresWatch,
  );

  const localStateKey = useMemo(
    () => `astrolab_day_state_${labId}_${currentDay.day_number}`,
    [currentDay.day_number, labId],
  );
  const initialLocalStateRef = useRef<DayLocalState | null>(null);
  if (!initialLocalStateRef.current) {
    initialLocalStateRef.current = getInitialDayState(localStateKey);
  }

  const [notes, setNotes] = useState(initialLocalStateRef.current.notes);
  const [checklistSelections, setChecklistSelections] = useState(
    initialLocalStateRef.current.checklistSelections,
  );
  const [quizAnswers, setQuizAnswers] = useState(
    initialLocalStateRef.current.quizAnswers,
  );
  const [revealedQuizzes, setRevealedQuizzes] = useState<Record<string, boolean>>({});
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("loading");
  const [bootCompleted, setBootCompleted] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadCloudState = async () => {
      try {
        setCloudSyncStatus("loading");
        const params = new URLSearchParams({
          labId,
          dayNumber: String(currentDay.day_number),
        });
        const response = await fetch(`/api/day-state?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });
        const payload = (await response.json()) as DayStateApiResponse;

        if (cancelled) return;

        if (response.status === 401) {
          setCloudSyncStatus("local");
          setBootCompleted(true);
          return;
        }

        if (!response.ok) {
          setCloudSyncStatus("error");
          setBootCompleted(true);
          return;
        }

        if (payload.state) {
          const normalizedState = normalizeDayState(payload.state);
          setNotes(normalizedState.notes);
          setChecklistSelections(normalizedState.checklistSelections);
          setQuizAnswers(normalizedState.quizAnswers);
        }

        setCloudSyncStatus("saved");
      } catch {
        if (cancelled) return;
        setCloudSyncStatus("error");
      } finally {
        if (!cancelled) {
          setBootCompleted(true);
        }
      }
    };

    void loadCloudState();

    return () => {
      cancelled = true;
      controller.abort();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentDay.day_number, labId, localStateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload: DayLocalState = {
      notes,
      checklistSelections,
      quizAnswers,
    };

    window.localStorage.setItem(localStateKey, JSON.stringify(payload));

    if (!bootCompleted) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void persistCloudState({
        labId,
        dayNumber: currentDay.day_number,
        payload,
        onStatus: setCloudSyncStatus,
      });
    }, 700);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    bootCompleted,
    checklistSelections,
    currentDay.day_number,
    labId,
    localStateKey,
    notes,
    quizAnswers,
  ]);

  const mediaAndContentBlocks = blocks.filter((block, index) => {
    if (
      primaryYouTubeVideo &&
      block.type === "video" &&
      index === primaryYouTubeVideo.index
    ) {
      return false;
    }
    return true;
  });

  const resources = blocks.filter(
    (block) => block.type === "file" && Boolean(block.url?.trim()),
  );

  const checklistBlocks = blocks.filter(
    (block) => block.type === "checklist" && (block.items?.length ?? 0) > 0,
  );

  const quizBlocks = blocks.filter(
    (block) => block.type === "quiz" && (block.questions?.length ?? 0) > 0,
  );

  const totalChecklistItems = checklistBlocks.reduce(
    (sum, block) => sum + (block.items?.length ?? 0),
    0,
  );

  const completedChecklistItems = checklistBlocks.reduce((sum, block) => {
    const selected = new Set(checklistSelections[block.id] ?? []);
    const completedInBlock = (block.items ?? []).filter((item) => selected.has(item.id)).length;
    return sum + completedInBlock;
  }, 0);

  const toggleChecklistItem = (blockId: string, itemId: string) => {
    setChecklistSelections((prev) => {
      const selected = new Set(prev[blockId] ?? []);
      if (selected.has(itemId)) {
        selected.delete(itemId);
      } else {
        selected.add(itemId);
      }

      return {
        ...prev,
        [blockId]: Array.from(selected),
      };
    });
  };

  const answerQuizQuestion = (
    blockId: string,
    questionId: string,
    optionIndex: number,
  ) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] ?? {}),
        [questionId]: optionIndex,
      },
    }));
  };

  const revealQuiz = (blockId: string) => {
    setRevealedQuizzes((prev) => ({ ...prev, [blockId]: true }));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      <div className="xl:col-span-3 space-y-6">
        {primaryYouTubeVideo?.videoId && (
          <VideoPlayer
            videoId={primaryYouTubeVideo.videoId}
            onFinished={() => setVideoDone(true)}
            allowSkip={initialCompleted}
          />
        )}

        <div
          className={`p-6 md:p-8 rounded-xl border transition-all duration-500 ${videoDone ? "bg-gray-900 border-gray-700" : "bg-gray-900/40 border-gray-800 opacity-90"}`}
        >
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <h2 className="text-2xl font-bold text-green-400">
              Reto del Dia {currentDay.day_number}
            </h2>
            {!previewMode && (
              <div
                className={videoDone ? "opacity-100" : "opacity-20 pointer-events-none"}
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
              Seguridad activa: completa el video antes de marcar el progreso.
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mediaAndContentBlocks.length === 0 && (
              <p className="text-gray-500 lg:col-span-2">
                Este dia no tiene bloques de contenido todavia.
              </p>
            )}

            {mediaAndContentBlocks.map((block, index) => {
              if (block.type === "text") {
                return (
                  <div
                    key={block.id}
                    className="lg:col-span-2 rounded-lg border border-gray-700 bg-black/30 p-4 text-gray-300 whitespace-pre-wrap leading-relaxed"
                  >
                    {block.text}
                  </div>
                );
              }

              if (block.type === "image") {
                return (
                  <div
                    key={block.id}
                    className="rounded-lg border border-gray-700 bg-black/30 p-3 space-y-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={block.url}
                      alt={block.caption || "Imagen del dia"}
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
                  <div
                    key={block.id}
                    className="rounded-lg border border-gray-700 bg-black/30 p-3 space-y-2"
                  >
                    <audio controls className="w-full" src={block.url} />
                    {block.caption && (
                      <p className="text-sm text-gray-400">{block.caption}</p>
                    )}
                  </div>
                );
              }

              if (block.type === "video") {
                const embeddedVideoId = extractYouTubeVideoId(block.url);
                return (
                  <div
                    key={block.id}
                    className="rounded-lg border border-gray-700 bg-black/30 p-3 space-y-2"
                  >
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
              }

              if (block.type === "file") {
                const fileLabel = block.caption?.trim() || "Descargar documento";
                return (
                  <div
                    key={block.id}
                    id={`resource-${block.id}`}
                    className="rounded-lg border border-gray-700 bg-black/30 p-4"
                  >
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                      Recurso descargable
                    </p>
                    <p className="text-sm text-gray-200 mb-3">{fileLabel}</p>
                    <a
                      href={block.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex px-3 py-2 rounded bg-[var(--ast-cobalt)] hover:bg-[var(--ast-atlantic)] text-sm font-semibold"
                    >
                      Abrir documento
                    </a>
                  </div>
                );
              }

              if (block.type === "checklist") {
                const selected = new Set(checklistSelections[block.id] ?? []);
                const itemCount = block.items?.length ?? 0;
                const doneCount = (block.items ?? []).filter((item) => selected.has(item.id)).length;

                return (
                  <div
                    key={block.id}
                    className="rounded-lg border border-gray-700 bg-black/30 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-[var(--ast-mint)]">
                        {block.title?.trim() || "Checklist del dia"}
                      </h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300">
                        {doneCount}/{itemCount}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(block.items ?? []).map((item) => {
                        const checked = selected.has(item.id);
                        return (
                          <label
                            key={item.id}
                            className="flex items-start gap-3 rounded border border-gray-700 p-2 bg-gray-950/40"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleChecklistItem(block.id, item.id)}
                              className="mt-1"
                            />
                            <span
                              className={checked ? "text-gray-300 line-through" : "text-gray-200"}
                            >
                              {item.text}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (block.type === "quiz") {
                const answersForBlock = quizAnswers[block.id] ?? {};
                const quizResult = getQuizResult(block, answersForBlock);
                const revealResults = Boolean(revealedQuizzes[block.id]);

                return (
                  <div
                    key={block.id}
                    className="rounded-lg border border-gray-700 bg-black/30 p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-[var(--ast-sky)]">
                        {block.title?.trim() || "Quiz rapido"}
                      </h3>
                      {revealResults && (
                        <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300">
                          {quizResult.correct}/{quizResult.total}
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      {(block.questions ?? []).map((question, questionIndex) => {
                        const selectedOption = answersForBlock[question.id];
                        const hasCorrectAnswer =
                          typeof question.correctIndex === "number" &&
                          question.correctIndex >= 0;
                        const isCorrect =
                          hasCorrectAnswer && selectedOption === question.correctIndex;

                        return (
                          <div
                            key={question.id}
                            className="rounded border border-gray-700 p-3 bg-gray-950/40 space-y-2"
                          >
                            <p className="text-sm font-semibold text-gray-100">
                              {questionIndex + 1}. {question.prompt}
                            </p>

                            <div className="space-y-2">
                              {(question.options ?? []).map((option, optionIndex) => (
                                <label
                                  key={`${question.id}_${optionIndex}`}
                                  className="flex items-center gap-2 text-sm text-gray-200"
                                >
                                  <input
                                    type="radio"
                                    name={`quiz_${block.id}_${question.id}`}
                                    checked={selectedOption === optionIndex}
                                    onChange={() =>
                                      answerQuizQuestion(block.id, question.id, optionIndex)
                                    }
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>

                            {revealResults && hasCorrectAnswer && (
                              <p
                                className={`text-xs ${isCorrect ? "text-green-400" : "text-red-400"}`}
                              >
                                {isCorrect
                                  ? "Respuesta correcta"
                                  : `Respuesta correcta: ${(question.options ?? [])[question.correctIndex ?? 0] ?? "N/D"}`}
                              </p>
                            )}

                            {revealResults && question.explanation && (
                              <p className="text-xs text-gray-400">{question.explanation}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => revealQuiz(block.id)}
                        className="px-3 py-2 rounded bg-[var(--ast-emerald)] hover:bg-[var(--ast-forest)] text-sm font-semibold text-black"
                      >
                        Revisar respuestas
                      </button>
                      <p className="text-xs text-gray-400">
                        Respondidas: {quizResult.answered}/{quizResult.total}
                      </p>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>

        {previewMode ? (
          <div className="mt-8 p-6 rounded-xl border border-dashed border-white/20 bg-black/20">
            <h3 className="text-lg font-bold mb-2 text-[var(--ast-yellow)]">
              Te gusto este lab?
            </h3>
            <p className="text-gray-300 mb-4">
              Crea una cuenta para desbloquear todos los dias y participar en el
              foro.
            </p>
            <Link
              href="/login"
              className="inline-block px-5 py-2 rounded-full bg-[var(--ast-emerald)] hover:bg-[var(--ast-forest)] font-semibold text-black"
            >
              Desbloquear contenido
            </Link>
          </div>
        ) : (
          <Forum labId={labId} dayNumber={currentDay.day_number} />
        )}
      </div>

      <aside className="xl:col-span-1 space-y-4">
        <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
          <h3 className="text-sm uppercase tracking-widest text-[var(--ast-sky)] mb-2">
            Notas del participante
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Se guardan automaticamente.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escribe tus ideas, tareas o insights del dia..."
            className="w-full h-52 rounded border border-gray-700 bg-black/40 p-3 text-sm text-gray-100"
          />
          <p className="mt-2 text-[11px] text-gray-500">
            Estado: {renderCloudStatus(cloudSyncStatus)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 space-y-3">
          <h3 className="text-sm uppercase tracking-widest text-[var(--ast-mint)]">
            Progreso interactivo
          </h3>

          <div className="rounded border border-gray-700 bg-black/30 p-3">
            <p className="text-xs text-gray-400">Checklist completado</p>
            <p className="text-lg font-bold text-gray-100">
              {completedChecklistItems}/{totalChecklistItems}
            </p>
          </div>

          <div className="rounded border border-gray-700 bg-black/30 p-3 space-y-2">
            <p className="text-xs text-gray-400">Recursos descargables</p>
            {resources.length > 0 ? (
              <ul className="space-y-1">
                {resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={`#resource-${resource.id}`}
                      className="text-sm text-[var(--ast-sky)] hover:text-[var(--ast-mint)]"
                    >
                      {resource.caption?.trim() || "Documento"}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No hay documentos en este dia.</p>
            )}
          </div>

          <div className="rounded border border-gray-700 bg-black/30 p-3 space-y-2">
            <p className="text-xs text-gray-400">Evaluaciones del dia</p>
            <p className="text-sm text-gray-200">Quizzes: {quizBlocks.length}</p>
            <p className="text-sm text-gray-200">Checklists: {checklistBlocks.length}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function parseStoredDayState(raw: string | null): DayLocalState {
  if (!raw) return EMPTY_DAY_STATE;

  try {
    return normalizeDayState(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_DAY_STATE;
  }
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

function getQuizResult(
  block: DayBlock,
  answersForBlock: Record<string, number>,
): { total: number; answered: number; correct: number } {
  const questions = block.questions ?? [];
  let answered = 0;
  let correct = 0;

  for (const question of questions) {
    const selected = answersForBlock[question.id];
    const hasAnswer = typeof selected === "number";
    if (hasAnswer) answered += 1;

    const hasCorrectAnswer =
      typeof question.correctIndex === "number" &&
      question.correctIndex >= 0 &&
      question.correctIndex < (question.options?.length ?? 0);

    if (hasAnswer && hasCorrectAnswer && selected === question.correctIndex) {
      correct += 1;
    }
  }

  return {
    total: questions.length,
    answered,
    correct,
  };
}

function getInitialDayState(localStateKey: string): DayLocalState {
  if (typeof window === "undefined") return EMPTY_DAY_STATE;
  return parseStoredDayState(window.localStorage.getItem(localStateKey));
}

function normalizeDayState(raw: unknown): DayLocalState {
  if (!raw || typeof raw !== "object") return EMPTY_DAY_STATE;
  const data = raw as Record<string, unknown>;

  return {
    notes: typeof data.notes === "string" ? data.notes.slice(0, 20000) : "",
    checklistSelections: normalizeChecklistSelections(data.checklistSelections),
    quizAnswers: normalizeQuizAnswers(data.quizAnswers),
  };
}

function normalizeChecklistSelections(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const output: Record<string, string[]> = {};

  for (const [blockId, itemIds] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof blockId !== "string" || !Array.isArray(itemIds)) continue;
    output[blockId] = itemIds
      .filter((item): item is string => typeof item === "string")
      .slice(0, 300);
  }

  return output;
}

function normalizeQuizAnswers(
  raw: unknown,
): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== "object") return {};
  const output: Record<string, Record<string, number>> = {};

  for (const [blockId, answers] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof blockId !== "string" || !answers || typeof answers !== "object") continue;

    const answersByQuestion: Record<string, number> = {};
    for (const [questionId, answer] of Object.entries(
      answers as Record<string, unknown>,
    )) {
      if (typeof questionId !== "string") continue;
      if (typeof answer !== "number" || !Number.isInteger(answer)) continue;
      if (answer < 0 || answer > 20) continue;
      answersByQuestion[questionId] = answer;
    }

    output[blockId] = answersByQuestion;
  }

  return output;
}

function renderCloudStatus(status: CloudSyncStatus): string {
  if (status === "loading") return "sincronizando con nube...";
  if (status === "saving") return "guardando en Supabase...";
  if (status === "saved") return "guardado en Supabase";
  if (status === "local") return "guardado local (inicia sesión para nube)";
  return "error en nube, guardado local activo";
}

async function persistCloudState({
  labId,
  dayNumber,
  payload,
  onStatus,
}: {
  labId: string;
  dayNumber: number;
  payload: DayLocalState;
  onStatus: (status: CloudSyncStatus) => void;
}) {
  try {
    onStatus("saving");
    const response = await fetch("/api/day-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labId,
        dayNumber,
        notes: payload.notes,
        checklistSelections: payload.checklistSelections,
        quizAnswers: payload.quizAnswers,
      }),
    });

    if (response.status === 401) {
      onStatus("local");
      return;
    }

    if (!response.ok) {
      onStatus("error");
      return;
    }

    onStatus("saved");
  } catch {
    onStatus("error");
  }
}
