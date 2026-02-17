export type DayBlockType = "text" | "video" | "audio" | "image";

export type DayBlock = {
  id: string;
  type: DayBlockType;
  text?: string;
  url?: string;
  caption?: string;
};

type DayContentPayload = {
  version: 1;
  blocks: DayBlock[];
};

export function createBlock(type: DayBlockType): DayBlock {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `block_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  if (type === "text") {
    return { id, type, text: "" };
  }
  return { id, type, url: "", caption: "" };
}

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function serializeDayBlocks(blocks: DayBlock[]): string {
  const cleanBlocks = blocks.map((block) => ({
    id: block.id,
    type: block.type,
    text: typeof block.text === "string" ? block.text : undefined,
    url: typeof block.url === "string" ? block.url : undefined,
    caption: typeof block.caption === "string" ? block.caption : undefined,
  }));

  const payload: DayContentPayload = {
    version: 1,
    blocks: cleanBlocks,
  };
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
      url: legacyVideoUrl,
      caption: "",
    });
  }

  const trimmed = content?.trim();
  if (trimmed) {
    blocks.push({
      id: "legacy_text",
      type: "text",
      text: trimmed,
    });
  }

  return blocks;
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
    if (type !== "text" && type !== "video" && type !== "audio" && type !== "image") {
      continue;
    }

    const idValue = record.id;
    const id = typeof idValue === "string" && idValue ? idValue : createBlock(type).id;

    if (type === "text") {
      blocks.push({
        id,
        type,
        text: typeof record.text === "string" ? record.text : "",
      });
      continue;
    }

    blocks.push({
      id,
      type,
      url: typeof record.url === "string" ? record.url : "",
      caption: typeof record.caption === "string" ? record.caption : "",
    });
  }

  return blocks;
}

function getBlocksCandidate(parsed: unknown): unknown {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const payload = parsed as Record<string, unknown>;
    return payload.blocks;
  }
  return undefined;
}
