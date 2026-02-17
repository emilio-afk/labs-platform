import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

type ProgressRequest = {
  labId?: unknown;
  dayNumber?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as ProgressRequest;
  const labId = typeof body.labId === "string" ? body.labId : "";
  const dayNumber =
    typeof body.dayNumber === "number" ? body.dayNumber : Number.NaN;

  if (!labId || !Number.isInteger(dayNumber) || dayNumber < 1) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const [{ data: profile }, { data: entitlement }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("lab_entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("lab_id", labId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const isAdmin = profile?.role === "admin";

  if (!isAdmin && !entitlement) {
    return NextResponse.json(
      { error: "No tienes acceso completo a este lab" },
      { status: 403 },
    );
  }

  const { data: day } = await supabase
    .from("days")
    .select("id, day_number")
    .eq("lab_id", labId)
    .eq("day_number", dayNumber)
    .maybeSingle();

  if (!day) {
    return NextResponse.json(
      { error: "El dia no pertenece a este lab" },
      { status: 404 },
    );
  }

  if (dayNumber > 1) {
    const { data: previousDayProgress } = await supabase
      .from("progress")
      .select("id")
      .eq("user_id", user.id)
      .eq("lab_id", labId)
      .eq("day_number", dayNumber - 1)
      .maybeSingle();

    if (!previousDayProgress) {
      return NextResponse.json(
        { error: "Debes completar el dia anterior primero" },
        { status: 409 },
      );
    }
  }

  const { data: existing } = await supabase
    .from("progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("lab_id", labId)
    .eq("day_number", dayNumber)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  const { error } = await supabase.from("progress").insert([
    { user_id: user.id, lab_id: labId, day_number: dayNumber },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyCompleted: false });
}
