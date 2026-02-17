import { NextResponse } from "next/server";
import { requireAdmin } from "../../_helpers";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const params = await Promise.resolve(context.params);
  const labId = params.id;
  if (!labId) {
    return NextResponse.json({ error: "labId requerido" }, { status: 400 });
  }

  const [commentsRes, progressRes, entitlementsRes, daysRes, labRes] =
    await Promise.all([
      admin.from("comments").delete().eq("lab_id", labId),
      admin.from("progress").delete().eq("lab_id", labId),
      admin.from("lab_entitlements").delete().eq("lab_id", labId),
      admin.from("days").delete().eq("lab_id", labId),
      admin.from("labs").delete().eq("id", labId),
    ]);

  const firstError =
    commentsRes.error ??
    progressRes.error ??
    entitlementsRes.error ??
    daysRes.error ??
    labRes.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
