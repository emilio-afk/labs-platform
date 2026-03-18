import { extractYouTubeVideoId, parseDayBlocks, type DayBlock } from "@/utils/dayBlocks";
import { stripRichText } from "@/utils/richText";

export function findPrimaryResourceBlock(
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

export function getPrimaryRouteLabel(block: DayBlock | undefined): string {
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

export function getQuizResult(
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

  return { total: questions.length, answered, correct };
}

export function estimateDayMinutes(
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

export function canRenderResourceSidebarItem(block: DayBlock): boolean {
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

export function hasVisibleTextContent(rawHtml: string): boolean {
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

export function buildDiscussionPrompt(challengeBlocks: DayBlock[]): string {
  const challengeText = getBlockPlainText(challengeBlocks);
  const candidate = firstSentence(challengeText);
  if (candidate) {
    return `¿Cómo aplicarías esto en tu caso real?: ${limitText(candidate, 120)}`;
  }
  return "¿Qué cambiaste en tu forma de trabajar después de este reto?";
}
