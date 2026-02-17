import { NextResponse } from "next/server";
import { requireAdmin } from "../_helpers";

type EntitlementPayload = {
  userId?: unknown;
  labId?: unknown;
  grant?: unknown;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { admin } = auth;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  const [labsRes, entitlementsRes] = await Promise.all([
    admin.from("labs").select("id, title").order("created_at", { ascending: false }),
    admin
      .from("lab_entitlements")
      .select("lab_id, status")
      .eq("user_id", userId),
  ]);

  if (labsRes.error) {
    return NextResponse.json({ error: labsRes.error.message }, { status: 500 });
  }
  if (entitlementsRes.error) {
    return NextResponse.json(
      { error: entitlementsRes.error.message },
      { status: 500 },
    );
  }

  const statusByLab = new Map<string, string>();
  (entitlementsRes.data ?? []).forEach((entitlement) => {
    const labId = entitlement.lab_id as string;
    const status = entitlement.status as string;
    statusByLab.set(labId, status);
  });

  const labs = (labsRes.data ?? []).map((lab) => {
    const status = statusByLab.get(lab.id as string) ?? "none";
    return {
      id: lab.id as string,
      title: lab.title as string,
      status,
      hasAccess: status === "active",
    };
  });

  return NextResponse.json({ labs });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { admin } = auth;
  const body = (await request.json()) as EntitlementPayload;
  const userId = typeof body.userId === "string" ? body.userId : "";
  const labId = typeof body.labId === "string" ? body.labId : "";
  const grant = typeof body.grant === "boolean" ? body.grant : null;

  if (!userId || !labId || grant === null) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const status = grant ? "active" : "revoked";
  const { error } = await admin.from("lab_entitlements").upsert(
    [
      {
        user_id: userId,
        lab_id: labId,
        status,
        source: "manual",
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "user_id,lab_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
