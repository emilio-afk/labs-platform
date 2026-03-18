"use client";

import { extractYouTubeVideoId, type DayBlock } from "@/utils/dayBlocks";
import { hasRichTextContent, sanitizeRichText } from "@/utils/richText";
import { getBlockTypeLabel } from "../utils/formatting";

export function renderStudentBlockPreview(block: DayBlock) {
  if (block.type === "text") {
    const html = sanitizeRichText(block.text ?? "");
    if (!hasRichTextContent(html)) {
      return <p className="text-xs text-slate-400">Este bloque aún no tiene contenido.</p>;
    }
    return (
      <div
        className="prose prose-invert max-w-none text-xs leading-relaxed [&_p]:my-2 [&_h3]:my-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (block.type === "checklist") {
    const items = (block.items ?? []).filter((item) => hasRichTextContent(item.text));
    const checklistTitle = sanitizeRichText(block.title ?? "");
    return (
      <div className="space-y-2 text-xs">
        {hasRichTextContent(checklistTitle) && (
          <div
            className="font-semibold text-emerald-100 [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: checklistTitle }}
          />
        )}
        {items.length > 0 ? (
          <ul className="space-y-1 text-slate-200">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-start gap-1.5">
                <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <div
                  className="[&_p]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.text) }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">Agrega puntos al checklist para previsualizar.</p>
        )}
      </div>
    );
  }

  if (block.type === "quiz") {
    const question = (block.questions ?? []).find((item) => hasRichTextContent(item.prompt));
    if (!question) {
      return <p className="text-xs text-slate-400">Agrega al menos una pregunta.</p>;
    }
    const quizTitle = sanitizeRichText(block.title ?? "");
    const questionPrompt = sanitizeRichText(question.prompt ?? "");
    return (
      <div className="space-y-2 text-xs">
        {hasRichTextContent(quizTitle) && (
          <div
            className="font-semibold text-cyan-100 [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: quizTitle }}
          />
        )}
        <div
          className="font-medium text-slate-100 [&_p]:my-0.5"
          dangerouslySetInnerHTML={{ __html: questionPrompt }}
        />
        <ol className="space-y-1 text-slate-300">
          {question.options.filter(Boolean).slice(0, 4).map((option, index) => (
            <li key={`${question.id}_${index}`}>{index + 1}. {option}</li>
          ))}
        </ol>
      </div>
    );
  }

  if (block.type === "challenge_steps") {
    const steps = (block.steps ?? []).filter((step) => hasRichTextContent(step.text));
    const title = sanitizeRichText(block.title ?? "");
    return (
      <div className="space-y-2 text-xs">
        {hasRichTextContent(title) && (
          <div
            className="font-semibold text-emerald-100 [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: title }}
          />
        )}
        {steps.length > 0 ? (
          <div className="space-y-1.5">
            {steps.slice(0, 4).map((step, index) => (
              <div
                key={step.id}
                className="rounded border border-emerald-300/35 bg-emerald-500/8 px-2 py-1.5"
              >
                <p className="text-[10px] uppercase tracking-wider text-emerald-200/90">
                  {step.label?.trim() || `Paso ${index + 1}`}
                </p>
                <div
                  className="mt-1 text-slate-200 [&_p]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(step.text ?? "") }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">Agrega al menos un paso para previsualizar.</p>
        )}
      </div>
    );
  }

  if (block.type === "video") {
    const youtubeId = extractYouTubeVideoId(block.url);
    if (youtubeId) {
      return (
        <div className="space-y-2">
          <iframe
            className="h-32 w-full rounded border border-slate-600/80"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="Preview video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          {block.caption && <p className="text-xs text-slate-300">{block.caption}</p>}
        </div>
      );
    }
  }

  if (block.url?.trim()) {
    return (
      <div className="space-y-1 text-xs">
        <p className="font-medium text-slate-100">{block.caption || getBlockTypeLabel(block.type)}</p>
        <a
          href={block.url}
          target="_blank"
          rel="noreferrer"
          className="break-all text-cyan-200 underline hover:text-cyan-100"
        >
          {block.url}
        </a>
      </div>
    );
  }

  return <p className="text-xs text-slate-400">Carga archivo o URL para ver la vista previa.</p>;
}
