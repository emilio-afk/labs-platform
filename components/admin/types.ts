import type { DayBlock, DayBlockGroup } from "@/utils/dayBlocks";

export type AdminLab = {
  id: string;
  title: string;
  description: string | null;
  labels?: string[] | null;
  slug?: string | null;
  cover_image_url?: string | null;
  accent_color?: string | null;
  created_at: string;
};

export type AdminPanelProps = {
  initialLabs: AdminLab[];
  initialHeroTitle: string;
  initialHeroSubtitle: string;
};

export type AdminComment = {
  id: string;
  day_number: number;
  user_email: string | null;
  content: string;
  created_at: string;
};

export type AdminDay = {
  id: string;
  day_number: number;
  title: string;
  video_url: string | null;
  content: string | null;
};

export type ManagedUser = {
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

export type UserEntitlementLab = {
  id: string;
  title: string;
  status: string;
  hasAccess: boolean;
};

export type UserActivitySummary = {
  progress_count: number;
  comments_count: number;
  last_comment_at: string | null;
};

export type UserActivityItem = {
  type: "progress" | "comment";
  lab_id: string;
  lab_title: string;
  day_number: number | null;
  content?: string | null;
  created_at?: string | null;
};

export type LabPrice = {
  id: string;
  lab_id: string;
  currency: "USD" | "MXN";
  amount_cents: number;
  is_active: boolean;
  updated_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: "USD" | "MXN" | null;
  lab_id: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
};

export type AdminTab =
  | "hero"
  | "labs"
  | "days"
  | "comments"
  | "users"
  | "commerce";

export type DayBlocksViewPreset = "all" | DayBlockGroup;

export const MAX_DAY_BLOCK_HISTORY = 120;
export const BLOCK_DELETE_UNDO_WINDOW_MS = 9000;

export type DayPublishCheck = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
};

export type DayPublishChecklist = {
  checks: DayPublishCheck[];
  requiredReady: boolean;
  normalizedBlocks: DayBlock[];
  resourceBlocksCount: number;
  challengeBlocksCount: number;
};

export type DayBlockTemplate = {
  id: string;
  label: string;
  description: string;
  build: () => DayBlock[];
};

export type LabMetaDraft = {
  title: string;
  description: string;
  slug: string;
  coverImageUrl: string;
  accentColor: string;
};

export type LabQuickMetrics = {
  dayCount: number;
  commentCount: number;
  activeEntitlementCount: number;
  progressCount: number;
};
