"use client";

import React from "react";
import type { AdminComment } from "../types";

interface CommentsTabProps {
  selectedLab: string | null;
  commentDayFilter: string;
  setCommentDayFilter: (value: string) => void;
  comments: AdminComment[];
  commentsMsg: string;
  setCommentsRefreshTick: React.Dispatch<React.SetStateAction<number>>;
  deleteComment: (commentId: string) => Promise<void>;
}

export default function CommentsTab({
  selectedLab,
  commentDayFilter,
  setCommentDayFilter,
  comments,
  commentsMsg,
  setCommentsRefreshTick,
  deleteComment,
}: CommentsTabProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ast-yellow)]/18 bg-[linear-gradient(160deg,rgba(8,20,52,0.88),rgba(4,12,32,0.95))] shadow-[0_24px_48px_rgba(1,5,18,0.55)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(253,244,139,0.4),transparent)]">
      <div className="border-b border-[var(--ast-yellow)]/20 bg-[rgba(253,244,139,0.07)] px-6 py-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--ast-yellow)]">Módulo 04</p>
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-black tracking-tight text-[var(--ui-text)]">
          Moderación de Comentarios
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--ast-yellow)]/65">Revisa y elimina comentarios del foro por lab y día.</p>
      </div>

      <div className="p-6">
        {!selectedLab ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[var(--ast-sky)]/20 text-sm text-[var(--ui-muted)]/60">
            Selecciona un lab para moderar comentarios.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Controls */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]/70">Filtrar por día</label>
                <input
                  type="number"
                  min={1}
                  value={commentDayFilter}
                  onChange={(e) => setCommentDayFilter(e.target.value)}
                  placeholder="Todos"
                  className="w-28 rounded-lg border border-[var(--ast-sky)]/18 bg-[rgba(3,10,27,0.82)] px-3 py-2 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-muted)]/40 focus:border-[var(--ast-sky)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--ui-primary)]/16"
                />
              </div>
              <button
                type="button"
                onClick={() => setCommentsRefreshTick((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ui-border)]/35 bg-[rgba(255,255,255,0.04)] px-4 py-2 text-[11px] font-semibold text-[var(--ui-muted)] transition hover:border-[var(--ast-sky)]/35 hover:text-[var(--ui-text)]"
              >
                ↻ Refrescar
              </button>
              {commentsMsg && (
                <p className="text-[12px] font-medium text-[var(--ast-yellow)]">◈ {commentsMsg}</p>
              )}
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-2 rounded-lg border border-[var(--ast-sky)]/12 bg-[rgba(10,86,198,0.06)] px-4 py-2.5">
              <span className="font-[family-name:var(--font-geist-mono)] text-xl font-black text-[var(--ast-sky)]">{comments.length}</span>
              <span className="text-[11px] text-[var(--ui-muted)]">
                {comments.length === 1 ? "comentario encontrado" : "comentarios encontrados"}
              </span>
            </div>

            {/* Comment list */}
            {comments.length === 0 ? (
              <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-[var(--ast-sky)]/18 text-sm text-[var(--ui-muted)]/50">
                Sin comentarios en este filtro.
              </div>
            ) : (
              <div className="max-h-[520px] space-y-2.5 overflow-auto pr-1 [scrollbar-width:thin]">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="group rounded-xl border border-[var(--ast-sky)]/12 bg-[rgba(3,10,27,0.55)] p-4 transition hover:border-[var(--ast-sky)]/22"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-[family-name:var(--font-geist-mono)] text-[11px] font-medium text-[var(--ast-sky)]/80">
                          Día {comment.day_number}
                          <span className="mx-1.5 text-[var(--ui-border)]">·</span>
                          {comment.user_email ?? "Sin correo"}
                        </p>
                        <p className="text-[10px] text-[var(--ui-muted)]/55">
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteComment(comment.id)}
                        className="rounded-md border border-[var(--ast-rust)]/28 bg-[rgba(136,31,0,0.08)] px-2.5 py-1 text-[10px] font-semibold text-[var(--ast-coral)]/80 opacity-0 transition hover:bg-[rgba(136,31,0,0.2)] hover:text-[var(--ast-coral)] group-hover:opacity-100"
                      >
                        Borrar
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--ui-text)]/80">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
