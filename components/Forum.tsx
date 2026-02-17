"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

type Comment = {
  id: string;
  user_email: string | null;
  content: string;
  created_at: string;
};

export default function Forum({
  labId,
  dayNumber,
}: {
  labId: string;
  dayNumber: number;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let active = true;

    const loadForumData = async () => {
      const [{ data: authData }, { data: commentsData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("comments")
          .select("id, user_email, content, created_at")
          .eq("lab_id", labId)
          .eq("day_number", dayNumber)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;
      setUser(authData.user);
      setComments((commentsData as Comment[] | null) ?? []);
    };

    loadForumData();

    return () => {
      active = false;
    };
  }, [dayNumber, labId, refreshKey, supabase]);

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

  return (
    <div className="mt-12 border-t border-gray-800 pt-8">
      <h2 className="text-2xl font-bold mb-6 text-green-400">
        Foro de Discusión
      </h2>

      {user ? (
        <form onSubmit={postComment} className="mb-8">
          <textarea
            className="w-full p-4 rounded-lg bg-gray-900 border border-gray-700 text-white focus:border-green-500 outline-none"
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
              <span className="text-xs text-gray-600">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
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
