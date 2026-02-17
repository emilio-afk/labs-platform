import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

type DayStatePayload = {
  notes: string;
  checklistSelections: Record<string, string[]>;
  quizAnswers: Record<string, Record<string, number>>;
};

type PostRequest = {
  labId?: unknown;
  dayNumber?: unknown;
  notes?: unknown;
  checklistSelections?: unknown;
  quizAnswers?: unknown;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const labId = url.searchParams.get("labId") ?? "";
  const dayNumber = Number.parseInt(url.searchParams.get("dayNumber") ?? "", 10);

  if (!labId || !Number.isInteger(dayNumber) || dayNumber < 1) {
    return NextResponse.json({ error: "Query invalida" }, { status: 400 });
  }

  const access = await validateDayAccess(supabase, user.id, labId, dayNumber);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data, error } = await supabase
    .from("day_learning_state")
    .select("notes, checklist_selections, quiz_answers, updated_at")
    .eq("user_id", user.id)
    .eq("lab_id", labId)
    .eq("day_number", dayNumber)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ state: null });
  }

  return NextResponse.json({
    state: {
      notes: normalizeNotes(data.notes),
      checklistSelections: normalizeChecklistSelections(data.checklist_selections),
      quizAnswers: normalizeQuizAnswers(data.quiz_answers),
      updatedAt:
        typeof data.updated_at === "string" ? data.updated_at : null,
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as PostRequest;
  const labId = typeof body.labId === "string" ? body.labId : "";
  const dayNumber =
    typeof body.dayNumber === "number" ? body.dayNumber : Number.NaN;

  if (!labId || !Number.isInteger(dayNumber) || dayNumber < 1) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const access = await validateDayAccess(supabase, user.id, labId, dayNumber);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const payload: DayStatePayload = {
    notes: normalizeNotes(body.notes),
    checklistSelections: normalizeChecklistSelections(body.checklistSelections),
    quizAnswers: normalizeQuizAnswers(body.quizAnswers),
  };

  const { error } = await supabase.from("day_learning_state").upsert(
    [
      {
        user_id: user.id,
        lab_id: labId,
        day_number: dayNumber,
        notes: payload.notes,
        checklist_selections: payload.checklistSelections,
        quiz_answers: payload.quizAnswers,
      },
    ],
    { onConflict: "user_id,lab_id,day_number" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function validateDayAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  labId: string,
  dayNumber: number,
): Promise<{ error: null; status: 200 } | { error: string; status: number }> {
  const [{ data: profile }, { data: entitlement }, { data: day }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
      supabase
        .from("lab_entitlements")
        .select("id")
        .eq("user_id", userId)
        .eq("lab_id", labId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("days")
        .select("id")
        .eq("lab_id", labId)
        .eq("day_number", dayNumber)
        .maybeSingle(),
    ]);

  if (!day) {
    return { error: "Dia no encontrado en este lab", status: 404 };
  }

  const isAdmin = profile?.role === "admin";
  if (!isAdmin && !entitlement && dayNumber > 1) {
    return { error: "Solo puedes guardar estado en el Día 1 del preview", status: 403 };
  }

  return { error: null, status: 200 };
}

function normalizeNotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.slice(0, 20000);
}

function normalizeChecklistSelections(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};

  const output: Record<string, string[]> = {};
  for (const [blockId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof blockId !== "string" || !Array.isArray(value)) continue;
    output[blockId] = value
      .filter((item): item is string => typeof item === "string")
      .slice(0, 200);
  }

  return output;
}

function normalizeQuizAnswers(
  raw: unknown,
): Record<string, Record<string, number>> {
  if (!raw || typeof raw !== "object") return {};

  const output: Record<string, Record<string, number>> = {};
  for (const [blockId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof blockId !== "string" || !value || typeof value !== "object") continue;
    const blockAnswers: Record<string, number> = {};

    for (const [questionId, answer] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (typeof questionId !== "string") continue;
      if (typeof answer !== "number" || !Number.isInteger(answer)) continue;
      if (answer < 0 || answer > 20) continue;
      blockAnswers[questionId] = answer;
    }

    output[blockId] = blockAnswers;
  }

  return output;
}
