"use client";

import Link from "next/link";
import Forum from "../Forum";
import type { WorkflowTone } from "./types";

type ForumSectionProps = {
  labId: string;
  dayNumber: number;
  discussionPrompt: string;
  previewMode: boolean;
  forumCollapsed: boolean;
  setForumCollapsed: (fn: (prev: boolean) => boolean) => void;
  forumStepDone: boolean;
  forumStatus: "Listo" | "Actual" | "Pendiente";
  forumTone: WorkflowTone;
  forumContainerToneClass: string;
  forumActiveHaloClass: string;
  forumStepMeta: { order: number; status: string; isActive: boolean } | undefined;
  handleForumActivityChange: (arg: { commentCount: number; hasUserComment: boolean }) => void;
};

export function ForumSection({
  labId,
  dayNumber,
  discussionPrompt,
  previewMode,
  forumCollapsed,
  setForumCollapsed,
  forumStepDone,
  forumStatus,
  forumTone,
  forumContainerToneClass,
  forumActiveHaloClass,
  forumStepMeta,
  handleForumActivityChange,
}: ForumSectionProps) {
  return (
    <section
      id="day-forum"
      className={`relative overflow-hidden rounded-2xl border shadow-[0_14px_30px_rgba(3,10,24,0.44)] transition-all duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px ${forumContainerToneClass} ${forumCollapsed ? "p-3 md:p-4" : "p-5 md:p-6"} ${forumActiveHaloClass}`}
    >
      <div
        className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 ${forumCollapsed ? "" : `mb-5 border-b ${forumStatus === "Actual" ? "border-[#4da3ff]/24" : "border-[var(--ast-sky)]/18"} pb-3`}`}
      >
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
              <p
                className={`inline-flex rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.15em] ${forumTone.statusBadgeClass}`}
              >
                {forumStepMeta.status}
              </p>
            )}
            <h2
              className={`mt-1 font-black tracking-tight ${forumTone.titleClass} ${forumCollapsed ? "text-xl" : "text-[1.9rem] md:text-[2.05rem]"}`}
            >
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

      <div className={`grid transition-all duration-300 ease-in-out ${forumCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="min-h-0 overflow-hidden">
      <div className="pt-1">
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
              dayNumber={dayNumber}
              discussionPrompt={discussionPrompt}
              onActivityChange={handleForumActivityChange}
            />
          )}
      </div>
      </div>
      </div>
    </section>
  );
}
