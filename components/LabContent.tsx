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

type WorkflowStepId = "resource" | "challenge" | "forum";

type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  done: boolean;
  helperText: string;
  onClick: () => void;
};

type WorkflowStatus = "Listo" | "Actual" | "Pendiente";

type WorkflowTone = {
  stepBadgeClass: string;
  statusBadgeClass: string;
  titleClass: string;
  metaClass: string;
  toggleButtonClass: string;
};

const EMPTY_DAY_STATE: DayLocalState = {
  notes: "",
  checklistSelections: {},
  quizAnswers: {},
};

function getWorkflowTone(status: WorkflowStatus): WorkflowTone {
  if (status === "Actual") {
    return {
      stepBadgeClass: "bg-[var(--ast-mint)] text-[var(--ast-black)]",
      statusBadgeClass:
        "border-[var(--ast-mint)]/55 bg-[rgba(4,164,90,0.16)] text-[var(--ast-mint)]",
      titleClass: "text-[#54efb3]",
      metaClass: "text-[#9fe2c4]",
      toggleButtonClass:
        "border-[var(--ast-mint)]/30 bg-[rgba(0,44,32,0.28)] text-[#bde8d6] hover:border-[var(--ast-mint)]/52 hover:text-[#e8fff5]",
    };
  }

  if (status === "Listo") {
    return {
      stepBadgeClass: "bg-[var(--ast-cobalt)]/72 text-[#e2efff]",
      statusBadgeClass:
        "border-[var(--ast-sky)]/42 bg-[rgba(7,68,168,0.24)] text-[var(--ast-sky)]",
      titleClass: "text-[#d8e7ff]",
      metaClass: "text-[#a8c0e2]",
      toggleButtonClass:
        "border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.42)] text-[#d8e7ff] hover:border-[var(--ast-sky)]/48 hover:text-white",
    };
  }

  return {
    stepBadgeClass: "bg-[#d9e8ff] text-[#0f2348]",
    statusBadgeClass:
      "border-[var(--ast-sky)]/24 bg-[rgba(4,12,31,0.46)] text-[#9fb7da]",
    titleClass: "text-[#d8e7ff]",
    metaClass: "text-[#93abd0]",
    toggleButtonClass:
      "border-[var(--ast-sky)]/22 bg-[rgba(4,12,31,0.34)] text-[#bcd2ef] hover:border-[var(--ast-sky)]/42 hover:text-[#e2efff]",
  };
}

export default function LabContent({
  currentDay,
  labId,
  initialCompleted,
  onDayCompleted,
  previewMode = false,
  labTitle,
  labPosterUrl,
}: {
  currentDay: DayContent;
  labId: string;
  initialCompleted: boolean;
  onDayCompleted?: (dayNumber: number, completed: boolean) => void;
  previewMode?: boolean;
  labTitle?: string;
  labPosterUrl?: string | null;
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
  const [resourceStepCompleted, setResourceStepCompleted] = useState(initialCompleted);
  const [resourceCollapsed, setResourceCollapsed] = useState(true);
  const [challengeCollapsed, setChallengeCollapsed] = useState(true);
  const [forumCollapsed, setForumCollapsed] = useState(true);
  const [hasUserForumComment, setHasUserForumComment] = useState(false);
  const [challengeResponseSaved, setChallengeResponseSaved] = useState(false);
  const [challengeSavedSnapshot, setChallengeSavedSnapshot] = useState("");
  const [challengeSaveFeedback, setChallengeSaveFeedback] = useState("");
  const [dayCompletionSynced, setDayCompletionSynced] = useState(initialCompleted);
  const [progressSyncError, setProgressSyncError] = useState("");
  const [challengeManualLoaded, setChallengeManualLoaded] = useState(false);
  const [forumMarkerLoaded, setForumMarkerLoaded] = useState(false);
  const progressSyncInFlightRef = useRef(false);
  const forumCommentMarkerKey = useMemo(
    () => `astrolab_forum_commented_${labId}_${currentDay.day_number}`,
    [currentDay.day_number, labId],
  );
  const challengeManualStateKey = useMemo(
    () => `astrolab_challenge_manual_${labId}_${currentDay.day_number}`,
    [currentDay.day_number, labId],
  );
  const resourceManualStateKey = useMemo(
    () => `astrolab_resource_manual_${labId}_${currentDay.day_number}`,
    [currentDay.day_number, labId],
  );

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
    setResourceStepCompleted(initialCompleted);
    setDayCompletionSynced(initialCompleted);
    setProgressSyncError("");
    setChallengeManualLoaded(false);
    setForumMarkerLoaded(false);
  }, [initialCompleted, currentDay.day_number, labId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawResource = window.localStorage.getItem(resourceManualStateKey);
    if (rawResource === "1") {
      setResourceStepCompleted(true);
    } else if (rawResource === "0") {
      setResourceStepCompleted(false);
    } else {
      setResourceStepCompleted(initialCompleted);
    }
  }, [initialCompleted, resourceManualStateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(resourceManualStateKey, resourceStepCompleted ? "1" : "0");
  }, [resourceManualStateKey, resourceStepCompleted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(challengeManualStateKey);
    setChallengeSaveFeedback("");
    if (!raw) {
      setChallengeResponseSaved(false);
      setChallengeSavedSnapshot("");
      setChallengeManualLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        saved?: boolean;
        snapshot?: string;
      };
      setChallengeResponseSaved(Boolean(parsed.saved));
      setChallengeSavedSnapshot(typeof parsed.snapshot === "string" ? parsed.snapshot : "");
    } catch {
      setChallengeResponseSaved(false);
      setChallengeSavedSnapshot("");
    }
    setChallengeManualLoaded(true);
  }, [challengeManualStateKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      challengeManualStateKey,
      JSON.stringify({
        saved: challengeResponseSaved,
        snapshot: challengeSavedSnapshot,
      }),
    );
  }, [challengeManualStateKey, challengeResponseSaved, challengeSavedSnapshot]);

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
    if (typeof document === "undefined") return;
    setRouteMounted(true);
    setHeroRouteSlot(document.getElementById("day-route-hero-slot"));
  }, [currentDay.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasUserForumComment(window.localStorage.getItem(forumCommentMarkerKey) === "1");
    setForumMarkerLoaded(true);
  }, [forumCommentMarkerKey]);

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
  const resourceBlocksForRender = resourceBlocks;
  const primaryResourceVideoBlock = useMemo(
    () =>
      resourceBlocksForRender.find(
        (block) => block.id === primaryResourceBlockId && block.type === "video",
      ) ?? null,
    [primaryResourceBlockId, resourceBlocksForRender],
  );
  const resourceSidebarBlocks = useMemo(
    () =>
      resourceBlocksForRender.filter((block) => {
        if (block.id === primaryResourceBlockId) return false;
        return canRenderResourceSidebarItem(block);
      }),
    [primaryResourceBlockId, resourceBlocksForRender],
  );
  const useResourceSidebarLayout = Boolean(primaryResourceVideoBlock);
  const remainingResourceBlocks = useMemo(() => {
    if (!useResourceSidebarLayout || !primaryResourceVideoBlock) {
      return resourceBlocksForRender;
    }

    const excludedIds = new Set<string>([
      primaryResourceVideoBlock.id,
      ...resourceSidebarBlocks.map((block) => block.id),
    ]);
    return resourceBlocksForRender.filter((block) => !excludedIds.has(block.id));
  }, [
    primaryResourceVideoBlock,
    resourceSidebarBlocks,
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

  const hasChallengeWork =
    showChallengeSection || checklistBlocks.length > 0 || quizBlocks.length > 0;
  const hasForumStep = !previewMode;
  const videoStepDone = resourceStepCompleted;
  const challengeStepDone = !hasChallengeWork || challengeResponseSaved;
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
      { order: number; status: WorkflowStatus; isActive: boolean }
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
  const resourceStatus: WorkflowStatus = resourceStepMeta?.status ?? "Pendiente";
  const challengeStatus: WorkflowStatus = challengeStepMeta?.status ?? "Pendiente";
  const forumStatus: WorkflowStatus = forumStepMeta?.status ?? "Pendiente";
  const resourceTone = getWorkflowTone(resourceStatus);
  const challengeTone = getWorkflowTone(challengeStatus);
  const forumTone = getWorkflowTone(forumStatus);
  const resourceContainerToneClass =
    resourceStatus === "Actual"
      ? "border-[rgba(4,164,90,0.42)] before:bg-[linear-gradient(90deg,rgba(4,164,90,0.05),rgba(4,164,90,0.62),rgba(4,164,90,0.05))]"
      : "border-[#2d5387]/58 before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.65),rgba(76,150,255,0.05))]";
  const challengeContainerToneClass =
    challengeStatus === "Actual"
      ? "border-[rgba(4,164,90,0.42)] before:bg-[linear-gradient(90deg,rgba(4,164,90,0.05),rgba(4,164,90,0.62),rgba(4,164,90,0.05))]"
      : "border-[#2d5387]/58 before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.65),rgba(76,150,255,0.05))]";
  const forumContainerToneClass =
    forumStatus === "Actual"
      ? "border-[rgba(4,164,90,0.42)] bg-[linear-gradient(160deg,rgba(9,21,52,0.95),rgba(5,13,32,0.95))] before:bg-[linear-gradient(90deg,rgba(4,164,90,0.05),rgba(4,164,90,0.62),rgba(4,164,90,0.05))]"
      : forumStatus === "Pendiente"
        ? "border-[rgba(76,150,255,0.68)] bg-[linear-gradient(160deg,rgba(13,33,78,0.96),rgba(7,18,45,0.96))] ring-1 ring-[rgba(76,150,255,0.2)] before:bg-[linear-gradient(90deg,rgba(76,150,255,0.12),rgba(76,150,255,0.82),rgba(76,150,255,0.12))]"
        : "border-[#2d5387]/62 bg-[linear-gradient(160deg,rgba(9,21,52,0.95),rgba(5,13,32,0.95))] before:bg-[linear-gradient(90deg,rgba(76,150,255,0.05),rgba(76,150,255,0.62),rgba(76,150,255,0.05))]";
  const challengeSurfaceToneClass =
    challengeStatus === "Actual"
      ? "border-[var(--ast-mint)]/35 bg-[rgba(0,73,44,0.2)]"
      : "border-[var(--ast-sky)]/30 bg-[rgba(7,27,63,0.4)]";
  const challengeLabelToneClass =
    challengeStatus === "Actual" ? "text-[var(--ast-mint)]/90" : "text-[var(--ast-sky)]/90";
  const challengeAccentBorderClass =
    challengeStatus === "Actual" ? "border-[var(--ast-mint)]/35" : "border-[var(--ast-sky)]/30";
  const challengeFocusBorderClass =
    challengeStatus === "Actual" ? "focus:border-[var(--ast-mint)]" : "focus:border-[var(--ast-sky)]";
  const challengeHintToneClass =
    challengeStatus === "Actual" ? "text-[#9bcfc0]" : "text-[#9fb7da]";
  const resourceActiveHaloClass = resourceStepMeta?.isActive
    ? "ring-1 ring-[var(--ast-mint)]/55 shadow-[0_0_0_1px_rgba(4,164,90,0.38),0_0_30px_rgba(4,164,90,0.26),0_16px_34px_rgba(3,8,22,0.46)]"
    : "";
  const challengeActiveHaloClass = challengeStepMeta?.isActive
    ? "ring-1 ring-[var(--ast-mint)]/55 shadow-[0_0_0_1px_rgba(4,164,90,0.38),0_0_30px_rgba(4,164,90,0.26),0_16px_34px_rgba(2,12,11,0.5)]"
    : "";
  const forumActiveHaloClass = forumStepMeta?.isActive
    ? "ring-1 ring-[var(--ast-mint)]/52 shadow-[0_0_0_1px_rgba(4,164,90,0.34),0_0_28px_rgba(4,164,90,0.2),0_16px_34px_rgba(3,10,24,0.5)]"
    : "";

  const handleForumActivityChange = useCallback(
    ({ hasUserComment }: { commentCount: number; hasUserComment: boolean }) => {
      setHasUserForumComment(hasUserComment);
      if (typeof window !== "undefined") {
        if (hasUserComment) {
          window.localStorage.setItem(forumCommentMarkerKey, "1");
        } else {
          window.localStorage.removeItem(forumCommentMarkerKey);
        }
      }
    },
    [forumCommentMarkerKey],
  );

  const toggleResourceStep = useCallback(() => {
    setResourceStepCompleted((prev) => !prev);
    setProgressSyncError("");
  }, []);

  const saveChallengeResponse = useCallback(() => {
    const snapshot = normalizeChallengeSnapshot(challengeNotes);
    if (!snapshot) {
      setChallengeSaveFeedback("Escribe una respuesta antes de guardar.");
      setChallengeResponseSaved(false);
      setChallengeSavedSnapshot("");
      return;
    }

    setChallengeSavedSnapshot(snapshot);
    setChallengeResponseSaved(true);
    setChallengeSaveFeedback("Respuesta guardada. Paso marcado como listo.");

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        challengeManualStateKey,
        JSON.stringify({ saved: true, snapshot }),
      );
    }

    if (bootCompleted) {
      const payload: DayLocalState = {
        notes: challengeNotes,
        checklistSelections,
        quizAnswers,
      };
      void persistCloudState({
        labId,
        dayNumber: currentDay.day_number,
        payload,
        onStatus: setCloudSyncStatus,
      });
    }
  }, [
    bootCompleted,
    challengeManualStateKey,
    challengeNotes,
    checklistSelections,
    currentDay.day_number,
    labId,
    quizAnswers,
  ]);

  useEffect(() => {
    if (!challengeResponseSaved) return;
    const currentSnapshot = normalizeChallengeSnapshot(challengeNotes);
    if (!currentSnapshot || currentSnapshot !== challengeSavedSnapshot) {
      setChallengeResponseSaved(false);
      setChallengeSaveFeedback("");
    }
  }, [challengeNotes, challengeResponseSaved, challengeSavedSnapshot]);

  const allStepsCompleted = videoStepDone && challengeStepDone && forumStepDone;

  useEffect(() => {
    if (previewMode) return;
    if (!bootCompleted || !challengeManualLoaded || !forumMarkerLoaded) return;
    if (progressSyncInFlightRef.current) return;
    if (allStepsCompleted === dayCompletionSynced) return;

    progressSyncInFlightRef.current = true;
    setProgressSyncError("");

    void persistDayCompletion({
      labId,
      dayNumber: currentDay.day_number,
      completed: allStepsCompleted,
    })
      .then((ok) => {
        if (!ok) {
          setProgressSyncError("No se pudo sincronizar el estado del día.");
          return;
        }
        setDayCompletionSynced(allStepsCompleted);
        onDayCompleted?.(currentDay.day_number, allStepsCompleted);
      })
      .finally(() => {
        progressSyncInFlightRef.current = false;
      });
  }, [
    allStepsCompleted,
    bootCompleted,
    challengeManualLoaded,
    currentDay.day_number,
    dayCompletionSynced,
    forumMarkerLoaded,
    labId,
    onDayCompleted,
    previewMode,
  ]);

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
            className={`lg:col-span-2 rounded-lg border p-4 ${challengeSurfaceToneClass}`}
          >
            <p className={`mb-2 text-xs uppercase tracking-wider ${challengeLabelToneClass}`}>
              Paso {index + 1}
            </p>
            <div
              className="max-w-none whitespace-pre-wrap text-[15px] text-[var(--ast-bone)]/95 leading-7 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
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
            className="max-w-none whitespace-pre-wrap text-[15px] leading-7 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>
      );
    }

    if (block.type === "challenge_steps") {
      const steps = (block.steps ?? []).filter((step) =>
        hasVisibleTextContent(sanitizeRichText(step.text ?? "")),
      );
      if (steps.length === 0) return null;
      const titleHtml = sanitizeRichText(block.title ?? "");
      const hasTitle = hasVisibleTextContent(titleHtml);

      return (
        <div
          key={block.id}
          className={`lg:col-span-2 rounded-lg border p-4 ${section === "challenge" ? challengeSurfaceToneClass : "border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)]"}`}
        >
          {hasTitle && (
            <div
              className={`mb-3 text-base font-semibold [&_p]:my-0.5 ${section === "challenge" ? challengeLabelToneClass : "text-[var(--ast-sky)]/90"}`}
              dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
          )}
          <div className="space-y-2.5">
            {steps.map((step, stepIndex) => {
              const stepHtml = sanitizeRichText(step.text ?? "");
              return (
                <article
                  key={step.id}
                  className={`rounded-md border p-3 ${section === "challenge" ? challengeAccentBorderClass : "border-[var(--ast-sky)]/28"} bg-[rgba(3,10,24,0.55)]`}
                >
                  <p
                    className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${section === "challenge" ? challengeLabelToneClass : "text-[var(--ast-sky)]/88"}`}
                  >
                    {step.label?.trim() || `Paso ${stepIndex + 1}`}
                  </p>
                  <div
                    className="max-w-none whitespace-pre-wrap text-[15px] text-[var(--ast-bone)]/95 leading-7 [&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
                    dangerouslySetInnerHTML={{ __html: stepHtml }}
                  />
                </article>
              );
            })}
          </div>
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
              onFinished={() => {}}
              posterUrl={labPosterUrl}
              posterTitle={labTitle}
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
      const checklistTitleHtml = sanitizeRichText(block.title ?? "");
      const hasChecklistTitle = hasVisibleTextContent(checklistTitleHtml);

      return (
        <div
          key={block.id}
          className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            {hasChecklistTitle ? (
              <div
                className="text-lg font-semibold text-[var(--ast-mint)] [&_p]:my-0.5"
                dangerouslySetInnerHTML={{ __html: checklistTitleHtml }}
              />
            ) : (
              <h3 className="text-lg font-semibold text-[var(--ast-mint)]">
                Checklist del dia
              </h3>
            )}
            <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-[#d6e4fb]">
              {doneCount}/{itemCount}
            </span>
          </div>

          <div className="space-y-2">
            {(block.items ?? []).map((item) => {
              const checked = selected.has(item.id);
              const itemHtml = sanitizeRichText(item.text ?? "");
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
                  <div
                    className={`whitespace-pre-wrap [&_p]:my-0.5 ${checked ? "text-[#d6e4fb] line-through" : "text-[#e3ecfd]"}`}
                    dangerouslySetInnerHTML={{ __html: itemHtml }}
                  />
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
      const quizTitleHtml = sanitizeRichText(block.title ?? "");
      const hasQuizTitle = hasVisibleTextContent(quizTitleHtml);

      return (
        <div
          key={block.id}
          className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            {hasQuizTitle ? (
              <div
                className="text-lg font-semibold text-[var(--ast-sky)] [&_p]:my-0.5"
                dangerouslySetInnerHTML={{ __html: quizTitleHtml }}
              />
            ) : (
              <h3 className="text-lg font-semibold text-[var(--ast-sky)]">Quiz rapido</h3>
            )}
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
              const promptHtml = sanitizeRichText(question.prompt ?? "");
              const explanationHtml = sanitizeRichText(question.explanation ?? "");
              const hasExplanation = hasVisibleTextContent(explanationHtml);

              return (
                <div
                  key={question.id}
                  className="rounded border border-[var(--ast-sky)]/30 p-3 bg-[rgba(3,10,24,0.68)] space-y-2"
                >
                  <div className="text-sm font-semibold text-[var(--ast-bone)]">
                    <span className="mr-1">{questionIndex + 1}.</span>
                    <span
                      className="whitespace-pre-wrap [&_p]:my-0.5 inline"
                      dangerouslySetInnerHTML={{ __html: promptHtml }}
                    />
                  </div>

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

                  {revealResults && hasExplanation && (
                    <div
                      className="whitespace-pre-wrap text-xs text-[#9fb3d6] [&_p]:my-0.5"
                      dangerouslySetInnerHTML={{ __html: explanationHtml }}
                    />
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

  const renderResourceSidebarItem = (block: DayBlock, index: number) => {
    const slot = block.resourceSlot;

    if (slot === "text" && block.type === "text") {
      const safeHtml = sanitizeRichText(block.text ?? "");
      if (!hasVisibleTextContent(safeHtml)) return null;

      return (
        <div className="rounded-md border border-[var(--ast-sky)]/24 bg-[rgba(7,27,63,0.32)] p-2.5">
          <div
            className="max-w-none whitespace-pre-wrap text-xs leading-relaxed text-[var(--ast-bone)]/90 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>
      );
    }

    if (slot === "media" && block.type === "image" && typeof block.url === "string" && block.url.trim()) {
      return (
        <div className="rounded-md border border-[var(--ast-sky)]/24 bg-[rgba(7,27,63,0.32)] p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ast-sky)]/90">
            {block.caption?.trim() || `Imagen ${index + 1}`}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.caption?.trim() || `Imagen ${index + 1}`}
            loading="lazy"
            className="mt-2 w-full rounded-md border border-[var(--ast-sky)]/25 object-cover"
          />
        </div>
      );
    }

    if (slot === "link" && typeof block.url === "string" && block.url.trim()) {
      return (
        <div className="rounded-md border border-[var(--ast-sky)]/24 bg-[rgba(7,27,63,0.32)] p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ast-sky)]/90">
            {block.caption?.trim() || `Liga ${index + 1}`}
          </p>
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex text-xs font-semibold text-[var(--ast-sky)] hover:text-[var(--ast-mint)] hover:underline"
          >
            Abrir liga
          </a>
        </div>
      );
    }

    if (slot === "download" && block.type === "file" && typeof block.url === "string" && block.url.trim()) {
      return (
        <div className="rounded-md border border-[var(--ast-sky)]/24 bg-[rgba(7,27,63,0.32)] p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--ast-sky)]/90">
            {block.caption?.trim() || `Descargable ${index + 1}`}
          </p>
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex rounded bg-[var(--ast-cobalt)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--ast-atlantic)]"
          >
            Descargar
          </a>
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
                          ? "border-[var(--ast-sky)]/48 bg-[rgba(7,68,168,0.24)] text-[var(--ast-sky)]"
                          : isActive
                            ? "border-[var(--ast-mint)]/58 bg-[rgba(4,164,90,0.12)] text-[var(--ast-mint)]"
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
              className={`relative overflow-hidden rounded-2xl border bg-[linear-gradient(160deg,rgba(7,17,42,0.97),rgba(3,10,27,0.96))] shadow-[0_14px_30px_rgba(3,8,22,0.4)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px ${resourceContainerToneClass} ${resourceCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"} ${resourceActiveHaloClass}`}
            >
              <div className={resourceCollapsed ? "mb-0" : "mb-5 border-b border-[var(--ast-sky)]/18 pb-3"}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                    {resourceStepMeta && (
                      <span
                        className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${resourceTone.stepBadgeClass}`}
                      >
                        {resourceStepMeta.order}
                      </span>
                    )}
                    <div className="min-w-0">
                      {resourceStepMeta && (
                        <p className={`inline-flex rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] ${resourceTone.statusBadgeClass}`}>
                          {resourceStepMeta.status}
                        </p>
                      )}
                      <h2
                        className={`mt-1 font-black tracking-tight ${resourceTone.titleClass} ${resourceCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}
                      >
                        Recurso principal del Dia {currentDay.day_number}
                      </h2>
                      {resourceCollapsed && (
                        <p className={`mt-1 text-sm ${resourceTone.metaClass}`}>
                          {resourceBlocksForRender.length} bloques · ~{estimatedMinutes} min
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResourceCollapsed((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${resourceTone.toggleButtonClass}`}
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

                          <div className="mt-3 space-y-3">
                            {resourceSidebarBlocks.length > 0 ? (
                              resourceSidebarBlocks.map((block, index) => (
                                <div key={block.id}>{renderResourceSidebarItem(block, index)}</div>
                              ))
                            ) : (
                              <div className="rounded-md border border-[var(--ast-sky)]/24 bg-[rgba(7,27,63,0.32)] p-2.5">
                                <p className="text-[11px] leading-relaxed text-[#a7bfdc]">
                                  Configura desde Admin qué recursos mostrar en este panel.
                                </p>
                              </div>
                            )}
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

                  {!previewMode && (
                    <div className="mt-6 flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={toggleResourceStep}
                        className={`rounded-md border px-4 py-1.5 text-xs font-semibold transition ${
                          resourceStepCompleted
                            ? "border-[var(--ast-sky)]/55 bg-[rgba(7,68,168,0.34)] text-[var(--ast-sky)] hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
                            : "border-[var(--ast-sky)]/35 bg-transparent text-[var(--ast-sky)]/90 hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
                        }`}
                      >
                        {resourceStepCompleted
                          ? "Marcar recurso como pendiente"
                          : "Marcar recurso como listo"}
                      </button>
                      {progressSyncError && (
                        <p className="text-[11px] text-red-300">{progressSyncError}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {showChallengeSection && (
            <section
              id="day-challenge"
              className={`relative overflow-hidden rounded-2xl border bg-[linear-gradient(160deg,rgba(5,27,38,0.97),rgba(3,18,27,0.96))] shadow-[0_14px_30px_rgba(2,12,11,0.44)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px ${challengeContainerToneClass} ${challengeCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"} ${challengeActiveHaloClass}`}
            >
              <div
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 ${challengeCollapsed ? "mb-0" : `mb-5 border-b ${challengeStatus === "Actual" ? "border-[var(--ast-mint)]/18" : "border-[var(--ast-sky)]/18"} pb-3`}`}
              >
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                  {challengeStepMeta && (
                    <span
                      className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${challengeTone.stepBadgeClass}`}
                    >
                      {challengeStepMeta.order}
                    </span>
                  )}
                  <div className="min-w-0">
                    {challengeStepMeta && (
                      <p className={`inline-flex rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] ${challengeTone.statusBadgeClass}`}>
                        {challengeStepMeta.status}
                      </p>
                    )}
                    <h2 className={`mt-1 font-black tracking-tight ${challengeTone.titleClass} ${challengeCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}>
                      Reto del Dia {currentDay.day_number}
                    </h2>
                    {challengeCollapsed && (
                      <p className={`mt-1 text-sm ${challengeTone.metaClass}`}>
                        {challengeBlocks.length} bloques · estado: {challengeStepDone ? "listo" : "pendiente"}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChallengeCollapsed((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${challengeTone.toggleButtonClass}`}
                >
                  {challengeCollapsed ? "Expandir" : "Colapsar"}
                  <span aria-hidden="true" className="text-[11px] leading-none">
                    {challengeCollapsed ? "▾" : "▴"}
                  </span>
                </button>
              </div>

              {!challengeCollapsed && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {challengeBlocks.map((block, index) =>
                      renderDayBlock(block, index, "challenge"),
                    )}
                  </div>

                  <div className={`mt-4 rounded-lg border p-4 ${challengeSurfaceToneClass}`}>
                    <p className={`text-xs uppercase tracking-wider ${challengeLabelToneClass}`}>
                      Tu respuesta del reto
                    </p>
                    <textarea
                      value={challengeNotes}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setChallengeNotes(nextValue);
                        const nextSnapshot = normalizeChallengeSnapshot(nextValue);
                        if (
                          challengeResponseSaved &&
                          nextSnapshot !== challengeSavedSnapshot
                        ) {
                          setChallengeResponseSaved(false);
                        }
                        setChallengeSaveFeedback("");
                      }}
                      placeholder="Escribe aquí tu respuesta o reflexión del reto de hoy..."
                      rows={5}
                      className={`mt-2 w-full rounded-lg border bg-[rgba(4,12,31,0.72)] p-3 text-sm text-[var(--ast-bone)] outline-none ${challengeAccentBorderClass} ${challengeFocusBorderClass}`}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={saveChallengeResponse}
                        className="rounded-md border border-[var(--ast-mint)]/55 bg-[rgba(4,164,90,0.18)] px-3 py-1.5 text-xs font-semibold text-[var(--ast-mint)] transition hover:bg-[rgba(4,164,90,0.28)]"
                      >
                        Guardar respuesta
                      </button>
                      {challengeSaveFeedback && (
                        <p className="text-[11px] text-[#b7d4f6]">{challengeSaveFeedback}</p>
                      )}
                      {challengeResponseSaved && !challengeSaveFeedback && (
                        <p className="text-[11px] text-[#9bcfc0]">
                          Paso listo. Si editas el texto, vuelve a pendiente hasta guardar otra vez.
                        </p>
                      )}
                    </div>
                    <p className={`mt-1 text-[11px] ${challengeHintToneClass}`}>
                      El paso se marca como listo solo cuando guardas manualmente.
                    </p>
                  </div>

                  {!showResourceSection && !previewMode && (
                    <div className="mt-6 flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={toggleResourceStep}
                        className={`rounded-md border px-4 py-1.5 text-xs font-semibold transition ${
                          resourceStepCompleted
                            ? "border-[var(--ast-sky)]/55 bg-[rgba(7,68,168,0.34)] text-[var(--ast-sky)] hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
                            : "border-[var(--ast-sky)]/35 bg-transparent text-[var(--ast-sky)]/90 hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
                        }`}
                      >
                        {resourceStepCompleted
                          ? "Marcar recurso como pendiente"
                          : "Marcar recurso como listo"}
                      </button>
                      {progressSyncError && (
                        <p className="text-[11px] text-red-300">{progressSyncError}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <section
            id="day-forum"
            className={`relative overflow-hidden rounded-2xl border shadow-[0_14px_30px_rgba(3,10,24,0.44)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px ${forumContainerToneClass} ${forumCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"} ${forumActiveHaloClass}`}
          >
            <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 ${forumCollapsed ? "" : `mb-5 border-b ${forumStatus === "Actual" ? "border-[var(--ast-mint)]/18" : "border-[var(--ast-sky)]/18"} pb-3`}`}>
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                {forumStepMeta && (
                  <span
                    className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-bold ${forumTone.stepBadgeClass}`}
                  >
                    {forumStepMeta.order}
                  </span>
                )}
                <div className="min-w-0">
                  {forumStepMeta && (
                    <p className={`inline-flex rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] ${forumTone.statusBadgeClass}`}>
                      {forumStepMeta.status}
                    </p>
                  )}
                  <h2 className={`mt-1 font-black tracking-tight ${forumTone.titleClass} ${forumCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}>
                    Foro de Discusión
                  </h2>
                  {forumCollapsed && (
                    <p className={`mt-1 text-sm ${forumTone.metaClass}`}>
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${forumTone.toggleButtonClass}`}
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
  if (block.type === "challenge_steps") return "Reto guiado";
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
    if (block.type === "challenge_steps") {
      total += Math.max(5, (block.steps?.length ?? 0) * 2);
    }
  }

  return Math.min(90, Math.max(8, total));
}

function canRenderResourceSidebarItem(block: DayBlock): boolean {
  const slot = block.resourceSlot;
  if (slot === "text") {
    return block.type === "text" && stripRichText(block.text ?? "").trim().length > 0;
  }

  if (slot === "media") {
    return block.type === "image" && Boolean(block.url?.trim());
  }

  if (slot === "download") {
    return block.type === "file" && Boolean(block.url?.trim());
  }

  if (slot === "link") {
    return Boolean(block.url?.trim());
  }

  return false;
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
  if (textBlock) return stripRichText(textBlock.text ?? "");

  const stepsBlock = blocks.find((block) => block.type === "challenge_steps");
  if (!stepsBlock) return "";

  return (stepsBlock.steps ?? [])
    .map((step) => stripRichText(step.text ?? ""))
    .filter(Boolean)
    .join(" ");
}

function hasVisibleTextContent(rawHtml: string): boolean {
  return stripRichText(rawHtml).trim().length > 0;
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

function normalizeChallengeSnapshot(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
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

async function persistDayCompletion({
  labId,
  dayNumber,
  completed,
}: {
  labId: string;
  dayNumber: number;
  completed: boolean;
}): Promise<boolean> {
  try {
    const response = await fetch("/api/progress/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labId,
        dayNumber,
        completed,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
