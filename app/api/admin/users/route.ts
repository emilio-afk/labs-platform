import { requireAdmin } from "../_helpers";
import { NextResponse } from "next/server";

type UserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  role: string;
  active_labs: number;
  progress_rows: number;
  comments_rows: number;
  last_comment_at: string | null;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { admin } = auth;
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const {
    data: { users },
    error: usersError,
  } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const filteredUsers = users.filter((user) =>
    query ? (user.email ?? "").toLowerCase().includes(query) : true,
  );
  const userIds = filteredUsers.map((user) => user.id);

  if (userIds.length === 0) {
    return NextResponse.json({ users: [] satisfies UserRow[] });
  }

  const [profilesRes, entitlementsRes, progressRes, commentsRes] =
    await Promise.all([
      admin.from("profiles").select("id, role").in("id", userIds),
      admin
        .from("lab_entitlements")
        .select("user_id")
        .in("user_id", userIds)
        .eq("status", "active"),
      admin.from("progress").select("user_id").in("user_id", userIds),
      admin
        .from("comments")
        .select("user_id, created_at")
        .in("user_id", userIds),
    ]);

  const roleByUser = new Map<string, string>();
  (profilesRes.data ?? []).forEach((profile) => {
    roleByUser.set(profile.id as string, (profile.role as string) ?? "student");
  });

  const activeLabsCountByUser = countByUser(entitlementsRes.data ?? []);
  const progressCountByUser = countByUser(progressRes.data ?? []);
  const commentsCountByUser = countByUser(commentsRes.data ?? []);

  const lastCommentAtByUser = new Map<string, string>();
  (commentsRes.data ?? []).forEach((comment) => {
    const userId = comment.user_id as string | null;
    const createdAt = comment.created_at as string | null;
    if (!userId || !createdAt) return;
    const previous = lastCommentAtByUser.get(userId);
    if (!previous || createdAt > previous) {
      lastCommentAtByUser.set(userId, createdAt);
    }
  });

  const responseUsers: UserRow[] = filteredUsers.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    role: roleByUser.get(user.id) ?? "student",
    active_labs: activeLabsCountByUser.get(user.id) ?? 0,
    progress_rows: progressCountByUser.get(user.id) ?? 0,
    comments_rows: commentsCountByUser.get(user.id) ?? 0,
    last_comment_at: lastCommentAtByUser.get(user.id) ?? null,
  }));

  return NextResponse.json({ users: responseUsers });
}

function countByUser(rows: Array<{ user_id: unknown }>): Map<string, number> {
  const result = new Map<string, number>();
  rows.forEach((row) => {
    const userId = row.user_id;
    if (typeof userId !== "string") return;
    result.set(userId, (result.get(userId) ?? 0) + 1);
  });
  return result;
}
