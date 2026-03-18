import { isMissingColumnError } from "@/utils/labMeta";
import type { DayBlockType, DayBlockGroup, DayBlockRole, DayResourceSlot } from "@/utils/dayBlocks";
import type { AdminDay } from "../types";

export function getBlockTypeLabel(type: DayBlockType): string {
  if (type === "text") return "Texto";
  if (type === "video") return "Video";
  if (type === "audio") return "Audio";
  if (type === "image") return "Imagen";
  if (type === "file") return "Documento";
  if (type === "checklist") return "Checklist";
  if (type === "quiz") return "Quiz";
  if (type === "challenge_steps") return "Reto guiado";
  return type;
}

export function getFileAcceptForBlock(type: DayBlockType): string {
  if (type === "video") return "video/*";
  if (type === "audio") return "audio/*";
  if (type === "image") return "image/*";
  if (type === "file") return ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip";
  return "*/*";
}

export function formatMoney(amountCents: number, currency: "USD" | "MXN" | string) {
  const safeAmount = Number.isFinite(amountCents) ? amountCents : 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "MXN",
  }).format(safeAmount / 100);
}

export function normalizeLabels(labels: string[] | null | undefined): string[] {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => (typeof label === "string" ? label.trim().toUpperCase() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

export function formatLabelsForInput(labels: string[] | null | undefined): string {
  return normalizeLabels(labels).join(", ");
}

export function parseLabelsInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

export function getNextDayNumber(days: AdminDay[]): number {
  if (days.length === 0) return 1;
  const maxDay = Math.max(...days.map((day) => day.day_number));
  return Number.isFinite(maxDay) ? maxDay + 1 : 1;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, [contenteditable='true'], [contenteditable=''], [role='textbox']",
    ),
  );
}

export function canUseResourceLink(type: DayBlockType): boolean {
  return type === "video" || type === "audio" || type === "image" || type === "file";
}

export function normalizeResourceSlotForBuilder(
  slot: DayResourceSlot | undefined,
  type: DayBlockType,
  group: DayBlockGroup,
  role: DayBlockRole,
): DayResourceSlot {
  if (group !== "resource" || role === "primary") return "none";

  if (slot === "text") return type === "text" ? "text" : "none";
  if (slot === "download") return type === "file" ? "download" : "none";
  if (slot === "media") return type === "image" ? "media" : "none";
  if (slot === "link") return canUseResourceLink(type) ? "link" : "none";
  return "none";
}

export function isMissingLabelsColumnError(message: string): boolean {
  return isMissingColumnError(message, "labels");
}

export function isMissingLabMetaColumnsError(message: string): boolean {
  return (
    isMissingColumnError(message, "slug") ||
    isMissingColumnError(message, "cover_image_url") ||
    isMissingColumnError(message, "accent_color")
  );
}

export function isDuplicateSlugError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate key") &&
    (lower.includes("slug") || lower.includes("labs_slug"))
  );
}
