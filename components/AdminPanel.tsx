"use client";

import { createClient } from "@/utils/supabase/client";
import { useCallback, useMemo, useState } from "react";
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
  const [videoUrl, setVideoUrl] = useState("");
  const [content, setContent] = useState("");
  const [dayMsg, setDayMsg] = useState("");

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
    setDayMsg("Guardando Dia...");

    const { error } = await supabase.from("days").insert([
      {
        lab_id: selectedLab,
        day_number: dayNumber,
        title: dayTitle,
        video_url: videoUrl,
        content,
      },
    ]);

    if (error) {
      setDayMsg("Error: " + error.message);
      return;
    }

    setDayMsg("Dia agregado correctamente");
    setDayTitle("");
    setVideoUrl("");
    setContent("");
    setDayNumber((prev) => prev + 1);
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
            2. Agregar Dias y Contenido
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
                    Agregando contenido al curso seleccionado
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

                  <div>
                    <label className="text-xs text-gray-400">
                      Video URL (Youtube/Vimeo)
                    </label>
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/..."
                      className="w-full p-2 rounded bg-black border border-gray-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400">Texto del Reto</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Describe el reto de hoy..."
                      className="w-full p-2 h-32 rounded bg-black border border-gray-600"
                      required
                    />
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
      </div>
    </div>
  );
}
