import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import LabWorkspace, { type WorkspaceDay } from "@/components/LabWorkspace";
import ProgressBar from "@/components/ProgressBar";
import ConnectedDotsBackground from "@/components/ConnectedDotsBackground";

type Lab = {
  id: string;
  slug?: string | null;
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
  const dataClient = guestMode ? (adminSupabase ?? supabase) : supabase;

  const labById = await dataClient
    .from("labs")
    .select("id, slug, title, description")
    .eq("id", id)
    .maybeSingle();
  let lab = labById.data as Lab | null;

  if (!lab) {
    const bySlug = await dataClient
      .from("labs")
      .select("id, slug, title, description")
      .eq("slug", id)
      .maybeSingle();
    if (!bySlug.error) {
      lab = bySlug.data as Lab | null;
    } else if (!isMissingSlugColumnError(bySlug.error.message)) {
      throw bySlug.error;
    }
  }

  if (!lab) notFound();
  const resolvedLabId = lab.id;

  const { data: entitlement } = user
    ? await supabase
        .from("lab_entitlements")
        .select("id")
        .eq("user_id", user.id)
        .eq("lab_id", resolvedLabId)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };
  const hasPaidAccess = Boolean(entitlement);
  const isPreview = guestMode || (!isAdmin && !hasPaidAccess);

  const [daysResult, progressResult] = await Promise.all([
    dataClient
      .from("days")
      .select("id, lab_id, day_number, title, video_url, content")
      .eq("lab_id", resolvedLabId)
      .order("day_number", { ascending: true }),
    user && !isPreview
      ? supabase
          .from("progress")
          .select("day_number")
          .eq("user_id", user.id)
          .eq("lab_id", resolvedLabId)
      : Promise.resolve({ data: [] }),
  ]);

  const days = daysResult.data as LabDay[] | null;
  if (!days) notFound();

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
    <div className="relative isolate min-h-screen bg-[var(--ast-black)] text-white">
      <ConnectedDotsBackground />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,9,22,0.5),rgba(6,12,28,0.62))]" />

      <div className="relative z-10 overflow-hidden border-b border-[var(--ast-sky)]/25 bg-[linear-gradient(95deg,rgba(2,20,58,0.78),rgba(8,46,102,0.46),rgba(4,87,70,0.28))] px-6 py-4 md:py-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_14%,rgba(10,86,198,0.2),transparent_40%),radial-gradient(circle_at_88%_22%,rgba(4,164,90,0.16),transparent_42%)]"
        />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/"
            className="mb-2 inline-block text-sm font-semibold text-[var(--ast-sky)]/95 hover:text-[var(--ast-mint)] hover:underline"
          >
            ← Volver al inicio
          </Link>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(320px,520px)] md:items-end md:gap-8">
            <div className="min-w-0">
              <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-[#eaf2ff] md:text-6xl">
                {lab.title}
              </h1>
              {lab.description && (
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#c6d8f8] md:text-base">
                  {lab.description}
                </p>
              )}
            </div>

            {!isPreview && (
              <div className="w-full md:pb-1">
                <ProgressBar
                  completed={completedDays.length}
                  total={workspaceDays.length}
                  label="Progreso"
                />
              </div>
            )}
          </div>

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

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-8">
        <LabWorkspace
          labId={resolvedLabId}
          labPathId={id}
          days={workspaceDays as WorkspaceDay[]}
          initialDayNumber={initialDayForView}
          completedDayNumbers={completedDays}
          previewMode={isPreview}
        />
      </div>
    </div>
  );
}

function isMissingSlugColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("column") &&
    lower.includes("slug") &&
    (lower.includes("does not exist") || lower.includes("schema cache"))
  );
}
