"use client";

import {
  parseDayBlocks,
  parseDayDiscussionPrompt,
} from "@/utils/dayBlocks";
import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import type { DayContent } from "./lab-content/types";
import {
  findPrimaryResourceBlock,
  getPrimaryRouteLabel,
  getQuizResult,
  estimateDayMinutes,
  canRenderResourceSidebarItem,
  buildDiscussionPrompt,
} from "./lab-content/utils/blockUtils";
import { useHeroPortal } from "./lab-content/hooks/useHeroPortal";
import { useSectionNavigation } from "./lab-content/hooks/useSectionNavigation";
import { useForumParticipation } from "./lab-content/hooks/useForumParticipation";
import { useResourceStep } from "./lab-content/hooks/useResourceStep";
import { useDayState } from "./lab-content/hooks/useDayState";
import { useDayCompletion } from "./lab-content/hooks/useDayCompletion";
import { useWorkflowSteps } from "./lab-content/hooks/useWorkflowSteps";
import { WorkflowPanel } from "./lab-content/WorkflowPanel";
import { ResourceSection } from "./lab-content/ResourceSection";
import { ChallengeSection } from "./lab-content/ChallengeSection";
import { ForumSection } from "./lab-content/ForumSection";

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

  const { routeMounted, heroRouteSlot } = useHeroPortal(currentDay.id);
  const {
    resourceCollapsed, setResourceCollapsed,
    challengeCollapsed, setChallengeCollapsed,
    forumCollapsed, setForumCollapsed,
    goToResource, goToChallenge, goToForum,
  } = useSectionNavigation();
  const { hasUserForumComment, forumMarkerLoaded, handleForumActivityChange } =
    useForumParticipation(labId, currentDay.day_number);
  const {
    checklistSelections,
    challengeNotes, setChallengeNotes,
    quizAnswers,
    revealedQuizzes,
    bootCompleted,
    challengeResponseSaved,
    challengeSavedSnapshot,
    challengeSaveFeedback,
    challengeManualLoaded,
    toggleChecklistItem,
    answerQuizQuestion,
    revealQuiz,
    saveChallengeResponse,
  } = useDayState(labId, currentDay.day_number);

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

  const challengeChecklistBlocks = challengeBlocks.filter(
    (block) => block.type === "checklist" && (block.items?.length ?? 0) > 0,
  );
  const challengeQuizBlocks = challengeBlocks.filter(
    (block) => block.type === "quiz" && (block.questions?.length ?? 0) > 0,
  );

  const hasChallengeWork = showChallengeSection;
  const hasForumStep = !previewMode;
  const challengeHasInteractiveBlocks =
    challengeChecklistBlocks.length > 0 || challengeQuizBlocks.length > 0;
  const challengeChecklistCompleted =
    challengeChecklistBlocks.length === 0 ||
    challengeChecklistBlocks.every((block) => {
      const selected = new Set(checklistSelections[block.id] ?? []);
      const itemCount = block.items?.length ?? 0;
      const doneCount = (block.items ?? []).filter((item) => selected.has(item.id)).length;
      return itemCount > 0 && doneCount === itemCount;
    });
  const challengeQuizCompleted =
    challengeQuizBlocks.length === 0 ||
    challengeQuizBlocks.every((block) => {
      const result = getQuizResult(block, quizAnswers[block.id] ?? {});
      return result.total > 0 && result.answered === result.total;
    });
  const challengeInteractionCompleted = challengeChecklistCompleted && challengeQuizCompleted;
  const challengeStepDone =
    !hasChallengeWork ||
    challengeResponseSaved ||
    (bootCompleted && challengeHasInteractiveBlocks && challengeInteractionCompleted);
  const forumStepDone = !hasForumStep || hasUserForumComment;

  // useResourceStep must come before useDayCompletion so resourceStepCompleted is defined
  const { resourceStepCompleted, toggleResourceStep } = useResourceStep(
    labId,
    currentDay.day_number,
    initialCompleted,
  );

  const { progressSyncError, clearProgressError } = useDayCompletion({
    labId,
    dayNumber: currentDay.day_number,
    initialCompleted,
    previewMode,
    allStepsCompleted: resourceStepCompleted && challengeStepDone && forumStepDone,
    bootCompleted,
    challengeManualLoaded,
    forumMarkerLoaded,
    onDayCompleted,
  });

  // Compose toggle with error clear after both hooks are available
  const handleToggleResourceStep = useCallback(() => {
    toggleResourceStep();
    clearProgressError();
  }, [toggleResourceStep, clearProgressError]);

  const {
    workflowSteps,
    activeWorkflowStepId,
    activeWorkflowStep,
    activeWorkflowStepIndex,
    allWorkflowStepsCompleted,
    activeWorkflowHint,
    nextWorkflowHint,
    resourceTone,
    challengeTone,
    forumTone,
    resourceStatus,
    challengeStatus,
    forumStatus,
    resourceContainerToneClass,
    challengeContainerToneClass,
    forumContainerToneClass,
    challengeSurfaceToneClass,
    challengeLabelToneClass,
    challengeAccentBorderClass,
    challengeFocusBorderClass,
    challengeHintToneClass,
    resourceActiveHaloClass,
    challengeActiveHaloClass,
    forumActiveHaloClass,
    workflowTotalCount,
    resourceStepMeta,
    challengeStepMeta,
    forumStepMeta,
  } = useWorkflowSteps({
    primaryRouteLabel,
    videoStepDone: resourceStepCompleted,
    challengeStepDone,
    forumStepDone,
    hasChallengeWork,
    hasForumStep,
    challengeHasInteractiveBlocks,
    goToResource,
    goToChallenge,
    goToForum,
  });

  const sharedBlockProps = {
    primaryResourceBlockId,
    primaryResourceVideoId,
    labPosterUrl,
    labTitle,
    checklistSelections,
    quizAnswers,
    revealedQuizzes,
    toggleChecklistItem,
    answerQuizQuestion,
    revealQuiz,
    challengeSurfaceToneClass,
    challengeLabelToneClass,
    challengeAccentBorderClass,
  };

  return (
    <>
      {heroRouteSlot
        ? createPortal(
            <WorkflowPanel
              heroRouteSlot={heroRouteSlot}
              allWorkflowStepsCompleted={allWorkflowStepsCompleted}
              activeWorkflowStep={activeWorkflowStep}
              activeWorkflowStepIndex={activeWorkflowStepIndex}
              workflowTotalCount={workflowTotalCount}
              workflowSteps={workflowSteps}
              activeWorkflowStepId={activeWorkflowStepId}
              activeWorkflowHint={activeWorkflowHint}
              nextWorkflowHint={nextWorkflowHint}
            />,
            heroRouteSlot,
          )
        : routeMounted
          ? (
            <WorkflowPanel
              heroRouteSlot={null}
              allWorkflowStepsCompleted={allWorkflowStepsCompleted}
              activeWorkflowStep={activeWorkflowStep}
              activeWorkflowStepIndex={activeWorkflowStepIndex}
              workflowTotalCount={workflowTotalCount}
              workflowSteps={workflowSteps}
              activeWorkflowStepId={activeWorkflowStepId}
              activeWorkflowHint={activeWorkflowHint}
              nextWorkflowHint={nextWorkflowHint}
            />
          )
          : null}

      {resources.length > 1 && (
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
          <ResourceSection
            dayNumber={currentDay.day_number}
            resourceBlocksForRender={resourceBlocksForRender}
            primaryResourceVideoBlock={primaryResourceVideoBlock}
            resourceSidebarBlocks={resourceSidebarBlocks}
            remainingResourceBlocks={remainingResourceBlocks}
            useResourceSidebarLayout={useResourceSidebarLayout}
            estimatedMinutes={estimatedMinutes}
            resourceCollapsed={resourceCollapsed}
            setResourceCollapsed={setResourceCollapsed}
            resourceTone={resourceTone}
            resourceContainerToneClass={resourceContainerToneClass}
            resourceActiveHaloClass={resourceActiveHaloClass}
            resourceStepMeta={resourceStepMeta}
            resourceStepCompleted={resourceStepCompleted}
            toggleResourceStep={handleToggleResourceStep}
            progressSyncError={progressSyncError}
            previewMode={previewMode}
            {...sharedBlockProps}
          />
        )}

        {showChallengeSection && (
          <ChallengeSection
            dayNumber={currentDay.day_number}
            challengeBlocks={challengeBlocks}
            challengeNotes={challengeNotes}
            setChallengeNotes={setChallengeNotes}
            challengeResponseSaved={challengeResponseSaved}
            challengeSavedSnapshot={challengeSavedSnapshot}
            challengeSaveFeedback={challengeSaveFeedback}
            challengeStepDone={challengeStepDone}
            challengeHasInteractiveBlocks={challengeHasInteractiveBlocks}
            challengeCollapsed={challengeCollapsed}
            setChallengeCollapsed={setChallengeCollapsed}
            challengeTone={challengeTone}
            challengeStatus={challengeStatus}
            challengeContainerToneClass={challengeContainerToneClass}
            challengeActiveHaloClass={challengeActiveHaloClass}
            challengeFocusBorderClass={challengeFocusBorderClass}
            challengeHintToneClass={challengeHintToneClass}
            challengeStepMeta={challengeStepMeta}
            showResourceSection={showResourceSection}
            previewMode={previewMode}
            resourceStepCompleted={resourceStepCompleted}
            toggleResourceStep={handleToggleResourceStep}
            progressSyncError={progressSyncError}
            saveChallengeResponse={saveChallengeResponse}
            {...sharedBlockProps}
          />
        )}

        <ForumSection
          labId={labId}
          dayNumber={currentDay.day_number}
          discussionPrompt={discussionPrompt}
          previewMode={previewMode}
          forumCollapsed={forumCollapsed}
          setForumCollapsed={setForumCollapsed}
          forumStepDone={forumStepDone}
          forumStatus={forumStatus}
          forumTone={forumTone}
          forumContainerToneClass={forumContainerToneClass}
          forumActiveHaloClass={forumActiveHaloClass}
          forumStepMeta={forumStepMeta}
          handleForumActivityChange={handleForumActivityChange}
        />
      </div>
    </>
  );
}
