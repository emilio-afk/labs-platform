"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

type Comment = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  content: string;
  created_at: string;
};

export default function Forum({
  labId,
  dayNumber,
  discussionPrompt,
  onActivityChange,
}: {
  labId: string;
  dayNumber: number;
  discussionPrompt?: string;
  onActivityChange?: (activity: { commentCount: number; hasUserComment: boolean }) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const hasCustomPrompt = Boolean(discussionPrompt?.trim());
  const resolvedPrompt =
    discussionPrompt?.trim() || "Comparte algo que hayas aprendido el día de hoy.";
  const quickTemplates = [
    "Lo que detecté hoy: ...",
    "Qué ajustaré mañana: ...",
    "Mi nueva versión de solicitud: ...",
  ];

  useEffect(() => {
    let active = true;
    setAuthResolved(false);

    const loadForumData = async () => {
      try {
        const [{ data: authData }, { data: commentsData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("comments")
            .select("id, user_id, user_email, content, created_at")
            .eq("lab_id", labId)
            .eq("day_number", dayNumber)
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;
        setUser(authData.user);
        const nextComments = (commentsData as Comment[] | null) ?? [];
        setComments(nextComments);
        const hasUserComment = Boolean(
          authData.user && nextComments.some((comment) => comment.user_id === authData.user.id),
        );
        onActivityChange?.({
          commentCount: nextComments.length,
          hasUserComment,
        });

        if (authData.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", authData.user.id)
            .maybeSingle();
          if (!active) return;
          setIsAdmin(profile?.role === "admin");
        } else {
          setIsAdmin(false);
        }
      } finally {
        if (active) {
          setAuthResolved(true);
        }
      }
    };

    void loadForumData();

    return () => {
      active = false;
    };
  }, [dayNumber, labId, onActivityChange, refreshKey, supabase]);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    const { error } = await supabase.from("comments").insert([
      {
        lab_id: labId,
        day_number: dayNumber,
        user_id: user.id,
        user_email: user.email,
        content: newComment,
      },
    ]);

    if (!error) {
      setNewComment("");
      setRefreshKey((prev) => prev + 1);
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (!error) {
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    }
  };

  const insertTemplate = (template: string) => {
    setNewComment((prev) => (prev.trim() ? `${prev}\n\n${template}` : template));
  };

  return (
    <div className="mt-4">
      {!authResolved ? (
        <div className="mb-8 rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] px-4 py-3 text-sm text-[#9fb3d6]">
          Cargando foro...
        </div>
      ) : user ? (
        <form onSubmit={postComment} className="mb-8">
          <div className="mb-3 rounded-lg border border-[var(--ast-sky)]/35 bg-[var(--ast-indigo)]/26 p-3">
            <p className="text-xs uppercase tracking-wider text-[var(--ast-sky)]/80">
              Prompt de discusión
            </p>
            <p className="mt-1 text-sm text-[var(--ast-bone)]">
              {resolvedPrompt}
            </p>
            {!hasCustomPrompt && (
              <ul className="mt-2 space-y-1 text-xs text-[#9fb3d6]">
                <li>1. ¿Qué aprendiste hoy?</li>
                <li>2. ¿Cómo lo aplicarías en tu trabajo o estudio?</li>
                <li>3. ¿Qué duda o siguiente paso te llevas?</li>
              </ul>
            )}
          </div>
          <textarea
            className="w-full rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.72)] p-4 text-[var(--ast-bone)] outline-none focus:border-[var(--ast-mint)]"
            placeholder="Comparte tu aprendizaje con estructura: qué viste, qué corregirás y ejemplo aplicado."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {quickTemplates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => insertTemplate(template)}
                className="rounded-full border border-[var(--ast-sky)]/45 bg-[rgba(10,86,198,0.18)] px-3 py-1 text-xs text-[var(--ast-sky)] transition hover:border-[var(--ast-mint)] hover:text-[var(--ast-mint)]"
              >
                + {template}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="mt-2 rounded-lg bg-[var(--ast-mint)] px-6 py-2 font-bold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)]"
          >
            Publicar comentario
          </button>
        </form>
      ) : (
        <p className="mb-8 text-[#90a5c8] italic">
          Debes iniciar sesión para comentar.
        </p>
      )}

      <div className="space-y-6">
        {comments.map((c) => (
          <div
            key={c.id}
            className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(4,12,31,0.76)] p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-[var(--ast-sky)]">
                {c.user_email}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#8ea4c7]">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
                {(isAdmin || user?.id === c.user_id) && (
                  <button
                    type="button"
                    onClick={() => void deleteComment(c.id)}
                    className="rounded bg-red-950/45 px-2 py-1 text-xs text-red-200 transition hover:bg-red-900/60"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>
            <p className="text-[#d9e7fc]">{c.content}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-[#90a5c8]">
            Nadie ha comentado aún. ¡Sé el primero!
          </p>
        )}
      </div>
    </div>
  );
}
