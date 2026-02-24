export type DayBlockType =
  | "text"
  | "video"
  | "audio"
  | "image"
  | "file"
  | "checklist"
  | "quiz";

export type DayBlockGroup = "resource" | "challenge";
export type DayBlockRole = "primary" | "support";

export type DayChecklistItem = {
  id: string;
  text: string;
};

export type DayQuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  explanation?: string;
};

export type DayBlock = {
  id: string;
  type: DayBlockType;
  group?: DayBlockGroup;
  role?: DayBlockRole;
  title?: string;
  text?: string;
  url?: string;
  caption?: string;
  items?: DayChecklistItem[];
  questions?: DayQuizQuestion[];
};

type DayContentPayload = {
  version: 2;
  blocks: DayBlock[];
  discussionPrompt?: string;
};

function createId(prefix: string): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  );
}

export function createChecklistItem(text = ""): DayChecklistItem {
  return {
    id: createId("check"),
    text,
  };
}

export function createQuizQuestion(): DayQuizQuestion {
  return {
    id: createId("quiz"),
    prompt: "",
    options: ["", ""],
    correctIndex: 0,
    explanation: "",
  };
}

export function createBlock(type: DayBlockType): DayBlock {
  const id = createId("block");
  const group = getDefaultDayBlockGroup(type);
  const role: DayBlockRole = "support";

  if (type === "text") {
    return { id, type, group, role, text: "" };
  }

  if (type === "checklist") {
    return {
      id,
      type,
      group,
      role,
      title: "",
      items: [createChecklistItem()],
    };
  }

  if (type === "quiz") {
    return {
      id,
      type,
      group,
      role,
      title: "",
      questions: [createQuizQuestion()],
    };
  }

  return { id, type, group, role, url: "", caption: "" };
}

export function getDefaultDayBlockGroup(type: DayBlockType): DayBlockGroup {
  if (type === "checklist" || type === "quiz") return "challenge";
  return "resource";
}

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function serializeDayBlocks(
  blocks: DayBlock[],
  options?: { discussionPrompt?: string | null },
): string {
  const cleanBlocks = blocks.map((block) => sanitizeBlock(block));
  const discussionPrompt =
    typeof options?.discussionPrompt === "string"
      ? options.discussionPrompt.trim()
      : "";

  const payload: DayContentPayload = {
    version: 2,
    blocks: cleanBlocks,
  };
  if (discussionPrompt) {
    payload.discussionPrompt = discussionPrompt;
  }

  return JSON.stringify(payload);
}

export function parseDayBlocks(
  content: string | null | undefined,
  legacyVideoUrl?: string | null,
): DayBlock[] {
  const blocksFromJson = parseBlocksFromJson(content);
  if (blocksFromJson.length > 0) return blocksFromJson;

  const blocks: DayBlock[] = [];
  if (legacyVideoUrl) {
    blocks.push({
      id: "legacy_video",
      type: "video",
      group: "resource",
      role: "primary",
      url: legacyVideoUrl,
      caption: "",
    });
  }

  const trimmed = content?.trim();
  if (trimmed) {
    blocks.push({
      id: "legacy_text",
      type: "text",
      group: "resource",
      role: legacyVideoUrl ? "support" : "primary",
      text: trimmed,
    });
  }

  return blocks;
}

export function parseDayDiscussionPrompt(
  content: string | null | undefined,
): string {
  if (!content) return "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return "";
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "";
  }

  const payload = parsed as Record<string, unknown>;
  const candidate =
    typeof payload.discussionPrompt === "string"
      ? payload.discussionPrompt
      : typeof payload.discussion_prompt === "string"
        ? payload.discussion_prompt
        : "";

  return candidate.trim();
}

function sanitizeBlock(block: DayBlock): DayBlock {
  const group = normalizeGroup(block.group, block.type);
  const role = normalizeRole(block.role, block.type, group);

  if (block.type === "text") {
    return {
      id: block.id,
      type: block.type,
      group,
      role,
      text: typeof block.text === "string" ? block.text : "",
    };
  }

  if (block.type === "checklist") {
    return {
      id: block.id,
      type: block.type,
      group,
      role,
      title: typeof block.title === "string" ? block.title : "",
      items: normalizeChecklistItems(block.items),
    };
  }

  if (block.type === "quiz") {
    return {
      id: block.id,
      type: block.type,
      group,
      role,
      title: typeof block.title === "string" ? block.title : "",
      questions: normalizeQuizQuestions(block.questions),
    };
  }

  return {
    id: block.id,
    type: block.type,
    group,
    role,
    url: typeof block.url === "string" ? block.url : "",
    caption: typeof block.caption === "string" ? block.caption : "",
  };
}

function parseBlocksFromJson(content: string | null | undefined): DayBlock[] {
  if (!content) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const blocksCandidate = getBlocksCandidate(parsed);
  if (!Array.isArray(blocksCandidate)) return [];

  const blocks: DayBlock[] = [];

  for (const rawBlock of blocksCandidate) {
    if (!rawBlock || typeof rawBlock !== "object") continue;

    const record = rawBlock as Record<string, unknown>;
    const type = record.type;
    if (
      type !== "text" &&
      type !== "video" &&
      type !== "audio" &&
      type !== "image" &&
      type !== "file" &&
      type !== "checklist" &&
      type !== "quiz"
    ) {
      continue;
    }

    const idValue = record.id;
    const id = typeof idValue === "string" && idValue ? idValue : createBlock(type).id;
    const group = normalizeGroup(record.group, type);
    const role = normalizeRole(record.role, type, group);

    if (type === "text") {
      blocks.push({
        id,
        type,
        group,
        role,
        text: typeof record.text === "string" ? record.text : "",
      });
      continue;
    }

    if (type === "checklist") {
      blocks.push({
        id,
        type,
        group,
        role,
        title: typeof record.title === "string" ? record.title : "",
        items: normalizeChecklistItems(record.items),
      });
      continue;
    }

    if (type === "quiz") {
      blocks.push({
        id,
        type,
        group,
        role,
        title: typeof record.title === "string" ? record.title : "",
        questions: normalizeQuizQuestions(record.questions),
      });
      continue;
    }

    blocks.push({
      id,
      type,
      group,
      role,
      url: typeof record.url === "string" ? record.url : "",
      caption: typeof record.caption === "string" ? record.caption : "",
    });
  }

  return blocks;
}

function normalizeChecklistItems(raw: unknown): DayChecklistItem[] {
  if (!Array.isArray(raw)) return [];

  const items: DayChecklistItem[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      items.push(createChecklistItem(entry));
      continue;
    }

    if (!entry || typeof entry !== "object") continue;

    const record = entry as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text : "";
    const id =
      typeof record.id === "string" && record.id
        ? record.id
        : createChecklistItem().id;

    items.push({ id, text });
  }

  return items;
}

function normalizeQuizQuestions(raw: unknown): DayQuizQuestion[] {
  if (!Array.isArray(raw)) return [];

  const questions: DayQuizQuestion[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;

    const record = entry as Record<string, unknown>;
    const prompt = typeof record.prompt === "string" ? record.prompt : "";
    const options = Array.isArray(record.options)
      ? record.options.filter((item): item is string => typeof item === "string")
      : [];

    const correctIndex =
      typeof record.correctIndex === "number" && Number.isFinite(record.correctIndex)
        ? record.correctIndex
        : null;

    const id =
      typeof record.id === "string" && record.id ? record.id : createQuizQuestion().id;

    questions.push({
      id,
      prompt,
      options,
      correctIndex,
      explanation:
        typeof record.explanation === "string" ? record.explanation : "",
    });
  }

  return questions;
}

function getBlocksCandidate(parsed: unknown): unknown {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const payload = parsed as Record<string, unknown>;
    return payload.blocks;
  }
  return undefined;
}

function normalizeGroup(raw: unknown, type: DayBlockType): DayBlockGroup {
  if (raw === "resource" || raw === "challenge") return raw;
  return getDefaultDayBlockGroup(type);
}

function normalizeRole(
  raw: unknown,
  type: DayBlockType,
  group: DayBlockGroup,
): DayBlockRole {
  if (group === "challenge") return "support";
  if (raw === "primary" || raw === "support") return raw;
  if (type === "video") return "support";
  return "support";
}
