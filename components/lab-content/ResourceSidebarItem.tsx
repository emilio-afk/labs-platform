"use client";

import type { DayBlock } from "@/utils/dayBlocks";
import { sanitizeRichText } from "@/utils/richText";
import { hasVisibleTextContent } from "./utils/blockUtils";

export function ResourceSidebarItem({ block, index }: { block: DayBlock; index: number }) {
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
}
