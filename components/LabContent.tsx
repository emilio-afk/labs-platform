"use client";

import {
  extractYouTubeVideoId,
  parseDayBlocks,
  parseDayDiscussionPrompt,
  type DayBlock,
} from "@/utils/dayBlocks";
import { sanitizeRichText, stripRichText } from "@/utils/richText";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const customDiscussionPrompt = useMemo(
    () => parseDayDiscussionPrompt(currentDay.content),
    [currentDay.content],
  );
  const primaryResourceBlock = useMemo(
    () => findPrimaryResourceBlock(blocks),
    [blocks],
  );
  const primaryResourceBlockId = primaryResourceBlock?.block.id ?? null;
  const primaryResourceVideoId = primaryResourceBlock?.videoId ?? null;
  const primaryRouteLabel = getPrimaryRouteLabel(primaryResourceBlock?.block);

  const requiresWatch = Boolean(
    primaryResourceBlock?.block.type === "video" &&
      primaryResourceVideoId &&
      !initialCompleted,
  );
  const [videoDone, setVideoDone] = useState(
    () => initialCompleted || !requiresWatch,
  );
  const [resourceCollapsed, setResourceCollapsed] = useState(false);
  const [challengeCollapsed, setChallengeCollapsed] = useState(false);
  const [forumCollapsed, setForumCollapsed] = useState(false);
  const [hasUserForumComment, setHasUserForumComment] = useState(false);
  const tutorialStorageKey = useMemo(
    () => `astrolab_quick_tutorial_seen_${labId}`,
    [labId],
  );
  const [showQuickTutorial, setShowQuickTutorial] = useState(false);

  const localStateKey = useMemo(
    () => `astrolab_day_state_${labId}_${currentDay.day_number}`,
    [currentDay.day_number, labId],
  );
  const initialLocalStateRef = useRef<DayLocalState | null>(null);
  if (!initialLocalStateRef.current) {
    initialLocalStateRef.current = getInitialDayState(localStateKey);
  }

  const [checklistSelections, setChecklistSelections] = useState(
    initialLocalStateRef.current.checklistSelections,
  );
  const [challengeNotes, setChallengeNotes] = useState(
    initialLocalStateRef.current.notes,
  );
  const [quizAnswers, setQuizAnswers] = useState(
    initialLocalStateRef.current.quizAnswers,
  );
  const [revealedQuizzes, setRevealedQuizzes] = useState<Record<string, boolean>>({});
  const [, setCloudSyncStatus] = useState<CloudSyncStatus>("loading");
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
          setChallengeNotes(normalizedState.notes);
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
      notes: challengeNotes,
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
    challengeNotes,
    checklistSelections,
    currentDay.day_number,
    labId,
    localStateKey,
    quizAnswers,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeenTutorial = window.localStorage.getItem(tutorialStorageKey) === "1";
    if (!hasSeenTutorial) {
      setShowQuickTutorial(true);
    }
  }, [tutorialStorageKey]);

  const resourceBlocks = blocks.filter(
    (block) => block.group !== "challenge",
  );
  const challengeBlocks = blocks.filter(
    (block) => block.group === "challenge",
  );
  const hasPrimaryVideo = Boolean(
    primaryResourceBlock?.block.type === "video" && primaryResourceVideoId,
  );
  const showResourceSection =
    hasPrimaryVideo || resourceBlocks.length > 0 || challengeBlocks.length === 0;
  const showChallengeSection = challengeBlocks.length > 0;
  const estimatedMinutes = estimateDayMinutes(blocks, hasPrimaryVideo);
  const dayObjective = buildDayObjective(resourceBlocks, challengeBlocks, currentDay.day_number);
  const nextAction = buildNextAction({
    requiresWatch,
    videoDone,
    hasChallengeSection: showChallengeSection,
  });
  const keyTakeaways = buildKeyTakeaways(resourceBlocks);
  const resourceTextLines = useMemo(
    () => getResourceTextLines(resourceBlocks),
    [resourceBlocks],
  );
  const resourceTextLength = useMemo(
    () => resourceTextLines.join(" ").length,
    [resourceTextLines],
  );
  const filteredKeyTakeaways = useMemo(
    () =>
      keyTakeaways.filter(
        (takeaway) =>
          !resourceTextLines.some((line) => isSimilarTextForSummary(takeaway, line)),
      ),
    [keyTakeaways, resourceTextLines],
  );
  const hasEnoughContentForSummary =
    resourceTextLines.length >= 3 || resourceTextLength >= 320;
  const showTakeawayPanel =
    hasEnoughContentForSummary && filteredKeyTakeaways.length > 0;
  const normalizedTakeaways = useMemo(
    () => filteredKeyTakeaways.map((item) => normalizeSummaryText(item)).filter(Boolean),
    [filteredKeyTakeaways],
  );
  const resourceBlocksForRender = useMemo(() => {
    if (!showTakeawayPanel || normalizedTakeaways.length === 0) return resourceBlocks;

    return resourceBlocks.filter((block) => {
      if (block.type !== "text") return true;

      const textLines = splitTextLines(stripRichText(block.text ?? ""))
        .map((line) => normalizeSummaryText(line))
        .filter(Boolean);

      if (textLines.length === 0) return false;
      if (textLines.length > 2) return true;

      const isRepeatedSummary = textLines.every((line) =>
        normalizedTakeaways.some(
          (takeaway) =>
            takeaway === line || takeaway.includes(line) || line.includes(takeaway),
        ),
      );

      return !isRepeatedSummary;
    });
  }, [normalizedTakeaways, resourceBlocks, showTakeawayPanel]);
  const discussionPrompt =
    customDiscussionPrompt || buildDiscussionPrompt(challengeBlocks);

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

  const hasQuizInteraction = Object.values(quizAnswers).some(
    (answersByQuestion) => Object.keys(answersByQuestion).length > 0,
  );
  const hasChallengeNotes = challengeNotes.trim().length > 0;
  const hasChallengeWork =
    showChallengeSection || checklistBlocks.length > 0 || quizBlocks.length > 0;
  const hasForumStep = !previewMode;
  const videoStepDone = videoDone || !requiresWatch;
  const challengeStepDone =
    !hasChallengeWork ||
    completedChecklistItems > 0 ||
    hasQuizInteraction ||
    hasChallengeNotes ||
    hasUserForumComment;
  const forumStepDone = !hasForumStep || hasUserForumComment;

  const scrollToSection = useCallback((id: string) => {
    if (typeof document === "undefined") return;
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goToResource = useCallback(() => {
    setResourceCollapsed(false);
    requestAnimationFrame(() => scrollToSection("day-resource"));
  }, [scrollToSection]);

  const goToChallenge = useCallback(() => {
    setChallengeCollapsed(false);
    requestAnimationFrame(() => scrollToSection("day-challenge"));
  }, [scrollToSection]);

  const goToForum = useCallback(() => {
    setForumCollapsed(false);
    requestAnimationFrame(() => scrollToSection("day-forum"));
  }, [scrollToSection]);

  const openQuickTutorial = useCallback(() => {
    setShowQuickTutorial(true);
  }, []);

  const closeQuickTutorial = useCallback(() => {
    setShowQuickTutorial(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(tutorialStorageKey, "1");
    }
  }, [tutorialStorageKey]);

  const primaryAction = useMemo(() => {
    if (!videoStepDone) {
      return {
        label: "Ver recurso principal",
        description: "Completa el video para desbloquear el cierre del día.",
        onClick: goToResource,
      };
    }

    if (!challengeStepDone && hasChallengeWork) {
      return {
        label: "Resolver reto",
        description: "Sigue los pasos del reto para activar tu avance.",
        onClick: goToChallenge,
      };
    }

    if (!forumStepDone && hasForumStep) {
      return {
        label: "Publicar en foro",
        description: "Comparte tu resultado para cerrar el flujo de aprendizaje.",
        onClick: goToForum,
      };
    }

    return {
      label: "Repasar recursos",
      description: "Todo va bien. Puedes reforzar con los recursos descargables.",
      onClick: goToResource,
    };
  }, [
    challengeStepDone,
    forumStepDone,
    goToChallenge,
    goToForum,
    goToResource,
    hasChallengeWork,
    hasForumStep,
    videoStepDone,
  ]);

  const handleForumActivityChange = useCallback(
    ({ hasUserComment }: { commentCount: number; hasUserComment: boolean }) => {
      setHasUserForumComment(hasUserComment);
    },
    [],
  );

  const handleProgressCompleted = useCallback(
    (dayNumber: number) => {
      onDayCompleted?.(dayNumber);
    },
    [onDayCompleted],
  );

  const renderProgressButton = () => {
    if (previewMode) return null;
    return (
      <div className="space-y-2">
        <div className={videoDone ? "opacity-100" : "opacity-20 pointer-events-none"}>
          <ProgressButton
            labId={labId}
            dayNumber={currentDay.day_number}
            initialCompleted={initialCompleted}
            onCompleted={handleProgressCompleted}
          />
        </div>
        {!videoDone && requiresWatch && (
          <p className="text-[11px] text-yellow-400/75">
            Disponible al completar el video principal.
          </p>
        )}
      </div>
    );
  };

  const renderDayBlock = (
    block: DayBlock,
    index: number,
    section: "resource" | "challenge",
  ) => {
    if (block.type === "text") {
      const safeHtml = sanitizeRichText(block.text ?? "");
      if (!hasVisibleTextContent(safeHtml)) return null;

      if (section === "challenge") {
        return (
          <div
            key={block.id}
            className="lg:col-span-2 rounded-lg border border-[var(--ast-mint)]/35 bg-[rgba(0,73,44,0.18)] p-4"
          >
            <p className="mb-2 text-xs uppercase tracking-wider text-[var(--ast-mint)]/85">
              Paso {index + 1}
            </p>
            <div
              className="max-w-none text-[15px] text-[var(--ast-bone)]/95 leading-7 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          </div>
        );
      }

      return (
        <div
          key={block.id}
          className="lg:col-span-2 rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 text-[#d6e4fb]"
        >
          <div
            className="max-w-none text-[15px] leading-7 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>
      );
    }

    if (block.type === "image") {
      return (
        <div
          key={block.id}
          className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3 space-y-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.caption || "Imagen del dia"}
            className="w-full rounded-lg border border-[var(--ast-sky)]/30"
            loading="lazy"
          />
          {block.caption && <p className="text-sm text-[#9fb3d6]">{block.caption}</p>}
        </div>
      );
    }

    if (block.type === "audio") {
      return (
        <div
          key={block.id}
          className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3 space-y-2"
        >
          <audio controls className="w-full" src={block.url} />
          {block.caption && <p className="text-sm text-[#9fb3d6]">{block.caption}</p>}
        </div>
      );
    }

    if (block.type === "video") {
      const embeddedVideoId = extractYouTubeVideoId(block.url);
      const isPrimaryResourceVideo =
        section === "resource" &&
        block.id === primaryResourceBlockId &&
        Boolean(primaryResourceVideoId);
      const videoCardClassName =
        section === "resource"
          ? "lg:col-span-2 rounded-lg border border-[var(--ast-sky)]/35 bg-[rgba(7,68,168,0.14)] p-3 space-y-2"
          : "rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3 space-y-2";
      return (
        <div
          key={block.id}
          className={videoCardClassName}
        >
          {isPrimaryResourceVideo && primaryResourceVideoId ? (
            <VideoPlayer
              videoId={primaryResourceVideoId}
              onFinished={() => setVideoDone(true)}
              allowSkip={initialCompleted}
            />
          ) : embeddedVideoId ? (
            <iframe
              title={block.caption || `Video ${index + 1}`}
              className="w-full aspect-video rounded-lg border border-[var(--ast-sky)]/30"
              src={`https://www.youtube.com/embed/${embeddedVideoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video controls className="w-full rounded-lg border border-[var(--ast-sky)]/30" src={block.url} />
          )}
          {block.caption && <p className="text-sm text-[#9fb3d6]">{block.caption}</p>}
        </div>
      );
    }

    if (block.type === "file") {
      const fileLabel = block.caption?.trim() || "Descargar documento";
      return (
        <div
          key={block.id}
          id={`resource-${block.id}`}
          className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4"
        >
          <p className="text-xs uppercase tracking-widest text-[#9fb3d6] mb-1">
            Recurso descargable
          </p>
          <p className="text-sm text-[#e3ecfd] mb-3">{fileLabel}</p>
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
          className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--ast-mint)]">
              {block.title?.trim() || "Checklist del dia"}
            </h3>
            <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-[#d6e4fb]">
              {doneCount}/{itemCount}
            </span>
          </div>

          <div className="space-y-2">
            {(block.items ?? []).map((item) => {
              const checked = selected.has(item.id);
              return (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded border border-[var(--ast-sky)]/30 p-2 bg-[rgba(3,10,24,0.68)]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChecklistItem(block.id, item.id)}
                    className="mt-1"
                  />
                  <span className={checked ? "text-[#d6e4fb] line-through" : "text-[#e3ecfd]"}>
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
          className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--ast-sky)]">
              {block.title?.trim() || "Quiz rapido"}
            </h3>
            {revealResults && (
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-[#d6e4fb]">
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
                  className="rounded border border-[var(--ast-sky)]/30 p-3 bg-[rgba(3,10,24,0.68)] space-y-2"
                >
                  <p className="text-sm font-semibold text-[var(--ast-bone)]">
                    {questionIndex + 1}. {question.prompt}
                  </p>

                  <div className="space-y-2">
                    {(question.options ?? []).map((option, optionIndex) => (
                      <label
                        key={`${question.id}_${optionIndex}`}
                        className="flex items-center gap-2 text-sm text-[#e3ecfd]"
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
                    <p className={`text-xs ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                      {isCorrect
                        ? "Respuesta correcta"
                        : `Respuesta correcta: ${(question.options ?? [])[question.correctIndex ?? 0] ?? "N/D"}`}
                    </p>
                  )}

                  {revealResults && question.explanation && (
                    <p className="text-xs text-[#9fb3d6]">{question.explanation}</p>
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
            <p className="text-xs text-[#9fb3d6]">
              Respondidas: {quizResult.answered}/{quizResult.total}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  const showChecklistSummary = totalChecklistItems > 0;
  const showQuizSummary = quizBlocks.length > 0;
  const showProgressPanel = showChecklistSummary || showQuizSummary;
  const showResourcesQuickAccess = resources.length > 1;

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-7">
          {showResourceSection && (
            <section
              id="day-resource"
              className={`rounded-2xl border border-[#2a4b7d]/70 bg-[linear-gradient(135deg,rgba(8,18,45,0.96),rgba(5,15,38,0.94))] shadow-[0_14px_34px_rgba(3,8,22,0.45)] transition-all duration-300 ${resourceCollapsed ? "p-3 md:p-4" : "p-6 md:p-8"}`}
            >
              <div className={resourceCollapsed ? "mb-0 min-h-[38px]" : "mb-6"}>
                <div className="flex items-center justify-between gap-3">
                  <h2
                    className={`font-black tracking-tight text-[#d8e7ff] ${resourceCollapsed ? "text-xl" : "text-3xl"}`}
                  >
                    Recurso principal del Dia {currentDay.day_number}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setResourceCollapsed((prev) => !prev)}
                    className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ast-yellow)] hover:text-[#fff3a0]"
                  >
                    {resourceCollapsed ? "Expandir sección" : "Colapsar sección"}
                  </button>
                </div>
              </div>

              {resourceCollapsed && (
                <p className="text-xs text-[#95a7c5]">
                  {resourceBlocksForRender.length} bloques · ~{estimatedMinutes} min
                </p>
              )}

              {!resourceCollapsed && (
                <>
                  {!videoDone && requiresWatch && (
                    <p className="mb-4 text-xs text-yellow-500/75 animate-pulse">
                      Seguridad activa: completa el video antes de marcar el progreso.
                    </p>
                  )}

                  {showTakeawayPanel && (
                    <div className="mb-4 rounded-lg border border-[var(--ast-sky)]/35 bg-[rgba(7,68,168,0.18)] p-3">
                      <p className="text-xs uppercase tracking-wider text-[var(--ast-sky)]/90">
                        Qué debes captar antes de seguir
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-[var(--ast-bone)]">
                        {filteredKeyTakeaways.map((item, itemIndex) => (
                          <li key={`takeaway_${itemIndex}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {resourceBlocksForRender.length === 0 ? (
                      <p className="text-[#8ca2c4] lg:col-span-2">
                        Este dia no tiene bloques en recurso principal todavia.
                      </p>
                    ) : (
                      resourceBlocksForRender.map((block, index) =>
                        renderDayBlock(block, index, "resource"),
                      )
                    )}
                  </div>

                  <div className="mt-6 flex justify-end">
                    {renderProgressButton()}
                  </div>
                </>
              )}
            </section>
          )}

          {showChallengeSection && (
            <section
              id="day-challenge"
              className={`rounded-2xl border border-[rgba(4,164,90,0.45)] bg-[linear-gradient(135deg,rgba(6,31,33,0.95),rgba(4,20,22,0.94))] shadow-[0_14px_34px_rgba(2,12,11,0.5)] transition-all duration-300 ${challengeCollapsed ? "p-3 md:p-4" : "p-6 md:p-8"}`}
            >
              <div
                className={`flex flex-wrap items-center justify-between gap-3 ${challengeCollapsed ? "mb-0 min-h-[38px]" : "mb-6"}`}
              >
                <h2 className={`font-black tracking-tight text-[#54efb3] ${challengeCollapsed ? "text-xl" : "text-3xl"}`}>
                  Reto del Dia {currentDay.day_number}
                </h2>
                <button
                  type="button"
                  onClick={() => setChallengeCollapsed((prev) => !prev)}
                  className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ast-yellow)] hover:text-[#fff3a0]"
                >
                  {challengeCollapsed ? "Expandir sección" : "Colapsar sección"}
                </button>
              </div>

              {challengeCollapsed && (
                <p className="text-xs text-[#8ab8aa]">
                  {challengeBlocks.length} bloques · estado: {challengeStepDone ? "avanzado" : "pendiente"}
                </p>
              )}

              {!challengeCollapsed && (
                <>
                  {!showResourceSection && !videoDone && requiresWatch && (
                    <p className="mb-4 text-xs text-yellow-500/75 animate-pulse">
                      Seguridad activa: completa el video antes de marcar el progreso.
                    </p>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {challengeBlocks.map((block, index) =>
                      renderDayBlock(block, index, "challenge"),
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-[var(--ast-mint)]/35 bg-[rgba(0,73,44,0.16)] p-4">
                    <p className="text-xs uppercase tracking-wider text-[var(--ast-mint)]/90">
                      Tu respuesta del reto
                    </p>
                    <textarea
                      value={challengeNotes}
                      onChange={(e) => setChallengeNotes(e.target.value)}
                      placeholder="Escribe aquí tu respuesta o reflexión del reto de hoy..."
                      rows={5}
                      className="mt-2 w-full rounded-lg border border-[var(--ast-mint)]/35 bg-[rgba(4,12,31,0.72)] p-3 text-sm text-[var(--ast-bone)] outline-none focus:border-[var(--ast-mint)]"
                    />
                    <p className="mt-1 text-[11px] text-[#9bcfc0]">
                      Se guarda automáticamente para este día.
                    </p>
                  </div>

                  {!showResourceSection && (
                    <div className="mt-6 flex justify-end">
                      {renderProgressButton()}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <section
            id="day-forum"
            className={`rounded-2xl border border-[#315ea3]/60 bg-[linear-gradient(135deg,rgba(10,21,52,0.95),rgba(5,13,32,0.95))] shadow-[0_14px_34px_rgba(3,10,24,0.52)] transition-all duration-300 ${forumCollapsed ? "p-3 md:p-4" : "p-6 md:p-8"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className={`font-black tracking-tight text-[#4beaa4] ${forumCollapsed ? "text-xl" : "text-3xl"}`}>
                Foro de Discusión
              </h2>
              <button
                type="button"
                onClick={() => setForumCollapsed((prev) => !prev)}
                className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ast-yellow)] hover:text-[#fff3a0]"
              >
                {forumCollapsed ? "Expandir sección" : "Colapsar sección"}
              </button>
            </div>

            {!forumCollapsed && (
              <>
                {previewMode ? (
                  <div className="mt-4 p-6 rounded-xl border border-dashed border-white/20 bg-[rgba(4,12,31,0.46)]">
                    <h3 className="text-lg font-bold mb-2 text-[var(--ast-yellow)]">
                      Te gusto este lab?
                    </h3>
                    <p className="text-[#d6e4fb] mb-4">
                      Crea una cuenta para desbloquear todos los dias y participar en el foro.
                    </p>
                    <Link
                      href="/login"
                      className="inline-block px-5 py-2 rounded-full bg-[var(--ast-emerald)] hover:bg-[var(--ast-forest)] font-semibold text-black"
                    >
                      Desbloquear contenido
                    </Link>
                  </div>
                ) : (
                  <Forum
                    labId={labId}
                    dayNumber={currentDay.day_number}
                    discussionPrompt={discussionPrompt}
                    onActivityChange={handleForumActivityChange}
                  />
                )}
              </>
            )}
          </section>
        </div>

        <aside className="xl:col-span-1 self-start space-y-4">
          <div className="rounded-2xl border border-[var(--ast-mint)]/40 bg-[linear-gradient(160deg,rgba(4,53,40,0.92),rgba(4,34,32,0.92))] p-4 shadow-[0_12px_26px_rgba(0,10,7,0.45)] space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm uppercase tracking-widest text-[var(--ast-mint)]">
                Ruta del día
              </h3>
              <p className="text-[11px] text-[#b7d7d0]/80">
                Tip: haz clic en 1, 2 y 3 para navegar directo.
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.58)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goToResource}
                    className="h-6 min-w-6 rounded-full bg-[var(--ast-cobalt)] text-[11px] font-bold text-white hover:bg-[var(--ast-sky)]"
                    aria-label="Ir a recurso principal"
                  >
                    1
                  </button>
                  <span className="text-[#d6e4fb]">{primaryRouteLabel}</span>
                </div>
                <span className={videoStepDone ? "text-green-400" : "text-yellow-400"}>
                  {videoStepDone ? "Listo" : "Pendiente"}
                </span>
              </li>
              <li className="flex items-center justify-between rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.58)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goToChallenge}
                    className="h-6 min-w-6 rounded-full bg-[var(--ast-cobalt)] text-[11px] font-bold text-white hover:bg-[var(--ast-sky)]"
                    aria-label="Ir a reto del día"
                  >
                    2
                  </button>
                  <span className="text-[#d6e4fb]">Resolver reto</span>
                </div>
                <span className={challengeStepDone ? "text-green-400" : "text-yellow-400"}>
                  {challengeStepDone ? "Listo" : "Pendiente"}
                </span>
              </li>
              {hasForumStep && (
                <li className="flex items-center justify-between rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.58)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goToForum}
                      className="h-6 min-w-6 rounded-full bg-[var(--ast-cobalt)] text-[11px] font-bold text-white hover:bg-[var(--ast-sky)]"
                      aria-label="Ir al foro de discusión"
                    >
                      3
                    </button>
                    <span className="text-[#d6e4fb]">Publicar en foro</span>
                  </div>
                  <span className={forumStepDone ? "text-green-400" : "text-yellow-400"}>
                    {forumStepDone ? "Listo" : "Pendiente"}
                  </span>
                </li>
              )}
            </ul>
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="w-full rounded-md bg-[var(--ast-emerald)] px-3 py-2 text-sm font-bold text-black transition hover:bg-[var(--ast-mint)]"
            >
              {primaryAction.label}
            </button>
            <p className="text-xs text-[#d6e4fb]/80">{primaryAction.description}</p>
            <button
              type="button"
              onClick={openQuickTutorial}
              className="w-full rounded-md border border-[var(--ast-sky)]/40 bg-[rgba(4,12,31,0.46)] px-3 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--ast-sky)] hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
            >
              Ver tutorial rápido
            </button>
          </div>

          <div className="rounded-2xl border border-[var(--ast-sky)]/30 bg-[linear-gradient(160deg,rgba(9,18,40,0.93),rgba(7,14,32,0.93))] p-4 shadow-[0_12px_28px_rgba(2,7,19,0.45)] space-y-3">
            <h3 className="text-sm uppercase tracking-widest text-[var(--ast-sky)]">
              Guía del día
            </h3>
            <div className="rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3">
              <p className="text-[11px] uppercase tracking-wider text-[var(--ast-sky)]/80">
                Objetivo del día
              </p>
              <p className="mt-1 text-sm text-[var(--ast-bone)] leading-relaxed">{dayObjective}</p>
            </div>
            <div className="rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3">
              <p className="text-[11px] uppercase tracking-wider text-[var(--ast-sky)]/80">
                Tiempo estimado
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--ast-bone)]">~{estimatedMinutes} min</p>
            </div>
            <div className="rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3">
              <p className="text-[11px] uppercase tracking-wider text-[var(--ast-sky)]/80">
                Siguiente acción
              </p>
              <p className="mt-1 text-sm text-[var(--ast-bone)] leading-relaxed">{nextAction}</p>
            </div>
          </div>

          {showProgressPanel && (
            <div className="rounded-2xl border border-[var(--ast-sky)]/30 bg-[linear-gradient(160deg,rgba(9,18,40,0.93),rgba(7,14,32,0.93))] p-4 shadow-[0_12px_28px_rgba(2,7,19,0.45)] space-y-3">
              <h3 className="text-sm uppercase tracking-widest text-[var(--ast-mint)]">
                Progreso interactivo
              </h3>

              {showChecklistSummary && (
                <div className="rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3">
                  <p className="text-xs text-[#9fb3d6]">Checklist completado</p>
                  <p className="text-lg font-bold text-[var(--ast-bone)]">
                    {completedChecklistItems}/{totalChecklistItems}
                  </p>
                </div>
              )}

              {showQuizSummary && (
                <div className="rounded border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3 space-y-2">
                  <p className="text-xs text-[#9fb3d6]">Evaluaciones del dia</p>
                  <p className="text-sm text-[#e3ecfd]">Quizzes activos: {quizBlocks.length}</p>
                </div>
              )}
            </div>
          )}

          {showResourcesQuickAccess && (
            <div className="rounded-2xl border border-[var(--ast-sky)]/30 bg-[linear-gradient(160deg,rgba(9,18,40,0.93),rgba(7,14,32,0.93))] p-4 shadow-[0_12px_28px_rgba(2,7,19,0.45)] space-y-2">
              <h3 className="text-sm uppercase tracking-widest text-[var(--ast-sky)]">
                Accesos rápidos
              </h3>
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
            </div>
          )}
        </aside>
      </div>

      {showQuickTutorial && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-2xl border border-[#2d4b76] bg-[linear-gradient(145deg,rgba(10,22,52,0.98),rgba(6,15,37,0.98))] p-5 md:p-6 shadow-[0_20px_60px_rgba(3,8,24,0.65)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--ast-sky)]">
                  Mini tutorial
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-[#ddedff]">
                  Cómo navegar este lab
                </h3>
              </div>
              <button
                type="button"
                onClick={closeQuickTutorial}
                className="rounded-md border border-[var(--ast-sky)]/40 px-2 py-1 text-xs font-semibold text-[#d6e4fb] hover:border-[var(--ast-sky)]/65 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-sm text-[#e3ecfd]">
              <li className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.58)] p-3">
                <span className="font-semibold text-[var(--ast-mint)]">1.</span>{" "}
                Completa el <span className="font-semibold">recurso principal</span>.
              </li>
              <li className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.58)] p-3">
                <span className="font-semibold text-[var(--ast-mint)]">2.</span>{" "}
                Resuelve el reto y publica tu resultado en el foro.
              </li>
              <li className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.58)] p-3">
                <span className="font-semibold text-[var(--ast-mint)]">3.</span>{" "}
                Usa los números de <span className="font-semibold">Ruta del día</span> para ir directo a cada sección.
              </li>
              <li className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.58)] p-3">
                <span className="font-semibold text-[var(--ast-mint)]">4.</span>{" "}
                Marca como terminado al final del recurso o reto para desbloquear el siguiente módulo.
              </li>
            </ol>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeQuickTutorial}
                className="rounded-md bg-[var(--ast-emerald)] px-4 py-2 text-sm font-bold text-black hover:bg-[var(--ast-mint)]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

function findPrimaryResourceBlock(
  blocks: ReturnType<typeof parseDayBlocks>,
): { index: number; block: DayBlock; videoId: string | null } | null {
  let firstResourceIndex = -1;
  let firstYouTubeResourceIndex = -1;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const group = block.group === "challenge" ? "challenge" : "resource";
    if (group !== "resource") continue;

    if (firstResourceIndex < 0) {
      firstResourceIndex = i;
    }

    const videoId = block.type === "video" ? extractYouTubeVideoId(block.url) : null;
    if (videoId && firstYouTubeResourceIndex < 0) {
      firstYouTubeResourceIndex = i;
    }

    if (block.role === "primary") {
      return { index: i, block, videoId };
    }
  }

  if (firstYouTubeResourceIndex >= 0) {
    const block = blocks[firstYouTubeResourceIndex];
    return {
      index: firstYouTubeResourceIndex,
      block,
      videoId: extractYouTubeVideoId(block.url),
    };
  }

  if (firstResourceIndex >= 0) {
    const block = blocks[firstResourceIndex];
    return {
      index: firstResourceIndex,
      block,
      videoId: block.type === "video" ? extractYouTubeVideoId(block.url) : null,
    };
  }

  return null;
}

function getPrimaryRouteLabel(block: DayBlock | undefined): string {
  if (!block) return "Recurso principal";
  if (block.type === "video") return "Video principal";
  if (block.type === "audio") return "Audio principal";
  if (block.type === "image") return "Imagen principal";
  if (block.type === "file") return "Documento principal";
  if (block.type === "text") return "Lectura principal";
  if (block.type === "checklist") return "Checklist principal";
  if (block.type === "quiz") return "Quiz principal";
  return "Recurso principal";
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
    notes: normalizeNotes(data.notes),
    checklistSelections: normalizeChecklistSelections(data.checklistSelections),
    quizAnswers: normalizeQuizAnswers(data.quizAnswers),
  };
}

function normalizeNotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, 20000);
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

function estimateDayMinutes(
  blocks: DayBlock[],
  hasPrimaryVideo: boolean,
): number {
  let total = hasPrimaryVideo ? 10 : 0;

  for (const block of blocks) {
    if (block.type === "text") total += 3;
    if (block.type === "image" || block.type === "audio" || block.type === "file") total += 2;
    if (block.type === "video") total += 6;
    if (block.type === "checklist") total += Math.max(4, (block.items?.length ?? 0) * 1);
    if (block.type === "quiz") {
      const questionCount = block.questions?.length ?? 0;
      total += Math.max(4, questionCount * 2);
    }
  }

  return Math.min(90, Math.max(8, total));
}

function buildDayObjective(
  resourceBlocks: DayBlock[],
  challengeBlocks: DayBlock[],
  dayNumber: number,
): string {
  const challengeText = getBlockPlainText(challengeBlocks);
  const resourceText = getBlockPlainText(resourceBlocks);
  const candidate = firstSentence(challengeText) || firstSentence(resourceText);
  if (candidate) return limitText(candidate, 150);
  return `Completa el recurso principal y aplica lo aprendido en el reto del Día ${dayNumber}.`;
}

function buildNextAction({
  requiresWatch,
  videoDone,
  hasChallengeSection,
}: {
  requiresWatch: boolean;
  videoDone: boolean;
  hasChallengeSection: boolean;
}): string {
  if (requiresWatch && !videoDone) {
    return "Termina el video principal para desbloquear el cierre del día.";
  }
  if (hasChallengeSection) {
    return "Resuelve el reto por pasos y publica tu respuesta en el foro.";
  }
  return "Resume tus dos aprendizajes clave en notas y marca el día como completado.";
}

function buildKeyTakeaways(resourceBlocks: DayBlock[]): string[] {
  const textBlocks = resourceBlocks.filter((block) => block.type === "text");
  const lines = textBlocks.flatMap((block) =>
    splitTextLines(stripRichText(block.text ?? "")),
  );
  return lines.slice(0, 3).map((line) => limitText(line, 120));
}

function getResourceTextLines(resourceBlocks: DayBlock[]): string[] {
  const textBlocks = resourceBlocks.filter((block) => block.type === "text");
  return textBlocks.flatMap((block) =>
    splitTextLines(stripRichText(block.text ?? "")),
  );
}

function isSimilarTextForSummary(a: string, b: string): boolean {
  const left = normalizeSummaryText(a);
  const right = normalizeSummaryText(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function normalizeSummaryText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDiscussionPrompt(challengeBlocks: DayBlock[]): string {
  const challengeText = getBlockPlainText(challengeBlocks);
  const candidate = firstSentence(challengeText);
  if (candidate) {
    return `¿Cómo aplicarías esto en tu caso real?: ${limitText(candidate, 120)}`;
  }
  return "¿Qué cambiaste en tu forma de trabajar después de este reto?";
}

function getBlockPlainText(blocks: DayBlock[]): string {
  const textBlock = blocks.find((block) => block.type === "text");
  if (!textBlock) return "";
  return stripRichText(textBlock.text ?? "");
}

function hasVisibleTextContent(rawHtml: string): boolean {
  return stripRichText(rawHtml).trim().length > 0;
}

function splitTextLines(text: string): string[] {
  const normalized = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (normalized.length > 0) return normalized;
  return text.trim() ? [text.trim()] : [];
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  return parts[0] ?? "";
}

function limitText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
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
