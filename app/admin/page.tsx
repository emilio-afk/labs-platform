"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [labs, setLabs] = useState<any[]>([]);

  // Formulario Crear Lab
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");

  // Formulario Crear Día
  const [selectedLab, setSelectedLab] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [dayTitle, setDayTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [content, setContent] = useState("");
  const [dayMsg, setDayMsg] = useState("");

  const router = useRouter();
  const supabase = createClient();

  // 1. Cargar datos iniciales
  useEffect(() => {
    const init = async () => {
      // Verificar Admin
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      setLoading(false);

      // Cargar Labs existentes para la lista
      fetchLabs();
    };
    init();
  }, [router, supabase]);

  const fetchLabs = async () => {
    const { data } = await supabase
      .from("labs")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setLabs(data);
  };

  // 2. Crear Lab Nuevo
  const createLab = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("Guardando Lab...");
    const { error } = await supabase
      .from("labs")
      .insert([{ title, description }]);
    if (error) {
      setMsg("Error: " + error.message);
    } else {
      setMsg("✅ Lab creado");
      setTitle("");
      setDescription("");
      fetchLabs(); // Recargar la lista
    }
  };

  // 3. Agregar Día a un Lab
  const createDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLab) return;
    setDayMsg("Guardando Día...");

    const { error } = await supabase.from("days").insert([
      {
        lab_id: selectedLab,
        day_number: dayNumber,
        title: dayTitle,
        video_url: videoUrl,
        content: content,
      },
    ]);

    if (error) {
      setDayMsg("Error: " + error.message);
    } else {
      setDayMsg("✅ Día agregado correctamente");
      setDayTitle("");
      setVideoUrl("");
      setContent("");
      setDayNumber(dayNumber + 1); // Autoincrementar para el siguiente
    }
  };

  if (loading) return <div className="p-10 text-white">Cargando panel...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-green-400">Panel de Admin</h1>
          <div className="space-x-4">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-white"
            >
              Ir al Inicio
            </button>
            <button
              onClick={() =>
                supabase.auth.signOut().then(() => router.push("/login"))
              }
              className="text-red-400"
            >
              Salir
            </button>
          </div>
        </div>

        {/* SECCIÓN 1: Crear Lab */}
        <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-blue-400">
            1. Crear Nuevo Curso (Lab)
          </h2>
          <form onSubmit={createLab} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Título del Lab"
                className="p-2 rounded bg-black border border-gray-600 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Descripción corta"
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

        {/* SECCIÓN 2: Agregar Contenido */}
        <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-green-400">
            2. Agregar Días y Contenido
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Lista de Labs (Izquierda) */}
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

            {/* Formulario de Días (Derecha) */}
            <div className="col-span-2">
              {!selectedLab ? (
                <div className="h-full flex items-center justify-center text-gray-500 italic">
                  &larr; Selecciona un curso de la lista para agregarle
                  contenido.
                </div>
              ) : (
                <form onSubmit={createDay} className="space-y-4 animate-fadeIn">
                  <h3 className="font-bold text-lg text-white mb-4">
                    Agregando contenido al curso seleccionado
                  </h3>

                  <div className="flex gap-4">
                    <div className="w-24">
                      <label className="text-xs text-gray-400">Día #</label>
                      <input
                        type="number"
                        value={dayNumber}
                        onChange={(e) => setDayNumber(Number(e.target.value))}
                        className="w-full p-2 rounded bg-black border border-gray-600"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">
                        Título del Día
                      </label>
                      <input
                        type="text"
                        value={dayTitle}
                        onChange={(e) => setDayTitle(e.target.value)}
                        placeholder="Ej: Introducción"
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
                    <label className="text-xs text-gray-400">
                      Texto del Reto
                    </label>
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
                    Guardar Día
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
