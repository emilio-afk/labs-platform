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

  return (
    <div className="mt-4">
      {!authResolved ? (
        <div className="mb-8 rounded-lg border border-gray-700 bg-black/30 px-4 py-3 text-sm text-gray-400">
          Cargando foro...
        </div>
      ) : user ? (
        <form onSubmit={postComment} className="mb-8">
          <div className="mb-3 rounded-lg border border-[var(--ast-sky)]/35 bg-[var(--ast-indigo)]/26 p-3">
            <p className="text-xs uppercase tracking-wider text-[var(--ast-sky)]/80">
              Prompt de discusión
            </p>
            <p className="mt-1 text-sm text-gray-100">
              {discussionPrompt || "Comparte qué aplicaste hoy y qué mejorarás mañana."}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-gray-400">
              <li>1. Contexto breve del caso real.</li>
              <li>2. Prompt o enfoque que usaste.</li>
              <li>3. Resultado y siguiente mejora.</li>
            </ul>
          </div>
          <textarea
            className="w-full p-4 rounded-lg bg-black/30 border border-gray-700 text-white focus:border-green-500 outline-none"
            placeholder="Comparte tu resultado del reto..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button
            type="submit"
            className="mt-2 bg-green-600 px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition"
          >
            Publicar comentario
          </button>
        </form>
      ) : (
        <p className="mb-8 text-gray-500 italic">
          Debes iniciar sesión para comentar.
        </p>
      )}

      <div className="space-y-6">
        {comments.map((c) => (
          <div
            key={c.id}
            className="bg-gray-900 p-4 rounded-lg border border-gray-800"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold text-blue-400">
                {c.user_email}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
                {(isAdmin || user?.id === c.user_id) && (
                  <button
                    type="button"
                    onClick={() => void deleteComment(c.id)}
                    className="text-xs px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-100"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>
            <p className="text-gray-300">{c.content}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-gray-600">
            Nadie ha comentado aún. ¡Sé el primero!
          </p>
        )}
      </div>
    </div>
  );
}
