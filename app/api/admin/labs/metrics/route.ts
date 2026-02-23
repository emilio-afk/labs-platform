import { NextResponse } from "next/server";
import { requireAdmin } from "../../_helpers";

type MetricRow = {
  lab_id: string | null;
  status?: string | null;
};

type LabMetricSummary = {
  dayCount: number;
  commentCount: number;
  activeEntitlementCount: number;
  progressCount: number;
};

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const [labsRes, daysRes, commentsRes, entitlementsRes, progressRes] = await Promise.all([
    admin.from("labs").select("id"),
    admin.from("days").select("lab_id"),
    admin.from("comments").select("lab_id"),
    admin.from("lab_entitlements").select("lab_id, status").eq("status", "active"),
    admin.from("progress").select("lab_id"),
  ]);

  const firstError =
    labsRes.error ??
    daysRes.error ??
    commentsRes.error ??
    entitlementsRes.error ??
    progressRes.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const summary: Record<string, LabMetricSummary> = {};
  for (const lab of (labsRes.data as Array<{ id: string }> | null) ?? []) {
    summary[lab.id] = {
      dayCount: 0,
      commentCount: 0,
      activeEntitlementCount: 0,
      progressCount: 0,
    };
  }

  accumulate(summary, daysRes.data as MetricRow[] | null, "dayCount");
  accumulate(summary, commentsRes.data as MetricRow[] | null, "commentCount");
  accumulate(summary, entitlementsRes.data as MetricRow[] | null, "activeEntitlementCount");
  accumulate(summary, progressRes.data as MetricRow[] | null, "progressCount");

  return NextResponse.json({ metrics: summary });
}

function accumulate(
  summary: Record<string, LabMetricSummary>,
  rows: MetricRow[] | null,
  key: keyof LabMetricSummary,
) {
  for (const row of rows ?? []) {
    const labId = row.lab_id;
    if (!labId || !summary[labId]) continue;
    summary[labId][key] += 1;
  }
}
