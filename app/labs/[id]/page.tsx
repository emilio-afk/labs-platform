import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProgressBar from "@/components/ProgressBar";
import LabContent from "@/components/LabContent";

export default async function LabDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;

  const currentDayNumber = day ? parseInt(day) : 1;
  const supabase = await createClient();

  const { data: lab } = await supabase
    .from("labs")
    .select("*")
    .eq("id", id)
    .single();
  const { data: days } = await supabase
    .from("days")
    .select("*")
    .eq("lab_id", id)
    .order("day_number", { ascending: true });

  if (!lab || !days) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { count: completedCount } = await supabase
    .from("progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user?.id)
    .eq("lab_id", id);

  const currentDay = days.find((d) => d.day_number === currentDayNumber);

  // --- FUNCIÓN MEJORADA PARA EL VIDEO ---
  const getYouTubeID = (url: string) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url?.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = currentDay?.video_url
    ? getYouTubeID(currentDay.video_url)
    : null;
  // ---------------------------------------

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-gray-900 border-b border-gray-800 p-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="text-green-500 text-sm mb-1 block hover:underline"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-2xl font-bold">{lab.title}</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold mb-4">Módulos</h2>
          {days.map((d) => (
            <Link key={d.id} href={`/labs/${id}?day=${d.day_number}`}>
              <div
                className={`p-4 mb-3 rounded-lg border transition ${currentDayNumber === d.day_number ? "border-green-500 bg-green-950/30" : "border-gray-800 bg-gray-900 hover:border-gray-600"}`}
              >
                <div className="flex items-center">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold ${currentDayNumber === d.day_number ? "bg-green-500 text-black" : "bg-gray-800 text-green-400"}`}
                  >
                    {d.day_number}
                  </span>
                  <span className="font-medium">{d.title}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {currentDay ? (
            <>
              <ProgressBar
                completed={completedCount || 0}
                total={days.length}
              />
              <LabContent
                key={currentDay.id}
                currentDay={currentDay}
                labId={lab.id}
                videoId={videoId || ""}
              />
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
