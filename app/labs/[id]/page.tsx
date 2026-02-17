import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import LabWorkspace, { type WorkspaceDay } from "@/components/LabWorkspace";

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
  const currentDayNumber =
    Number.isFinite(parsedDay) && parsedDay > 0 ? parsedDay : 1;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [labResult, daysResult, progressResult] = await Promise.all([
    supabase.from("labs").select("id, title, description").eq("id", id).single(),
    supabase
      .from("days")
      .select("id, lab_id, day_number, title, video_url, content")
      .eq("lab_id", id)
      .order("day_number", { ascending: true }),
    supabase
      .from("progress")
      .select("day_number")
      .eq("user_id", user.id)
      .eq("lab_id", id),
  ]);

  const lab = labResult.data as Lab | null;
  const days = daysResult.data as LabDay[] | null;

  if (!lab || !days) notFound();

  const completedDays =
    (progressResult.data?.map((item) => item.day_number).filter((n): n is number => typeof n === "number") ?? []);

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
        <LabWorkspace
          labId={id}
          days={days as WorkspaceDay[]}
          initialDayNumber={currentDayNumber}
          completedDayNumbers={completedDays}
        />
      </div>
    </div>
  );
}
