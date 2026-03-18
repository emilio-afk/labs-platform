import {
  getDefaultDayBlockGroup,
  type DayBlock,
  type DayBlockGroup,
  type DayBlockRole,
} from "@/utils/dayBlocks";
import { hasRichTextContent, normalizeRichTextInput } from "@/utils/richText";
import type { DayPublishCheck, DayPublishChecklist } from "../types";

export function normalizeBlockRole(
  role: DayBlockRole | undefined,
  group: DayBlockGroup,
): DayBlockRole {
  if (group === "challenge") return "support";
  return role === "primary" ? "primary" : "support";
}

export function buildDayDraftSignature(input: {
  dayNumber: number;
  dayTitle: string;
  dayDiscussionPrompt: string;
  blocks: DayBlock[];
}): string {
  return JSON.stringify({
    dayNumber: input.dayNumber,
    dayTitle: input.dayTitle.trim(),
    dayDiscussionPrompt: input.dayDiscussionPrompt.trim(),
    blocks: input.blocks,
  });
}

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function normalizeDayBlocksForSave(blocks: DayBlock[]): DayBlock[] {
  return blocks
    .map((block) => {
      const group: DayBlockGroup = block.group ?? getDefaultDayBlockGroup(block.type);
      const role: DayBlockRole = normalizeBlockRole(block.role, group);

      if (block.type === "text") {
        const normalizedText = normalizeRichTextInput(block.text ?? "");
        return {
          ...block,
          group,
          role,
          text: normalizedText,
        };
      }

      if (block.type === "checklist") {
        const items = (block.items ?? [])
          .map((item) => ({
            id: item.id,
            text: normalizeRichTextInput(item.text ?? ""),
          }))
          .filter((item) => hasRichTextContent(item.text));

        return {
          ...block,
          group,
          role,
          title: normalizeRichTextInput(block.title ?? ""),
          items,
        };
      }

      if (block.type === "quiz") {
        const questions = (block.questions ?? [])
          .map((question) => {
            const options = (question.options ?? [])
              .map((option) => option.trim())
              .filter(Boolean);

            const hasValidCorrect =
              typeof question.correctIndex === "number" &&
              question.correctIndex >= 0 &&
              question.correctIndex < options.length;

            return {
              id: question.id,
              prompt: normalizeRichTextInput(question.prompt ?? ""),
              options,
              correctIndex: hasValidCorrect ? question.correctIndex : null,
              explanation: normalizeRichTextInput(question.explanation ?? ""),
            };
          })
          .filter((question) => hasRichTextContent(question.prompt) && question.options.length >= 2);

        return {
          ...block,
          group,
          role,
          title: normalizeRichTextInput(block.title ?? ""),
          questions,
        };
      }

      if (block.type === "challenge_steps") {
        const steps = (block.steps ?? [])
          .map((step, index) => ({
            id: step.id,
            label: step.label?.trim() || `Paso ${index + 1}`,
            text: normalizeRichTextInput(step.text ?? ""),
          }))
          .filter((step) => hasRichTextContent(step.text));

        return {
          ...block,
          group,
          role,
          title: normalizeRichTextInput(block.title ?? ""),
          steps,
        };
      }

      return {
        ...block,
        group,
        role,
        url: block.url?.trim() ?? "",
        caption: block.caption?.trim() ?? "",
      };
    })
    .filter((block) => {
      if (block.type === "text") return hasRichTextContent(block.text ?? "");
      if (block.type === "checklist") return (block.items?.length ?? 0) > 0;
      if (block.type === "quiz") return (block.questions?.length ?? 0) > 0;
      if (block.type === "challenge_steps") return (block.steps?.length ?? 0) > 0;
      return Boolean(block.url);
    });
}

export function buildDayPublishChecklist(
  dayTitle: string,
  dayDiscussionPrompt: string,
  blocks: DayBlock[],
): DayPublishChecklist {
  const normalizedBlocks = normalizeDayBlocksForSave(blocks);
  const resourceBlocks = normalizedBlocks.filter(
    (block) => (block.group ?? getDefaultDayBlockGroup(block.type)) === "resource",
  );
  const challengeBlocks = normalizedBlocks.filter(
    (block) => (block.group ?? getDefaultDayBlockGroup(block.type)) === "challenge",
  );
  const hasExplicitPrimary = resourceBlocks.some((block) => block.role === "primary");

  const checks: DayPublishCheck[] = [
    {
      id: "title",
      label: "Título del día definido",
      done: dayTitle.trim().length > 0,
      required: true,
    },
    {
      id: "content",
      label: "Al menos 1 bloque con contenido",
      done: normalizedBlocks.length > 0,
      required: true,
    },
    {
      id: "resource",
      label: "Incluye bloque en Recurso principal",
      done: resourceBlocks.length > 0,
      required: true,
    },
    {
      id: "primary",
      label: "Marca el bloque principal (ruta)",
      done: hasExplicitPrimary,
      required: false,
    },
    {
      id: "challenge",
      label: "Incluye bloque en Reto del día",
      done: challengeBlocks.length > 0,
      required: false,
    },
    {
      id: "forum_prompt",
      label: "Prompt del foro personalizado",
      done: dayDiscussionPrompt.trim().length > 0,
      required: false,
    },
  ];

  return {
    checks,
    requiredReady: checks.filter((check) => check.required).every((check) => check.done),
    normalizedBlocks,
    resourceBlocksCount: resourceBlocks.length,
    challengeBlocksCount: challengeBlocks.length,
  };
}

export function cloneDayBlocks(blocks: DayBlock[]): DayBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as DayBlock[];
}

export function getBlocksSignature(blocks: DayBlock[]): string {
  return JSON.stringify(blocks);
}

export function ensurePrimaryResourceBlock(blocks: DayBlock[]): DayBlock[] {
  const resourceIndexes = blocks
    .map((block, index) =>
      (block.group ?? getDefaultDayBlockGroup(block.type)) === "resource" ? index : -1,
    )
    .filter((index) => index >= 0);

  if (resourceIndexes.length === 0) return blocks;

  const existingPrimaryIndex = blocks.findIndex(
    (block) =>
      (block.group ?? getDefaultDayBlockGroup(block.type)) === "resource" &&
      block.role === "primary",
  );
  const selectedPrimaryIndex =
    existingPrimaryIndex >= 0 ? existingPrimaryIndex : resourceIndexes[0];

  return blocks.map((block, index) => {
    const group = block.group ?? getDefaultDayBlockGroup(block.type);
    const nextRole = normalizeBlockRole(
      index === selectedPrimaryIndex ? "primary" : "support",
      group,
    );
    if (block.role === nextRole) return block;
    return { ...block, role: nextRole };
  });
}
