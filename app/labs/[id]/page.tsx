import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import Forum from "@/components/Forum";
import ProgressButton from "@/components/ProgressButton";

export default async function LabDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;

  // Si no hay día en la URL, por defecto es el 1
  const currentDayNumber = day ? parseInt(day) : 1;

  const supabase = createClient();

  // 1. Buscamos el Lab
  const { data: lab } = await supabase
    .from("labs")
    .select("*")
    .eq("id", id)
    .single();

  // 2. Buscamos todos los días para la lista lateral
  const { data: days } = await supabase
    .from("days")
    .select("*")
    .eq("lab_id", id)
    .order("day_number", { ascending: true });

  if (!lab) notFound();

  // 3. Buscamos el contenido del día específico que el usuario seleccionó
  const currentDay = days?.find((d) => d.day_number === currentDayNumber);

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11
      ? `https://www.youtube.com/embed/${match[2]}`
      : null;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-gray-900 border-b border-gray-800 p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <Link href="/" className="text-green-500 text-sm mb-1 block">
              ← Volver al inicio
            </Link>
            <h1 className="text-2xl font-bold">{lab.title}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
        {/* LISTA DE DÍAS (Navegación) */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold mb-4">Módulos</h2>
          {days?.map((d) => (
            <Link key={d.id} href={`/labs/${id}?day=${d.day_number}`}>
              <div
                className={`p-4 mb-3 rounded-lg border transition ${
                  currentDayNumber === d.day_number
                    ? "border-green-500 bg-green-950/30"
                    : "border-gray-800 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold ${
                      currentDayNumber === d.day_number
                        ? "bg-green-500 text-black"
                        : "bg-gray-800 text-green-400"
                    }`}
                  >
                    {d.day_number}
                  </span>
                  <span className="font-medium">{d.title}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* CONTENIDO DEL DÍA SELECCIONADO */}
        <div className="lg:col-span-2 space-y-6">
          {currentDay ? (
            <>
              {currentDay.video_url && (
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-gray-800">
                  <iframe
                    className="w-full h-full"
                    src={getEmbedUrl(currentDay.video_url) || ""}
                    allowFullScreen
                  ></iframe>
                </div>
              )}

              <div className="bg-gray-900 p-8 rounded-xl border border-gray-800">
                <h2 className="text-2xl font-bold mb-4 text-green-400">
                  Reto del Día {currentDay.day_number}
                </h2>
                <div className="text-gray-300 whitespace-pre-wrap">
                  {currentDay.content}
                </div>
              </div>

              {/* FORO DINÁMICO */}
              <Forum labId={lab.id} dayNumber={currentDay.day_number} />
            </>
          ) : (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
              Selecciona un día para comenzar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
