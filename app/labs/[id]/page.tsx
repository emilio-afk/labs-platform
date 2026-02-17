import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
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
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestMode = !user;

  const profile = user
    ? (
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
      ).data
    : null;
  const isAdmin = profile?.role === "admin";
  const { data: entitlement } = user
    ? await supabase
        .from("lab_entitlements")
        .select("id")
        .eq("user_id", user.id)
        .eq("lab_id", id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };
  const hasPaidAccess = Boolean(entitlement);
  const isPreview = guestMode || (!isAdmin && !hasPaidAccess);
  const dataClient = guestMode ? (adminSupabase ?? supabase) : supabase;

  const [labResult, daysResult, progressResult] = await Promise.all([
    dataClient.from("labs").select("id, title, description").eq("id", id).single(),
    dataClient
      .from("days")
      .select("id, lab_id, day_number, title, video_url, content")
      .eq("lab_id", id)
      .order("day_number", { ascending: true }),
    user && !isPreview
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

  const workspaceDays = isPreview
    ? days.map((dayItem) =>
        dayItem.day_number === 1
          ? dayItem
          : {
              ...dayItem,
              video_url: null,
              content: null,
            },
      )
    : days;

  const completedDays = user
    ? ((progressResult.data as { day_number: number | null }[] | null)
        ?.map((item) => item.day_number)
        .filter((n): n is number => typeof n === "number") ?? [])
    : [];
  const initialDayForView = isPreview ? 1 : currentDayNumber;

  return (
    <div className="min-h-screen bg-[var(--ast-black)] text-white">
      <div className="bg-[linear-gradient(90deg,rgba(1,25,99,0.65),rgba(10,86,198,0.45),rgba(4,164,90,0.22))] border-b border-[var(--ast-sky)]/25 p-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="text-[var(--ast-sky)] text-sm mb-1 block hover:text-[var(--ast-mint)] hover:underline"
          >
            ← Volver al inicio
          </Link>
          <h1 className="text-2xl font-bold">{lab.title}</h1>
          {isPreview && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs px-3 py-1 rounded-full bg-[var(--ast-cobalt)]/60 border border-[var(--ast-sky)]/60">
                {guestMode ? "Vista previa: solo Día 1" : "Acceso parcial: solo Día 1"}
              </span>
              {guestMode ? (
                <Link
                  href="/login"
                  className="text-xs px-3 py-1 rounded-full bg-[var(--ast-mint)] text-[var(--ast-black)] hover:bg-[var(--ast-forest)] transition"
                >
                  Crear cuenta para desbloquear todo
                </Link>
              ) : (
                <span className="text-xs px-3 py-1 rounded-full bg-black/30 border border-white/20">
                  Compra este lab para desbloquear todos los días
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
        <LabWorkspace
          labId={id}
          days={workspaceDays as WorkspaceDay[]}
          initialDayNumber={initialDayForView}
          completedDayNumbers={completedDays}
          previewMode={isPreview}
        />
      </div>
    </div>
  );
}
