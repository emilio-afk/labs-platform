"use client";

import { createClient } from "@/utils/supabase/client";
import {
  createBlock,
  serializeDayBlocks,
  type DayBlock,
  type DayBlockType,
} from "@/utils/dayBlocks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type AdminLab = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

type AdminPanelProps = {
  initialLabs: AdminLab[];
};

type AdminComment = {
  id: string;
  day_number: number;
  user_email: string | null;
  content: string;
  created_at: string;
};

export default function AdminPanel({ initialLabs }: AdminPanelProps) {
  const [labs, setLabs] = useState<AdminLab[]>(initialLabs);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");

  const [selectedLab, setSelectedLab] = useState<string | null>(
    initialLabs[0]?.id ?? null,
  );
  const [dayNumber, setDayNumber] = useState(1);
  const [dayTitle, setDayTitle] = useState("");
  const [blocks, setBlocks] = useState<DayBlock[]>([createBlock("text")]);
  const [dayMsg, setDayMsg] = useState("");

  const [commentDayFilter, setCommentDayFilter] = useState<string>("");
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentsMsg, setCommentsMsg] = useState("");
  const [commentsRefreshTick, setCommentsRefreshTick] = useState(0);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const fetchLabs = useCallback(async () => {
    const { data, error } = await supabase
      .from("labs")
      .select("id, title, description, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const nextLabs = data as AdminLab[];
      setLabs(nextLabs);
      setSelectedLab((prev) => prev ?? nextLabs[0]?.id ?? null);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const loadComments = async () => {
      if (!selectedLab) {
        if (active) {
          setComments([]);
          setCommentsMsg("");
        }
        return;
      }

      let query = supabase
        .from("comments")
        .select("id, day_number, user_email, content, created_at")
        .eq("lab_id", selectedLab)
        .order("created_at", { ascending: false })
        .limit(100);

      const parsedDayFilter = Number.parseInt(commentDayFilter, 10);
      if (Number.isInteger(parsedDayFilter) && parsedDayFilter > 0) {
        query = query.eq("day_number", parsedDayFilter);
      }

      const { data, error } = await query;
      if (!active) return;

      if (error) {
        setCommentsMsg("Error al cargar comentarios: " + error.message);
        return;
      }

      setCommentsMsg("");
      setComments((data as AdminComment[] | null) ?? []);
    };

    void loadComments();
    return () => {
      active = false;
    };
  }, [commentDayFilter, commentsRefreshTick, selectedLab, supabase]);

  const createLab = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg("Guardando Lab...");

    const { error } = await supabase.from("labs").insert([{ title, description }]);
    if (error) {
      setMsg("Error: " + error.message);
      return;
    }

    setMsg("Lab creado");
    setTitle("");
    setDescription("");
    await fetchLabs();
  };

  const createDay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLab) return;
    setDayMsg("Guardando dia...");

    const normalizedBlocks = blocks
      .map((block) => {
        if (block.type === "text") {
          return {
            ...block,
            text: block.text?.trim() ?? "",
          };
        }
        return {
          ...block,
          url: block.url?.trim() ?? "",
          caption: block.caption?.trim() ?? "",
        };
      })
      .filter((block) =>
        block.type === "text" ? Boolean(block.text) : Boolean(block.url),
      );

    if (normalizedBlocks.length === 0) {
      setDayMsg("Agrega al menos un bloque con contenido.");
      return;
    }

    const firstVideoBlock = normalizedBlocks.find(
      (block) => block.type === "video" && block.url,
    );
    const { error } = await supabase.from("days").insert([
      {
        lab_id: selectedLab,
        day_number: dayNumber,
        title: dayTitle,
        video_url: firstVideoBlock?.url ?? null,
        content: serializeDayBlocks(normalizedBlocks),
      },
    ]);

    if (error) {
      setDayMsg("Error: " + error.message);
      return;
    }

    setDayMsg("Dia guardado correctamente");
    setDayTitle("");
    setBlocks([createBlock("text")]);
    setDayNumber((prev) => prev + 1);
  };

  const addBlock = (type: DayBlockType) => {
    setBlocks((prev) => [...prev, createBlock(type)]);
  };

  const updateBlock = (id: string, patch: Partial<DayBlock>) => {
    setBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((block) => block.id !== id);
    });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      setCommentsMsg("No se pudo borrar: " + error.message);
      return;
    }
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-green-400">Panel de Admin</h1>
          <div className="space-x-4">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-white"
            >
              Ir al Inicio
            </button>
            <button onClick={handleLogout} className="text-red-400">
              Salir
            </button>
          </div>
        </div>

        <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-blue-400">
            1. Crear Nuevo Curso (Lab)
          </h2>
          <form onSubmit={createLab} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Titulo del Lab"
                className="p-2 rounded bg-black border border-gray-600 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Descripcion corta"
                className="p-2 rounded bg-black border border-gray-600 w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-white font-bold"
            >
              Crear Lab
            </button>
            {msg && <span className="ml-4 text-yellow-300">{msg}</span>}
          </form>
        </section>

        <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-green-400">
            2. Disenar Dias con Bloques de Contenido
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1 border-r border-gray-700 pr-4">
              <h3 className="text-sm text-gray-400 mb-2 uppercase font-bold">
                Selecciona un Lab:
              </h3>
              <ul className="space-y-2">
                {labs.map((lab) => (
                  <li
                    key={lab.id}
                    onClick={() => setSelectedLab(lab.id)}
                    className={`p-2 rounded cursor-pointer transition ${selectedLab === lab.id ? "bg-green-900 text-white border border-green-500" : "bg-gray-900 text-gray-400 hover:bg-gray-700"}`}
                  >
                    {lab.title}
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2">
              {!selectedLab ? (
                <div className="h-full flex items-center justify-center text-gray-500 italic">
                  Selecciona un curso de la lista para agregar contenido.
                </div>
              ) : (
                <form onSubmit={createDay} className="space-y-4 animate-fadeIn">
                  <h3 className="font-bold text-lg text-white mb-4">
                    Constructor de Dia
                  </h3>

                  <div className="flex gap-4">
                    <div className="w-24">
                      <label className="text-xs text-gray-400">Dia #</label>
                      <input
                        type="number"
                        value={dayNumber}
                        min={1}
                        onChange={(e) => setDayNumber(Number(e.target.value))}
                        className="w-full p-2 rounded bg-black border border-gray-600"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">
                        Titulo del Dia
                      </label>
                      <input
                        type="text"
                        value={dayTitle}
                        onChange={(e) => setDayTitle(e.target.value)}
                        placeholder="Ej: Introduccion"
                        className="w-full p-2 rounded bg-black border border-gray-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="border border-gray-700 rounded-lg p-4 space-y-4 bg-gray-900/60">
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <p className="text-sm text-gray-300 font-semibold">
                        Bloques del dia (mezcla libre de medios)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => addBlock("text")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Texto
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("video")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Video
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("audio")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Audio
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("image")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Imagen
                        </button>
                      </div>
                    </div>

                    {blocks.map((block, index) => (
                      <div
                        key={block.id}
                        className="border border-gray-700 rounded-lg p-3 space-y-3 bg-black/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-gray-300">
                            Bloque {index + 1}:{" "}
                            <span className="uppercase text-green-400">
                              {block.type}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
                              onClick={() => moveBlock(index, -1)}
                              disabled={index === 0}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
                              onClick={() => moveBlock(index, 1)}
                              disabled={index === blocks.length - 1}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-xs rounded bg-red-900/60 hover:bg-red-800 disabled:opacity-40"
                              onClick={() => removeBlock(block.id)}
                              disabled={blocks.length === 1}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {block.type === "text" ? (
                          <textarea
                            value={block.text ?? ""}
                            onChange={(e) =>
                              updateBlock(block.id, { text: e.target.value })
                            }
                            placeholder="Escribe la lectura/instruccion..."
                            className="w-full p-2 h-28 rounded bg-gray-950 border border-gray-700"
                          />
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={block.url ?? ""}
                              onChange={(e) =>
                                updateBlock(block.id, { url: e.target.value })
                              }
                              placeholder="URL del recurso"
                              className="w-full p-2 rounded bg-gray-950 border border-gray-700"
                            />
                            <input
                              type="text"
                              value={block.caption ?? ""}
                              onChange={(e) =>
                                updateBlock(block.id, { caption: e.target.value })
                              }
                              placeholder="Titulo opcional"
                              className="w-full p-2 rounded bg-gray-950 border border-gray-700"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-bold"
                  >
                    Guardar Dia
                  </button>
                  {dayMsg && (
                    <p className="text-center text-yellow-300 mt-2">{dayMsg}</p>
                  )}
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-amber-400">
            3. Moderacion de Comentarios
          </h2>
          {!selectedLab ? (
            <p className="text-gray-400">
              Selecciona un lab para moderar comentarios.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div>
                  <label className="text-xs text-gray-400">Filtrar por dia</label>
                  <input
                    type="number"
                    min={1}
                    value={commentDayFilter}
                    onChange={(e) => setCommentDayFilter(e.target.value)}
                    placeholder="Todos"
                    className="w-32 p-2 rounded bg-black border border-gray-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCommentsRefreshTick((prev) => prev + 1)}
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  Refrescar
                </button>
              </div>

              {commentsMsg && <p className="text-yellow-300">{commentsMsg}</p>}
              {comments.length === 0 ? (
                <p className="text-gray-400">No hay comentarios en este filtro.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-auto pr-1">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border border-gray-700 rounded p-3 bg-black/40"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="text-xs text-gray-400">
                            Dia {comment.day_number} • {comment.user_email ?? "Sin correo"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteComment(comment.id)}
                          className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800 text-xs"
                        >
                          Borrar
                        </button>
                      </div>
                      <p className="text-sm text-gray-200 mt-2 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
