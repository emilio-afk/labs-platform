import { NextResponse } from "next/server";
import { normalizeAccentColor, normalizeLabSlug, normalizeOptionalUrl } from "@/utils/labMeta";
import { requireAdmin } from "../../../_helpers";

type LabRow = {
  id: string;
  title: string;
  description: string | null;
  labels?: string[] | null;
  slug?: string | null;
  cover_image_url?: string | null;
  accent_color?: string | null;
};

type DayRow = {
  day_number: number;
  title: string;
  video_url: string | null;
  content: string | null;
};

type RequireAdminResult = Awaited<ReturnType<typeof requireAdmin>>;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const params = await Promise.resolve(context.params);
  const sourceLabId = params.id;
  if (!sourceLabId) {
    return NextResponse.json({ error: "labId requerido" }, { status: 400 });
  }

  const { data: sourceLab, error: sourceLabError } = await admin
    .from("labs")
    .select("*")
    .eq("id", sourceLabId)
    .maybeSingle();
  if (sourceLabError || !sourceLab) {
    return NextResponse.json(
      { error: sourceLabError?.message ?? "Lab origen no encontrado" },
      { status: 404 },
    );
  }

  const typedSourceLab = sourceLab as LabRow;
  const { data: sourceDays, error: sourceDaysError } = await admin
    .from("days")
    .select("day_number, title, video_url, content")
    .eq("lab_id", sourceLabId)
    .order("day_number", { ascending: true });
  if (sourceDaysError) {
    return NextResponse.json({ error: sourceDaysError.message }, { status: 500 });
  }

  const newTitle = `${typedSourceLab.title} (Copia)`;
  const insertPayload = {
    title: newTitle,
    description: typedSourceLab.description ?? null,
    labels: Array.isArray(typedSourceLab.labels) ? typedSourceLab.labels : [],
  };
  let { data: insertedLab, error: insertLabError } = await admin
    .from("labs")
    .insert([insertPayload])
    .select("*")
    .single();
  if (insertLabError && isMissingLabelsColumnError(insertLabError.message)) {
    const fallback = await admin
      .from("labs")
      .insert([
        {
          title: newTitle,
          description: typedSourceLab.description ?? null,
        },
      ])
      .select("*")
      .single();
    insertedLab = fallback.data;
    insertLabError = fallback.error;
  }

  if (insertLabError || !insertedLab) {
    return NextResponse.json(
      { error: insertLabError?.message ?? "No se pudo crear la copia del lab" },
      { status: 500 },
    );
  }

  const newLabId = (insertedLab as LabRow).id;
  const sourceSlug = normalizeLabSlug(typedSourceLab.slug || typedSourceLab.title);
  const baseSlug = normalizeLabSlug(`${sourceSlug || "lab"}-copia`);
  const nextSlug = await reserveNextSlug(admin, baseSlug);
  const nextCoverImageUrl = normalizeOptionalUrl(typedSourceLab.cover_image_url ?? "");
  const nextAccentColor = normalizeAccentColor(typedSourceLab.accent_color ?? "");

  if (nextSlug || nextCoverImageUrl || nextAccentColor) {
    await admin
      .from("labs")
      .update({
        slug: nextSlug || null,
        cover_image_url: nextCoverImageUrl,
        accent_color: nextAccentColor,
      })
      .eq("id", newLabId);
  }

  const dayRows = ((sourceDays as DayRow[] | null) ?? []).map((day) => ({
    lab_id: newLabId,
    day_number: day.day_number,
    title: day.title,
    video_url: day.video_url,
    content: day.content,
  }));

  if (dayRows.length > 0) {
    const { error: insertDaysError } = await admin.from("days").insert(dayRows);
    if (insertDaysError) {
      return NextResponse.json({ error: insertDaysError.message }, { status: 500 });
    }
  }

  const { data: freshLab, error: freshLabError } = await admin
    .from("labs")
    .select("*")
    .eq("id", newLabId)
    .maybeSingle();
  if (freshLabError || !freshLab) {
    return NextResponse.json({ error: freshLabError?.message ?? "Lab duplicado sin datos" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lab: freshLab });
}

async function reserveNextSlug(
  admin: NonNullable<RequireAdminResult["admin"]>,
  baseSlug: string,
): Promise<string | null> {
  if (!baseSlug) return null;

  const { data, error } = await admin.from("labs").select("slug").ilike("slug", `${baseSlug}%`);
  if (error) return null;

  const existing = new Set(
    ((data as Array<{ slug?: string | null }> | null) ?? [])
      .map((row) => (typeof row.slug === "string" ? row.slug.trim().toLowerCase() : ""))
      .filter(Boolean),
  );
  if (!existing.has(baseSlug.toLowerCase())) return baseSlug;

  for (let index = 2; index <= 999; index += 1) {
    const candidate = `${baseSlug}-${index}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }

  return `${baseSlug}-${Date.now()}`;
}

function isMissingLabelsColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("column") &&
    lower.includes("labels") &&
    (lower.includes("does not exist") || lower.includes("schema cache"))
  );
}
