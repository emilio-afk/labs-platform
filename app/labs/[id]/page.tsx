import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import LabWorkspace, { type WorkspaceDay } from "@/components/LabWorkspace";
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
  const completedDaySet = new Set(completedDays);
  const canAccessDay = (dayNumber: number) => {
    if (isPreview && dayNumber > 1) return false;
    if (dayNumber <= 1) return true;
    return completedDaySet.has(dayNumber - 1);
  };
  const requestedDay = isPreview ? 1 : currentDayNumber;
  const highestUnlockedDay = workspaceDays.reduce((highest, dayItem) => {
    if (!canAccessDay(dayItem.day_number)) return highest;
    return Math.max(highest, dayItem.day_number);
  }, workspaceDays[0]?.day_number ?? 1);
  const initialDayForView = canAccessDay(requestedDay)
    ? requestedDay
    : highestUnlockedDay;
  const progressPercentage =
    workspaceDays.length > 0
      ? Math.round((completedDays.length / workspaceDays.length) * 100)
      : 0;

  return (
    <div className="relative isolate min-h-screen bg-[var(--ast-black)] text-white">
      <ConnectedDotsBackground />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,9,22,0.5),rgba(6,12,28,0.62))]" />

      <div className="sticky top-0 z-40 border-b border-[var(--ast-sky)]/26 bg-[rgba(2,10,28,0.84)] backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 sm:px-4 md:h-[60px] md:gap-3 md:px-6">
          <div className="flex items-center">
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--ast-sky)]/42 bg-[rgba(3,12,33,0.62)] px-2.5 py-1 text-xs font-semibold text-[#d7e8ff] transition hover:border-[var(--ast-mint)]/55 hover:text-[var(--ast-mint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ast-mint)]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(3,12,33,0.9)]"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgba(10,86,198,0.26)] text-[9px] transition group-hover:bg-[rgba(4,164,90,0.28)]"
              >
                ←
              </span>
              Volver al inicio
            </Link>
          </div>

          <div className="flex items-center justify-center px-1">
            <Image
              src="/logo-astrolab-light.png"
              alt="Astrolab"
              width={168}
              height={31}
              className="h-5 w-auto sm:h-6"
              priority
            />
          </div>

          <div className="ml-auto min-w-0 w-[152px] sm:w-[200px] md:w-[248px]">
            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#c6dbff] sm:text-[11px]">
              <p className="truncate">
                Día {initialDayForView} de {workspaceDays.length}
              </p>
              <span className="shrink-0 text-[#dff0ff]">{progressPercentage}%</span>
            </div>
            <div className="mt-1.5">
              <div className="h-1.5 w-full rounded-full bg-[rgba(18,34,63,0.9)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--ast-sky),var(--ast-mint))]"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 border-b border-[var(--ast-sky)]/25 bg-[linear-gradient(95deg,rgba(2,20,58,0.82),rgba(8,46,102,0.5),rgba(4,87,70,0.3))] px-3 pb-2 pt-5 sm:px-4 md:px-6 md:pb-3 md:pt-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_14%,rgba(10,86,198,0.2),transparent_40%),radial-gradient(circle_at_88%_22%,rgba(4,164,90,0.16),transparent_42%)]"
        />

        <div className="relative mx-auto max-w-7xl space-y-5">
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-8">
            <header className="min-w-0 space-y-3 md:space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ast-sky)]/82">
                Lab en ejecución
              </p>
              <h1 className="bg-gradient-to-r from-[#eff5ff] via-[#dce9ff] to-[#b6deff] bg-clip-text pb-1 text-[2rem] font-black leading-[1.08] tracking-tight text-transparent sm:text-[2.35rem] md:text-[2.9rem] lg:text-[3.2rem] xl:text-[3.35rem]">
                {lab.title}
              </h1>
              {lab.description && (
                <p className="max-w-[72ch] text-[17px] leading-[1.55] text-[#d4e3fb]/95 [text-wrap:pretty]">
                  {lab.description}
                </p>
              )}
            </header>
            <div className="relative min-w-0 lg:pl-7 lg:pt-1">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-4 hidden w-px bg-[var(--ast-sky)]/16 lg:block"
                style={{ bottom: "1.2rem" }}
              />
              <div id="day-route-hero-slot" className="min-h-[150px] lg:flex lg:items-center" />
            </div>
          </div>

          <section className="space-y-3 pt-1">
            <details className="group" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-[var(--ast-sky)]/22 bg-[rgba(4,12,31,0.38)] px-3 py-2 [&::-webkit-details-marker]:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ast-sky)]/82">
                  Ruta de módulos
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-[#b8d4f7]/75">
                    {completedDays.length}/{workspaceDays.length} completados
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#d6e7ff]">
                    <span className="group-open:hidden">Expandir</span>
                    <span className="hidden group-open:inline">Colapsar</span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-3.5 w-3.5 translate-y-[0.5px] text-[#cfe2ff] transition-transform duration-200 ease-out group-open:rotate-180"
                      fill="none"
                    >
                      <path
                        d="M5 8l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </summary>

              <div role="navigation" aria-label="Ruta de módulos del lab" className="mt-3">
                <ol className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                {workspaceDays.map((dayItem) => {
                  const dayLocked = !canAccessDay(dayItem.day_number);
                  const isCurrent = dayItem.day_number === initialDayForView;
                  const isDone = completedDaySet.has(dayItem.day_number);
                  const stateLabel = dayLocked
                    ? "Bloqueado"
                    : isCurrent
                      ? "Actual"
                      : isDone
                        ? "Completado"
                        : "Disponible";
                  const stateHint = dayLocked
                    ? dayItem.day_number > 1
                      ? `Completa Día ${dayItem.day_number - 1}`
                      : "Acceso bloqueado"
                    : isCurrent
                      ? "En curso"
                      : isDone
                        ? "Repasar"
                        : "Listo para iniciar";
                  const baseClass =
                    "group relative flex h-[92px] flex-col rounded-lg border px-2.5 py-1.5 text-left transition";
                  const toneClass = dayLocked
                    ? "border-[#84654a]/45 bg-[rgba(58,44,30,0.34)] text-[#cab49e]"
                    : isCurrent
                      ? "border-[var(--ast-mint)]/52 bg-[rgba(0,73,44,0.18)] text-[var(--ast-mint)]"
                      : isDone
                        ? "border-[var(--ast-sky)]/35 bg-[rgba(7,68,168,0.22)] text-[#d6e7ff]"
                        : "border-[var(--ast-sky)]/24 bg-[rgba(4,12,31,0.48)] text-[#d6e7ff]";
                  const dayTagClass = dayLocked
                    ? "border-[#b28761]/45 bg-[rgba(102,73,42,0.34)] text-[#e6c09f]"
                    : isCurrent
                      ? "border-[var(--ast-mint)]/65 bg-[rgba(4,164,90,0.16)] text-[var(--ast-mint)]"
                      : isDone
                        ? "border-[var(--ast-sky)]/55 bg-[rgba(7,68,168,0.28)] text-[var(--ast-sky)]"
                        : "border-[var(--ast-sky)]/34 bg-[rgba(4,12,31,0.6)] text-[#bed7fb]";

                  const innerContent = (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${dayTagClass}`}
                        >
                          Día {dayItem.day_number}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em]">
                          {stateLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex-1">
                        <p className="text-[12px] leading-[1.3] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                          {dayItem.title}
                        </p>
                      </div>
                      <p className="text-[10px] font-medium text-[#9db3d6]/92">
                        {stateHint}
                      </p>
                    </>
                  );

                  if (dayLocked) {
                    return (
                      <li key={dayItem.id} className="h-[92px]">
                        <span
                          title={dayItem.title}
                          aria-disabled="true"
                          className={`${baseClass} ${toneClass} cursor-not-allowed`}
                        >
                          {innerContent}
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={dayItem.id} className="h-[92px]">
                      <Link
                        href={`/labs/${id}?day=${dayItem.day_number}`}
                        scroll={false}
                        aria-current={isCurrent ? "step" : undefined}
                        title={dayItem.title}
                        className={`${baseClass} ${toneClass} ${
                          isCurrent
                            ? "ring-1 ring-[var(--ast-mint)]/45"
                            : "hover:border-[var(--ast-sky)]/48 hover:text-white"
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ast-mint)]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(3,12,33,0.9)]`}
                      >
                        {innerContent}
                      </Link>
                    </li>
                  );
                })}
                </ol>
              </div>
            </details>
          </section>

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
