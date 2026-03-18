"use client";

import { extractYouTubeVideoId, type DayBlock as DayBlockType } from "@/utils/dayBlocks";
import { sanitizeRichText } from "@/utils/richText";
import VideoPlayer from "../VideoPlayer";
import { hasVisibleTextContent, getQuizResult } from "./utils/blockUtils";

type ChallengeTone = {
  challengeSurfaceToneClass: string;
  challengeLabelToneClass: string;
  challengeAccentBorderClass: string;
};

type DayBlockProps = {
  block: DayBlockType;
  index: number;
  section: "resource" | "challenge";
  // Video
  primaryResourceBlockId: string | null;
  primaryResourceVideoId: string | null;
  labPosterUrl?: string | null;
  labTitle?: string;
  // Interaction
  checklistSelections: Record<string, string[]>;
  quizAnswers: Record<string, Record<string, number>>;
  revealedQuizzes: Record<string, boolean>;
  toggleChecklistItem: (blockId: string, itemId: string) => void;
  answerQuizQuestion: (blockId: string, questionId: string, optionIndex: number) => void;
  revealQuiz: (blockId: string) => void;
  // Challenge tone
  tone: ChallengeTone;
};

export function DayBlock({
  block,
  index,
  section,
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
  tone,
}: DayBlockProps) {
  const { challengeSurfaceToneClass, challengeLabelToneClass, challengeAccentBorderClass } = tone;

  if (block.type === "text") {
    const safeHtml = sanitizeRichText(block.text ?? "");
    if (!hasVisibleTextContent(safeHtml)) return null;

    if (section === "challenge") {
      return (
        <div className={`lg:col-span-2 rounded-lg border p-4 ${challengeSurfaceToneClass}`}>
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
      <div className="lg:col-span-2 rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 text-[var(--ui-text-soft)]">
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
      <div className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3 space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.url}
          alt={block.caption || "Imagen del dia"}
          className="w-full rounded-lg border border-[var(--ast-sky)]/30"
          loading="lazy"
        />
        {block.caption && <p className="text-sm text-[var(--ui-muted)]">{block.caption}</p>}
      </div>
    );
  }

  if (block.type === "audio") {
    return (
      <div className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-3 space-y-2">
        <audio controls className="w-full" src={block.url} />
        {block.caption && <p className="text-sm text-[var(--ui-muted)]">{block.caption}</p>}
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
      <div className={videoCardClassName}>
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
        {block.caption && <p className="text-sm text-[var(--ui-muted)]">{block.caption}</p>}
      </div>
    );
  }

  if (block.type === "file") {
    const fileLabel = block.caption?.trim() || "Descargar documento";
    return (
      <div
        id={`resource-${block.id}`}
        className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4"
      >
        <p className="text-xs uppercase tracking-widest text-[var(--ui-muted)] mb-1">Recurso descargable</p>
        <p className="text-sm text-[var(--ui-text)] mb-3">{fileLabel}</p>
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--ast-sky)]/40 bg-[rgba(10,86,198,0.22)] px-4 py-2 text-sm font-semibold text-[var(--ast-sky)] transition-all duration-200 hover:border-[var(--ast-sky)]/62 hover:bg-[rgba(10,86,198,0.32)] active:scale-95"
        >
          <span className="text-base leading-none">↗</span>
          Abrir documento
        </a>
      </div>
    );
  }

  if (block.type === "checklist") {
    const selected = new Set(checklistSelections[block.id] ?? []);
    const itemCount = block.items?.length ?? 0;
    const doneCount = (block.items ?? []).filter((item) => selected.has(item.id)).length;
    const allDone = itemCount > 0 && doneCount === itemCount;
    const titleHtml = sanitizeRichText(block.title ?? "");
    const hasTitle = hasVisibleTextContent(titleHtml);

    return (
      <div className={`rounded-lg border p-4 space-y-3 transition-all duration-300 ${
        allDone
          ? "border-[var(--ast-mint)]/42 bg-[rgba(4,164,90,0.08)]"
          : "border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)]"
      }`}>
        <div className="flex items-center justify-between gap-3">
          {hasTitle ? (
            <div
              className={`text-lg font-semibold transition-colors duration-300 [&_p]:my-0.5 ${allDone ? "text-[var(--state-done-text)]" : "text-[var(--ast-mint)]"}`}
              dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
          ) : (
            <h3 className={`text-lg font-semibold transition-colors duration-300 ${allDone ? "text-[var(--state-done-text)]" : "text-[var(--ast-mint)]"}`}>
              Checklist del dia
            </h3>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-300 ${
            allDone
              ? "border-[var(--ast-mint)]/45 bg-[rgba(4,164,90,0.18)] text-[var(--state-done-text)]"
              : "border-[rgba(185,214,254,0.2)] bg-[rgba(255,255,255,0.06)] text-[var(--ui-text-soft)]"
          }`}>
            {allDone && <span className="text-[10px]">✓</span>}
            {doneCount}/{itemCount}
          </span>
        </div>

        {allDone && (
          <p className="text-[12px] font-medium text-[var(--state-done-hint)]">
            ¡Todos los ítems completados!
          </p>
        )}

        <div className="space-y-2">
          {(block.items ?? []).map((item) => {
            const checked = selected.has(item.id);
            const itemHtml = sanitizeRichText(item.text ?? "");
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleChecklistItem(block.id, item.id)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all duration-200 active:scale-[0.99] ${
                  checked
                    ? "border-[var(--ast-mint)]/38 bg-[rgba(4,164,90,0.1)]"
                    : "border-[var(--ast-sky)]/28 bg-[rgba(3,10,24,0.55)] hover:border-[var(--ast-sky)]/44 hover:bg-[rgba(3,10,24,0.72)]"
                }`}
              >
                {/* Custom checkbox */}
                <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all duration-200 ${
                  checked
                    ? "border-[var(--ast-mint)] bg-[rgba(4,164,90,0.22)] text-[var(--ast-mint)] shadow-[0_0_8px_rgba(4,164,90,0.3)]"
                    : "border-[rgba(185,214,254,0.35)] bg-transparent"
                }`}>
                  {checked && (
                    <span className="text-[11px] font-bold leading-none">✓</span>
                  )}
                </span>
                <div
                  className={`whitespace-pre-wrap transition-all duration-200 [&_p]:my-0.5 ${
                    checked
                      ? "text-[var(--state-done-hint)] line-through opacity-65"
                      : "text-[var(--ui-text)]"
                  }`}
                  dangerouslySetInnerHTML={{ __html: itemHtml }}
                />
              </button>
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
    const titleHtml = sanitizeRichText(block.title ?? "");
    const hasTitle = hasVisibleTextContent(titleHtml);
    const scorePercent = quizResult.total > 0
      ? Math.round((quizResult.correct / quizResult.total) * 100)
      : 0;

    return (
      <div className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          {hasTitle ? (
            <div
              className="text-lg font-semibold text-[var(--ast-sky)] [&_p]:my-0.5"
              dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
          ) : (
            <h3 className="text-lg font-semibold text-[var(--ast-sky)]">Quiz rápido</h3>
          )}
          {revealResults && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-all duration-300 ${
              scorePercent === 100
                ? "border-[var(--ast-mint)]/45 bg-[rgba(4,164,90,0.18)] text-[var(--state-done-text)]"
                : scorePercent >= 60
                  ? "border-[var(--ast-sky-bright)]/40 bg-[rgba(77,163,255,0.14)] text-[var(--ast-sky-text)]"
                  : "border-[rgba(240,120,80,0.4)] bg-[rgba(200,60,30,0.12)] text-[var(--state-error-text)]"
            }`}>
              {scorePercent === 100 && <span className="text-[10px]">✓</span>}
              {quizResult.correct}/{quizResult.total}
            </span>
          )}
        </div>

        <div className="space-y-4">
          {(block.questions ?? []).map((question, questionIndex) => {
            const selectedOption = answersForBlock[question.id];
            const hasAnswer = selectedOption !== undefined;
            const hasCorrectAnswer =
              typeof question.correctIndex === "number" && question.correctIndex >= 0;
            const isCorrect = hasCorrectAnswer && selectedOption === question.correctIndex;
            const promptHtml = sanitizeRichText(question.prompt ?? "");
            const explanationHtml = sanitizeRichText(question.explanation ?? "");
            const hasExplanation = hasVisibleTextContent(explanationHtml);

            return (
              <div
                key={question.id}
                className="rounded-lg border border-[var(--ast-sky)]/28 bg-[rgba(3,10,24,0.55)] p-3 space-y-2.5"
              >
                <div className="text-sm font-semibold text-[var(--ast-bone)]">
                  <span className="mr-1 text-[var(--ast-sky)]/70">{questionIndex + 1}.</span>
                  <span
                    className="whitespace-pre-wrap [&_p]:my-0.5 inline"
                    dangerouslySetInnerHTML={{ __html: promptHtml }}
                  />
                </div>

                <div className="space-y-1.5">
                  {(question.options ?? []).map((option, optionIndex) => {
                    const isSelected = selectedOption === optionIndex;
                    const isCorrectOption = hasCorrectAnswer && optionIndex === question.correctIndex;
                    const isWrongSelected = revealResults && isSelected && !isCorrectOption;

                    let optionClass = "";
                    let circleClass = "";
                    let circleContent: string = String.fromCharCode(65 + optionIndex);

                    if (revealResults) {
                      if (isCorrectOption) {
                        optionClass = "border-[var(--ast-mint)]/48 bg-[rgba(4,164,90,0.13)] text-[var(--state-done)]";
                        circleClass = "border-[var(--ast-mint)] bg-[rgba(4,164,90,0.22)] text-[var(--ast-mint)]";
                        circleContent = "✓";
                      } else if (isWrongSelected) {
                        optionClass = "border-[rgba(220,60,40,0.38)] bg-[rgba(180,40,20,0.1)] text-[var(--state-error-text)] opacity-75";
                        circleClass = "border-[rgba(220,60,40,0.5)] bg-[rgba(180,40,20,0.2)] text-[var(--state-error-text)]";
                        circleContent = "✗";
                      } else {
                        optionClass = "border-[var(--ast-sky)]/16 bg-transparent text-[var(--ui-muted)] opacity-50";
                        circleClass = "border-[rgba(185,214,254,0.2)] text-[var(--ui-muted)]";
                      }
                    } else if (isSelected) {
                      optionClass = "border-[var(--ast-sky-bright)]/52 bg-[rgba(77,163,255,0.13)] text-[var(--ast-sky)]";
                      circleClass = "border-[var(--ast-sky-bright)] bg-[rgba(77,163,255,0.2)] text-[var(--ast-sky-text)]";
                      circleContent = "●";
                    } else {
                      optionClass = "border-[var(--ast-sky)]/24 bg-[rgba(3,10,24,0.35)] text-[var(--ui-text-soft)] hover:border-[var(--ast-sky)]/42 hover:bg-[rgba(77,163,255,0.07)]";
                      circleClass = "border-[rgba(185,214,254,0.28)] text-[var(--ui-muted)]";
                    }

                    return (
                      <button
                        key={`${question.id}_${optionIndex}`}
                        type="button"
                        onClick={() => !revealResults && answerQuizQuestion(block.id, question.id, optionIndex)}
                        disabled={revealResults}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-all duration-200 active:scale-[0.99] ${optionClass} ${!revealResults ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-all duration-200 ${circleClass}`}>
                          {circleContent}
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>

                {revealResults && hasCorrectAnswer && (
                  <div className={`rounded-md border px-3 py-2 text-[12px] leading-relaxed transition-all duration-300 ${
                    isCorrect
                      ? "border-[var(--ast-mint)]/32 bg-[rgba(4,164,90,0.1)] text-[var(--state-done-hint)]"
                      : "border-[rgba(185,214,254,0.2)] bg-[rgba(4,12,31,0.5)] text-[var(--ui-muted)]"
                  }`}>
                    {isCorrect
                      ? "✓ Coincide con la referencia del ejercicio."
                      : `Referencia sugerida: ${(question.options ?? [])[question.correctIndex ?? 0] ?? "N/D"}`}
                    {hasExplanation && (
                      <div
                        className="mt-1.5 border-t border-[rgba(185,214,254,0.12)] pt-1.5 text-[var(--ui-muted)]/80"
                        dangerouslySetInnerHTML={{ __html: explanationHtml }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => revealQuiz(block.id)}
            disabled={revealResults}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-95 ${
              revealResults
                ? "border-[var(--ast-mint)]/40 bg-[rgba(4,164,90,0.12)] text-[var(--state-done-text)] cursor-default"
                : quizResult.answered === quizResult.total
                  ? "border-[var(--ast-sky)]/45 bg-[rgba(77,163,255,0.12)] text-[var(--ast-sky)] hover:border-[var(--ast-sky)]/65 hover:bg-[rgba(77,163,255,0.18)] cursor-pointer"
                  : "border-[var(--ast-sky)]/28 bg-transparent text-[var(--ui-muted)] opacity-70 cursor-pointer"
            }`}
          >
            <span className="text-base leading-none">
              {revealResults ? "✓" : "◎"}
            </span>
            {revealResults ? "Resultados revelados" : "Comparar con referencia"}
          </button>
          {!revealResults && (
            <p className="text-[12px] text-[var(--ui-muted)]">
              {quizResult.answered}/{quizResult.total} respondidas
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
