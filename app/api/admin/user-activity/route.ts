import { NextResponse } from "next/server";
import { requireAdmin } from "../_helpers";

type ActivityItem = {
  type: "progress" | "comment";
  lab_id: string;
  lab_title: string;
  day_number: number | null;
  content?: string | null;
  created_at?: string | null;
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

  const [progressRes, progressCountRes, commentsRes, commentsCountRes] =
    await Promise.all([
      admin.from("progress").select("lab_id, day_number").eq("user_id", userId).limit(20),
      admin.from("progress").select("*", { count: "exact", head: true }).eq("user_id", userId),
      admin
        .from("comments")
        .select("lab_id, day_number, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

  if (progressRes.error) {
    return NextResponse.json({ error: progressRes.error.message }, { status: 500 });
  }
  if (commentsRes.error) {
    return NextResponse.json({ error: commentsRes.error.message }, { status: 500 });
  }
  if (progressCountRes.error) {
    return NextResponse.json({ error: progressCountRes.error.message }, { status: 500 });
  }
  if (commentsCountRes.error) {
    return NextResponse.json({ error: commentsCountRes.error.message }, { status: 500 });
  }

  const labIds = new Set<string>();
  (progressRes.data ?? []).forEach((row) => {
    if (typeof row.lab_id === "string") labIds.add(row.lab_id);
  });
  (commentsRes.data ?? []).forEach((row) => {
    if (typeof row.lab_id === "string") labIds.add(row.lab_id);
  });

  const labsRes =
    labIds.size > 0
      ? await admin.from("labs").select("id, title").in("id", Array.from(labIds))
      : { data: [], error: null };

  if (labsRes.error) {
    return NextResponse.json({ error: labsRes.error.message }, { status: 500 });
  }

  const labTitleById = new Map<string, string>();
  (labsRes.data ?? []).forEach((lab) => {
    labTitleById.set(lab.id as string, (lab.title as string) ?? "Lab");
  });

  const progressItems: ActivityItem[] = (progressRes.data ?? [])
    .slice(0, 20)
    .map((item) => ({
      type: "progress",
      lab_id: item.lab_id as string,
      lab_title: labTitleById.get(item.lab_id as string) ?? "Lab",
      day_number: (item.day_number as number | null) ?? null,
      created_at: null,
    }));

  const commentItems: ActivityItem[] = (commentsRes.data ?? []).map((item) => ({
    type: "comment",
    lab_id: item.lab_id as string,
    lab_title: labTitleById.get(item.lab_id as string) ?? "Lab",
    day_number: (item.day_number as number | null) ?? null,
    content: (item.content as string | null) ?? null,
    created_at: (item.created_at as string | null) ?? null,
  }));

  return NextResponse.json({
    summary: {
      progress_count: progressCountRes.count ?? 0,
      comments_count: commentsCountRes.count ?? 0,
      last_comment_at: commentItems[0]?.created_at ?? null,
    },
    progress: progressItems,
    comments: commentItems,
  });
}
