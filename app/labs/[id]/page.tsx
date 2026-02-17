import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ProgressBar from "@/components/ProgressBar";
import LabContent from "@/components/LabContent";

type Lab = {
  id: string;
  title: string;
  description: string | null;
};

type LabDay = {
  id: string;
  lab_id: string;
  day_number: number;
  title: string;
  video_url: string | null;
  content: string;
};

export default async function LabDetails({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;

  const parsedDay = day ? Number.parseInt(day, 10) : 1;
  const currentDayNumber = Number.isFinite(parsedDay) && parsedDay > 0 ? parsedDay : 1;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: lab } = (await supabase
    .from("labs")
    .select("id, title, description")
    .eq("id", id)
    .single()) as { data: Lab | null };
  const { data: days } = (await supabase
    .from("days")
    .select("id, lab_id, day_number, title, video_url, content")
    .eq("lab_id", id)
    .order("day_number", { ascending: true })) as { data: LabDay[] | null };

  if (!lab || !days) notFound();

  const { count: completedCount } = await supabase
    .from("progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("lab_id", id);

  const { data: dayProgress } = await supabase
    .from("progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("lab_id", id)
    .eq("day_number", currentDayNumber)
    .maybeSingle();

  const isDayCompleted = Boolean(dayProgress);

  const currentDay = days.find((d) => d.day_number === currentDayNumber);

  const getYouTubeID = (url: string) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url?.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = currentDay?.video_url
    ? getYouTubeID(currentDay.video_url)
    : null;

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
                initialCompleted={isDayCompleted} // <--- Pasamos el estado de la base de datos
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
