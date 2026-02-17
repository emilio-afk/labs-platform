import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  content: string | null;
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
  const isPreview = !user;

  const [labResult, daysResult, progressResult] = await Promise.all([
    supabase.from("labs").select("id, title, description").eq("id", id).single(),
    supabase
      .from("days")
      .select("id, lab_id, day_number, title, video_url, content")
      .eq("lab_id", id)
      .order("day_number", { ascending: true }),
    user
      ? supabase
          .from("progress")
          .select("day_number")
          .eq("user_id", user.id)
          .eq("lab_id", id)
      : Promise.resolve({ data: [] }),
  ]);

  const lab = labResult.data as Lab | null;
  const days = daysResult.data as LabDay[] | null;

  if (!lab || !days) notFound();

  const completedDays = user
    ? ((progressResult.data as { day_number: number | null }[] | null)
        ?.map((item) => item.day_number)
        .filter((n): n is number => typeof n === "number") ?? [])
    : [];
  const initialDayForView = isPreview ? 1 : currentDayNumber;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-[color:rgba(1,25,99,0.35)] border-b border-white/10 p-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="text-[var(--ast-yellow)] text-sm mb-1 block hover:underline"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-2xl font-bold">{lab.title}</h1>
          {isPreview && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs px-3 py-1 rounded-full bg-[var(--ast-rust)]/80 border border-[var(--ast-coral)]">
                Vista previa: solo Día 1
              </span>
              <Link
                href="/login"
                className="text-xs px-3 py-1 rounded-full bg-[var(--ast-emerald)] hover:bg-[var(--ast-forest)] transition"
              >
                Crear cuenta para desbloquear todo
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
        <LabWorkspace
          labId={id}
          days={days as WorkspaceDay[]}
          initialDayNumber={initialDayForView}
          completedDayNumbers={completedDays}
          previewMode={isPreview}
        />
      </div>
    </div>
  );
}
