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
import { createPortal } from "react-dom";
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

type ChallengeGuideStepId = "scan" | "filter" | "publish";

type ChallengeGuideStep = {
  id: ChallengeGuideStepId;
  label: string;
};

type WorkflowStepId = "resource" | "challenge" | "forum";

type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  done: boolean;
  helperText: string;
  onClick: () => void;
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
  const [resourceCollapsed, setResourceCollapsed] = useState(true);
  const [challengeCollapsed, setChallengeCollapsed] = useState(true);
  const [forumCollapsed, setForumCollapsed] = useState(true);
  const [hasUserForumComment, setHasUserForumComment] = useState(false);
  const [showResourceNarrative, setShowResourceNarrative] = useState(false);
  const challengeGuideStorageKey = useMemo(
    () => `astrolab_challenge_guide_${labId}_${currentDay.day_number}`,
    [currentDay.day_number, labId],
  );
  const [challengeGuideChecks, setChallengeGuideChecks] = useState<
    Record<ChallengeGuideStepId, boolean>
  >({ scan: false, filter: false, publish: false });

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
  const [routeMounted, setRouteMounted] = useState(false);
  const [heroRouteSlot, setHeroRouteSlot] = useState<HTMLElement | null>(null);
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
    setShowResourceNarrative(false);
  }, [currentDay.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setRouteMounted(true);
    setHeroRouteSlot(document.getElementById("day-route-hero-slot"));
  }, [currentDay.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(challengeGuideStorageKey);
    if (!raw) {
      setChallengeGuideChecks({ scan: false, filter: false, publish: false });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<
        Record<ChallengeGuideStepId, unknown>
      >;
      setChallengeGuideChecks({
        scan: Boolean(parsed.scan),
        filter: Boolean(parsed.filter),
        publish: Boolean(parsed.publish),
      });
    } catch {
      setChallengeGuideChecks({ scan: false, filter: false, publish: false });
    }
  }, [challengeGuideStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      challengeGuideStorageKey,
      JSON.stringify(challengeGuideChecks),
    );
  }, [challengeGuideChecks, challengeGuideStorageKey]);

  const resourceBlocks = blocks.filter(
    (block) => block.group !== "challenge",
  );
  const challengeBlocks = blocks.filter(
    (block) => block.group === "challenge",
  );
  const challengeGuideItems = useMemo(
    () => buildChallengeGuideItems(challengeBlocks),
    [challengeBlocks],
  );
  const hasPrimaryVideo = Boolean(
    primaryResourceBlock?.block.type === "video" && primaryResourceVideoId,
  );
  const showResourceSection =
    hasPrimaryVideo || resourceBlocks.length > 0 || challengeBlocks.length === 0;
  const showChallengeSection = challengeBlocks.length > 0;
  const estimatedMinutes = estimateDayMinutes(blocks, hasPrimaryVideo);
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
  const resourceNarrative = useMemo(
    () => resourceTextLines.join(" "),
    [resourceTextLines],
  );
  const hasLongNarrative = resourceNarrative.length > 260;
  const resourceNarrativePreview = useMemo(
    () => limitText(resourceNarrative, 260),
    [resourceNarrative],
  );
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
  const primaryResourceVideoBlock = useMemo(
    () =>
      resourceBlocksForRender.find(
        (block) => block.id === primaryResourceBlockId && block.type === "video",
      ) ?? null,
    [primaryResourceBlockId, resourceBlocksForRender],
  );
  const downloadableResourceBlocks = useMemo(
    () => resourceBlocksForRender.filter((block) => block.type === "file"),
    [resourceBlocksForRender],
  );
  const useResourceSidebarLayout =
    Boolean(primaryResourceVideoBlock) && downloadableResourceBlocks.length > 0;
  const remainingResourceBlocks = useMemo(() => {
    if (!useResourceSidebarLayout || !primaryResourceVideoBlock) {
      return resourceBlocksForRender;
    }

    const excludedIds = new Set<string>([
      primaryResourceVideoBlock.id,
      ...downloadableResourceBlocks.map((block) => block.id),
    ]);
    return resourceBlocksForRender.filter((block) => !excludedIds.has(block.id));
  }, [
    downloadableResourceBlocks,
    primaryResourceVideoBlock,
    resourceBlocksForRender,
    useResourceSidebarLayout,
  ]);
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
  const challengeGuideCoreDone = challengeGuideItems
    .slice(0, 2)
    .every((item) => challengeGuideChecks[item.id]);
  const challengeStepDone =
    !hasChallengeWork ||
    completedChecklistItems > 0 ||
    hasQuizInteraction ||
    hasChallengeNotes ||
    hasUserForumComment ||
    challengeGuideCoreDone;
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

  const workflowSteps = useMemo<WorkflowStep[]>(() => {
    const steps: WorkflowStep[] = [
      {
        id: "resource",
        label: primaryRouteLabel,
        done: videoStepDone,
        helperText: "Revisa el recurso base para alinear criterio antes de avanzar.",
        onClick: () => goToResource(),
      },
    ];

    if (hasChallengeWork) {
      steps.push({
        id: "challenge",
        label: "Resolver reto",
        done: challengeStepDone,
        helperText: "Aplica lo aprendido en una acción concreta del día.",
        onClick: () => goToChallenge(),
      });
    }

    if (hasForumStep) {
      steps.push({
        id: "forum",
        label: "Publicar en foro",
        done: forumStepDone,
        helperText: "Comparte tu síntesis para cerrar el aprendizaje.",
        onClick: () => goToForum(),
      });
    }

    return steps;
  }, [
    challengeStepDone,
    forumStepDone,
    goToChallenge,
    goToForum,
    goToResource,
    hasChallengeWork,
    hasForumStep,
    primaryRouteLabel,
    videoStepDone,
  ]);
  const activeWorkflowStepId =
    workflowSteps.find((step) => !step.done)?.id ?? workflowSteps[workflowSteps.length - 1]?.id;
  const activeWorkflowStep =
    workflowSteps.find((step) => step.id === activeWorkflowStepId) ?? workflowSteps[0];

  const sectionStepMeta = useMemo(() => {
    const meta = new Map<
      WorkflowStepId,
      { order: number; status: "Listo" | "Actual" | "Pendiente"; isActive: boolean }
    >();

    workflowSteps.forEach((step, index) => {
      const isActive = step.id === activeWorkflowStepId;
      meta.set(step.id, {
        order: index + 1,
        status: step.done ? "Listo" : isActive ? "Actual" : "Pendiente",
        isActive,
      });
    });

    return meta;
  }, [activeWorkflowStepId, workflowSteps]);

  const resourceStepMeta = sectionStepMeta.get("resource");
  const challengeStepMeta = sectionStepMeta.get("challenge");
  const forumStepMeta = sectionStepMeta.get("forum");

  const toggleChallengeGuideStep = (stepId: ChallengeGuideStepId) => {
    setChallengeGuideChecks((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

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
      <ProgressButton
        labId={labId}
        dayNumber={currentDay.day_number}
        initialCompleted={initialCompleted}
        onCompleted={handleProgressCompleted}
      />
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

  const showResourcesQuickAccess = resources.length > 1;
  const dayRoutePanel = (
    <section
      id="day-focus"
      className={
        heroRouteSlot
          ? "h-full lg:flex lg:items-center"
          : "mb-5 rounded-xl border border-[var(--ast-sky)]/24 bg-[linear-gradient(135deg,rgba(8,21,52,0.9),rgba(6,16,40,0.84))] px-3 py-3.5 md:px-4 md:py-4"
      }
    >
      <div
        className={`space-y-3 ${
          heroRouteSlot
            ? "w-full"
            : ""
        }`}
      >
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ast-mint)]/90">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--ast-mint)]/90" />
            Ruta del día
          </p>
          <h2 className="mt-0.5 text-lg font-black tracking-tight text-[#e4efff] md:text-[1.72rem]">
            Ahora: {activeWorkflowStep?.label}
          </h2>
          <p className="mt-0.5 max-w-3xl text-[13px] leading-[1.4] text-[#c6daf8]/92 md:text-sm">
            {activeWorkflowStep?.helperText}
          </p>
        </div>

        <div className="min-w-0">
          <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ol className="flex min-w-max items-center gap-1.5">
              {workflowSteps.map((step, index) => {
                const isActive = step.id === activeWorkflowStepId;
                return (
                  <li key={`workflow_rail_${step.id}`}>
                    <button
                      type="button"
                      onClick={step.onClick}
                      title={step.label}
                      className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-left text-[11px] font-semibold whitespace-nowrap transition ${
                        step.done
                          ? "border-[var(--ast-mint)]/55 bg-[rgba(4,164,90,0.1)] text-[var(--ast-mint)]"
                          : isActive
                            ? "border-[var(--ast-sky)]/62 bg-[rgba(11,38,86,0.42)] text-[#e6f0ff]"
                            : "border-[var(--ast-sky)]/24 bg-[rgba(6,18,43,0.42)] text-[#a9c1e3] hover:border-[var(--ast-sky)]/46 hover:text-[#dce9ff]"
                      }`}
                    >
                      {index + 1}. {step.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <>
      {heroRouteSlot
        ? createPortal(dayRoutePanel, heroRouteSlot)
        : routeMounted
          ? dayRoutePanel
          : null}

      {showResourcesQuickAccess && (
        <section
          aria-label="Recursos rápidos del día"
          className="mb-5 border-t border-[var(--ast-sky)]/20 pt-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ast-sky)]/82">
            Recursos rápidos
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {resources.map((resource) => (
              <a
                key={`quick_resource_${resource.id}`}
                href={`#resource-${resource.id}`}
                className="cursor-pointer border-b border-[var(--ast-sky)]/34 px-1 py-0.5 text-sm text-[var(--ast-sky)] transition hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
              >
                {resource.caption?.trim() || "Documento"}
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-5">
          {showResourceSection && (
            <section
              id="day-resource"
              className={`relative overflow-hidden rounded-2xl border border-[#2d5387]/58 bg-[linear-gradient(160deg,rgba(8,18,45,0.96),rgba(5,15,38,0.94))] shadow-[0_14px_30px_rgba(3,8,22,0.4)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.65),rgba(76,150,255,0.05))] ${resourceCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"}`}
            >
              <div className={resourceCollapsed ? "mb-0" : "mb-5 border-b border-[var(--ast-sky)]/18 pb-3"}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                    {resourceStepMeta && (
                      <span
                        className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                          resourceStepMeta.isActive
                            ? "bg-[var(--ast-mint)] text-[var(--ast-black)]"
                            : "bg-[var(--ast-cobalt)]/65 text-[var(--ast-sky)]"
                        }`}
                      >
                        {resourceStepMeta.order}
                      </span>
                    )}
                    <div className="min-w-0">
                      {resourceStepMeta && (
                        <p className="inline-flex rounded-full border border-[var(--ast-sky)]/30 bg-[rgba(7,27,63,0.5)] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ast-sky)]/90">
                          {resourceStepMeta.status}
                        </p>
                      )}
                      <h2
                        className={`mt-1 font-black tracking-tight text-[#d8e7ff] ${resourceCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}
                      >
                        Recurso principal del Dia {currentDay.day_number}
                      </h2>
                      {resourceCollapsed && (
                        <p className="mt-1 text-sm text-[#9bb1d2]">
                          {resourceBlocksForRender.length} bloques · ~{estimatedMinutes} min
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResourceCollapsed((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ast-sky)]/28 bg-[rgba(4,12,31,0.4)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d8e7ff] transition hover:border-[var(--ast-sky)]/48 hover:text-white"
                  >
                    {resourceCollapsed ? "Expandir" : "Colapsar"}
                    <span aria-hidden="true" className="text-[11px] leading-none">
                      {resourceCollapsed ? "▾" : "▴"}
                    </span>
                  </button>
                </div>
              </div>

              {!resourceCollapsed && (
                <>
                  {resourceNarrativePreview && !useResourceSidebarLayout && (
                    <div className="mb-4 border-l-2 border-[var(--ast-sky)]/45 pl-3">
                      <p className="text-xs uppercase tracking-wider text-[var(--ast-sky)]/90">
                        Resumen ejecutivo del recurso
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--ast-bone)]">
                        {showResourceNarrative || !hasLongNarrative
                          ? resourceNarrative
                          : resourceNarrativePreview}
                      </p>
                      {hasLongNarrative && (
                        <button
                          type="button"
                          onClick={() => setShowResourceNarrative((prev) => !prev)}
                          className="mt-2 text-xs font-semibold text-[var(--ast-mint)] hover:underline"
                        >
                          {showResourceNarrative
                            ? "Mostrar versión corta"
                            : "Ver explicación completa"}
                        </button>
                      )}
                    </div>
                  )}

                  {showTakeawayPanel && (
                    <div className="mb-4 border-l-2 border-[var(--ast-mint)]/55 pl-3">
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

                  {resourceBlocksForRender.length === 0 ? (
                    <p className="text-[#8ca2c4]">
                      Este dia no tiene bloques en recurso principal todavia.
                    </p>
                  ) : useResourceSidebarLayout && primaryResourceVideoBlock ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                          {renderDayBlock(primaryResourceVideoBlock, 0, "resource")}
                        </div>
                        <aside className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.56)] p-3 lg:col-span-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ast-sky)]/85">
                            Recursos
                          </p>

                          {resourceNarrativePreview && (
                            <div className="mt-2 rounded-md border border-[var(--ast-sky)]/28 bg-[rgba(7,27,63,0.4)] p-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ast-sky)]/90">
                                Resumen ejecutivo
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-[var(--ast-bone)]/90">
                                {showResourceNarrative || !hasLongNarrative
                                  ? resourceNarrative
                                  : resourceNarrativePreview}
                              </p>
                              {hasLongNarrative && (
                                <button
                                  type="button"
                                  onClick={() => setShowResourceNarrative((prev) => !prev)}
                                  className="mt-1.5 text-[11px] font-semibold text-[var(--ast-mint)] hover:underline"
                                >
                                  {showResourceNarrative
                                    ? "Mostrar versión corta"
                                    : "Ver explicación completa"}
                                </button>
                              )}
                            </div>
                          )}

                          <div className="mt-3 space-y-3">
                            {downloadableResourceBlocks.map((block, index) => (
                              <div key={block.id}>{renderDayBlock(block, index, "resource")}</div>
                            ))}
                          </div>
                        </aside>
                      </div>

                      {remainingResourceBlocks.length > 0 && (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          {remainingResourceBlocks.map((block, index) =>
                            renderDayBlock(block, index + 1, "resource"),
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {resourceBlocksForRender.map((block, index) =>
                        renderDayBlock(block, index, "resource"),
                      )}
                    </div>
                  )}

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
              className={`relative overflow-hidden rounded-2xl border border-[rgba(4,164,90,0.42)] bg-[linear-gradient(160deg,rgba(5,23,40,0.96),rgba(4,20,31,0.95))] shadow-[0_14px_30px_rgba(2,12,11,0.44)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,rgba(4,164,90,0.05),rgba(4,164,90,0.62),rgba(4,164,90,0.05))] ${challengeCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"}`}
            >
              <div
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 ${challengeCollapsed ? "mb-0" : "mb-5 border-b border-[var(--ast-mint)]/18 pb-3"}`}
              >
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                  {challengeStepMeta && (
                    <span
                      className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                        challengeStepMeta.isActive
                          ? "bg-[var(--ast-mint)] text-[var(--ast-black)]"
                          : "bg-[var(--ast-cobalt)]/65 text-[var(--ast-sky)]"
                      }`}
                    >
                      {challengeStepMeta.order}
                    </span>
                  )}
                  <div className="min-w-0">
                    {challengeStepMeta && (
                      <p className="inline-flex rounded-full border border-[var(--ast-mint)]/35 bg-[rgba(0,73,44,0.24)] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ast-mint)]/92">
                        {challengeStepMeta.status}
                      </p>
                    )}
                    <h2 className={`mt-1 font-black tracking-tight text-[#54efb3] ${challengeCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}>
                      Reto del Dia {currentDay.day_number}
                    </h2>
                    {challengeCollapsed && (
                      <p className="mt-1 text-sm text-[#97c7b8]">
                        {challengeBlocks.length} bloques · estado: {challengeStepDone ? "avanzado" : "pendiente"}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChallengeCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ast-mint)]/24 bg-[rgba(0,44,32,0.28)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#bde8d6] transition hover:border-[var(--ast-mint)]/46 hover:text-[#e8fff5]"
                >
                  {challengeCollapsed ? "Expandir" : "Colapsar"}
                  <span aria-hidden="true" className="text-[11px] leading-none">
                    {challengeCollapsed ? "▾" : "▴"}
                  </span>
                </button>
              </div>

              {!challengeCollapsed && (
                <>
                  <div className="mb-4 rounded-lg border border-[var(--ast-mint)]/35 bg-[rgba(0,73,44,0.2)] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-wider text-[var(--ast-mint)]/90">
                        Ejecución guiada
                      </p>
                      <span className="rounded-full border border-[var(--ast-mint)]/45 bg-[rgba(4,164,90,0.14)] px-2 py-0.5 text-[11px] text-[var(--ast-bone)]">
                        {Object.values(challengeGuideChecks).filter(Boolean).length}/
                        {challengeGuideItems.length}
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {challengeGuideItems.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 rounded border border-[var(--ast-mint)]/30 bg-[rgba(4,12,31,0.58)] px-3 py-2 text-sm text-[var(--ast-bone)]"
                        >
                          <input
                            type="checkbox"
                            checked={challengeGuideChecks[item.id]}
                            onChange={() =>
                              toggleChallengeGuideStep(item.id)
                            }
                            className="h-4 w-4 accent-[var(--ast-mint)]"
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

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
            className={`relative overflow-hidden rounded-2xl border border-[#2d5387]/58 bg-[linear-gradient(160deg,rgba(9,21,52,0.95),rgba(5,13,32,0.95))] shadow-[0_14px_30px_rgba(3,10,24,0.44)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.62),rgba(76,150,255,0.05))] ${forumCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"}`}
          >
            <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 ${forumCollapsed ? "" : "mb-5 border-b border-[var(--ast-sky)]/18 pb-3"}`}>
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                {forumStepMeta && (
                  <span
                    className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                      forumStepMeta.isActive
                        ? "bg-[var(--ast-mint)] text-[var(--ast-black)]"
                        : "bg-[var(--ast-cobalt)]/65 text-[var(--ast-sky)]"
                    }`}
                  >
                    {forumStepMeta.order}
                  </span>
                )}
                <div className="min-w-0">
                  {forumStepMeta && (
                    <p className="inline-flex rounded-full border border-[var(--ast-sky)]/30 bg-[rgba(7,27,63,0.5)] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--ast-sky)]/90">
                      {forumStepMeta.status}
                    </p>
                  )}
                  <h2 className={`mt-1 font-black tracking-tight text-[#4beaa4] ${forumCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}>
                    Foro de Discusión
                  </h2>
                  {forumCollapsed && (
                    <p className="mt-1 text-sm text-[#9db4d6]">
                      {forumStepDone
                        ? "Participación lista o completada"
                        : "Comparte tu aprendizaje en el foro"}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForumCollapsed((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ast-sky)]/28 bg-[rgba(4,12,31,0.4)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d8e7ff] transition hover:border-[var(--ast-sky)]/48 hover:text-white"
              >
                {forumCollapsed ? "Expandir" : "Colapsar"}
                <span aria-hidden="true" className="text-[11px] leading-none">
                  {forumCollapsed ? "▾" : "▴"}
                </span>
              </button>
            </div>

            {!forumCollapsed && (
              <>
                {previewMode ? (
                  <div className="mt-4 rounded-xl border border-dashed border-white/20 bg-[rgba(4,12,31,0.46)] p-6">
                    <h3 className="mb-2 text-lg font-bold text-[var(--ast-yellow)]">
                      Te gusto este lab?
                    </h3>
                    <p className="mb-4 text-[#d6e4fb]">
                      Crea una cuenta para desbloquear todos los dias y participar en el foro.
                    </p>
                    <Link
                      href="/login"
                      className="inline-block rounded-full bg-[var(--ast-emerald)] px-5 py-2 font-semibold text-black hover:bg-[var(--ast-forest)]"
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

function buildChallengeGuideItems(challengeBlocks: DayBlock[]): ChallengeGuideStep[] {
  const stepIds: ChallengeGuideStepId[] = ["scan", "filter", "publish"];
  const fallbackLabels = [
    "Revisé la consigna del reto",
    "Ejecuté la actividad principal",
    "Registré mi resultado final",
  ];

  const candidates = collectChallengeGuideCandidates(challengeBlocks);
  const resolvedLabels = [...candidates];
  while (resolvedLabels.length < stepIds.length) {
    resolvedLabels.push(fallbackLabels[resolvedLabels.length]);
  }

  return stepIds.map((id, index) => ({
    id,
    label: `${index + 1}) ${limitText(resolvedLabels[index], 72)}`,
  }));
}

function collectChallengeGuideCandidates(challengeBlocks: DayBlock[]): string[] {
  const textCandidates: string[] = [];

  for (const block of challengeBlocks) {
    if (block.type === "checklist") {
      for (const item of block.items ?? []) {
        textCandidates.push(item.text);
      }
      continue;
    }

    if (block.type === "text") {
      textCandidates.push(...splitTextLines(stripRichText(block.text ?? "")));
      continue;
    }

    if (block.type === "quiz") {
      for (const question of block.questions ?? []) {
        textCandidates.push(question.prompt);
      }
      continue;
    }

    if (block.caption) {
      textCandidates.push(block.caption);
    }
  }

  const uniqueLabels: string[] = [];
  const seen = new Set<string>();
  for (const candidate of textCandidates) {
    const normalized = normalizeChallengeGuideCandidate(candidate);
    if (!normalized) continue;
    const fingerprint = normalizeSummaryText(normalized);
    if (!fingerprint || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    uniqueLabels.push(normalized);
    if (uniqueLabels.length === 3) break;
  }

  return uniqueLabels;
}

function normalizeChallengeGuideCandidate(raw: string): string {
  const base = firstSentence(stripRichText(raw))
    .replace(/^\s*(paso|step)\s*\d+\s*[:.)-]?\s*/i, "")
    .replace(/^\s*\d+\s*[:.)-]\s*/, "")
    .trim();

  if (base.length < 8) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
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
