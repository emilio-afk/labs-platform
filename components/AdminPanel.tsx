"use client";

import { createClient } from "@/utils/supabase/client";
import {
  createBlock,
  createChallengeStep,
  createChecklistItem,
  createQuizQuestion,
  extractYouTubeVideoId,
  parseDayBlocks,
  parseDayDiscussionPrompt,
  serializeDayBlocks,
  getDefaultDayBlockGroup,
  type DayBlock,
  type DayChecklistItem,
  type DayChallengeStep,
  type DayQuizQuestion,
  type DayBlockGroup,
  type DayBlockRole,
  type DayResourceSlot,
  type DayBlockType,
} from "@/utils/dayBlocks";
import {
  hasRichTextContent,
  normalizeRichTextInput,
  sanitizeRichText,
} from "@/utils/richText";
import {
  isMissingColumnError,
  normalizeAccentColor,
  normalizeLabSlug,
  normalizeOptionalUrl,
} from "@/utils/labMeta";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";

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

type AdminPanelProps = {
  initialLabs: AdminLab[];
  initialHeroTitle: string;
  initialHeroSubtitle: string;
};

type AdminComment = {
  id: string;
  day_number: number;
  user_email: string | null;
  content: string;
  created_at: string;
};

type AdminDay = {
  id: string;
  day_number: number;
  title: string;
  video_url: string | null;
  content: string | null;
};

type ManagedUser = {
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

type UserEntitlementLab = {
  id: string;
  title: string;
  status: string;
  hasAccess: boolean;
};

type UserActivitySummary = {
  progress_count: number;
  comments_count: number;
  last_comment_at: string | null;
};

type UserActivityItem = {
  type: "progress" | "comment";
  lab_id: string;
  lab_title: string;
  day_number: number | null;
  content?: string | null;
  created_at?: string | null;
};

type LabPrice = {
  id: string;
  lab_id: string;
  currency: "USD" | "MXN";
  amount_cents: number;
  is_active: boolean;
  updated_at: string;
};

type Coupon = {
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

type AdminTab =
  | "hero"
  | "labs"
  | "days"
  | "comments"
  | "users"
  | "commerce";

type DayBlocksViewPreset = "all" | DayBlockGroup;
const MAX_DAY_BLOCK_HISTORY = 120;
const BLOCK_DELETE_UNDO_WINDOW_MS = 9000;

type DayPublishCheck = {
  id: string;
  label: string;
  done: boolean;
  required: boolean;
};

type DayPublishChecklist = {
  checks: DayPublishCheck[];
  requiredReady: boolean;
  normalizedBlocks: DayBlock[];
  resourceBlocksCount: number;
  challengeBlocksCount: number;
};

type DayBlockTemplate = {
  id: string;
  label: string;
  description: string;
  build: () => DayBlock[];
};

type LabMetaDraft = {
  title: string;
  description: string;
  slug: string;
  coverImageUrl: string;
  accentColor: string;
};

type LabQuickMetrics = {
  dayCount: number;
  commentCount: number;
  activeEntitlementCount: number;
  progressCount: number;
};

export default function AdminPanel({
  initialLabs,
  initialHeroTitle,
  initialHeroSubtitle,
}: AdminPanelProps) {
  const [labs, setLabs] = useState<AdminLab[]>(initialLabs);

  const [heroTitle, setHeroTitle] = useState(initialHeroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(initialHeroSubtitle);
  const [heroMsg, setHeroMsg] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createLabSlug, setCreateLabSlug] = useState("");
  const [createLabCoverUrl, setCreateLabCoverUrl] = useState("");
  const [isUploadingCreateCover, setIsUploadingCreateCover] = useState(false);
  const [uploadingLabCoverId, setUploadingLabCoverId] = useState<string | null>(null);
  const [createLabAccentColor, setCreateLabAccentColor] = useState("#0A56C6");
  const [labelsInput, setLabelsInput] = useState("");
  const [labLabelDrafts, setLabLabelDrafts] = useState<Record<string, string>>({});
  const [savingLabelsLabId, setSavingLabelsLabId] = useState<string | null>(null);
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [labMetaDrafts, setLabMetaDrafts] = useState<Record<string, LabMetaDraft>>({});
  const [savingLabMetaId, setSavingLabMetaId] = useState<string | null>(null);
  const [duplicatingLabId, setDuplicatingLabId] = useState<string | null>(null);
  const [labMetrics, setLabMetrics] = useState<Record<string, LabQuickMetrics>>({});
  const [msg, setMsg] = useState("");

  const [selectedLab, setSelectedLab] = useState<string | null>(
    initialLabs[0]?.id ?? null,
  );
  const [initialDayBlock] = useState<DayBlock>(() => createBlock("text"));
  const [dayNumber, setDayNumber] = useState(1);
  const [dayTitle, setDayTitle] = useState("");
  const [dayDiscussionPrompt, setDayDiscussionPrompt] = useState("");
  const [blocks, setBlocks] = useState<DayBlock[]>(() => [initialDayBlock]);
  const [dayMsg, setDayMsg] = useState("");
  const [days, setDays] = useState<AdminDay[]>([]);
  const [daysMsg, setDaysMsg] = useState("");
  const [daysRefreshTick, setDaysRefreshTick] = useState(0);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [dayBlocksViewPreset, setDayBlocksViewPreset] =
    useState<DayBlocksViewPreset>("all");
  const [blockUndoPast, setBlockUndoPast] = useState<DayBlock[][]>([]);
  const [blockUndoFuture, setBlockUndoFuture] = useState<DayBlock[][]>([]);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    "starter-video-text-challenge",
  );
  const [showStudentPreview, setShowStudentPreview] = useState(true);
  const [lastRemovedBlock, setLastRemovedBlock] = useState<{
    block: DayBlock;
    index: number;
  } | null>(null);
  const [showDeleteDayConfirm, setShowDeleteDayConfirm] = useState(false);
  const [deleteDayConfirmValue, setDeleteDayConfirmValue] = useState("");
  const [isDeletingDay, setIsDeletingDay] = useState(false);
  const [isDaySaving, setIsDaySaving] = useState(false);
  const [daySaveError, setDaySaveError] = useState<string | null>(null);
  const [dayLastSavedAt, setDayLastSavedAt] = useState<number | null>(null);
  const [daySavedSignature, setDaySavedSignature] = useState(() =>
    buildDayDraftSignature({
      dayNumber: 1,
      dayTitle: "",
      dayDiscussionPrompt: "",
      blocks: [initialDayBlock],
    }),
  );
  const dayFormRef = useRef<HTMLFormElement | null>(null);
  const blockDeleteUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef<DayBlock[]>(blocks);
  const isHistoryNavigationRef = useRef(false);

  const [commentDayFilter, setCommentDayFilter] = useState<string>("");
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentsMsg, setCommentsMsg] = useState("");
  const [commentsRefreshTick, setCommentsRefreshTick] = useState(0);

  const [userSearch, setUserSearch] = useState("");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState<string | null>(
    null,
  );
  const [userMgmtMsg, setUserMgmtMsg] = useState("");
  const [entitlementLabs, setEntitlementLabs] = useState<UserEntitlementLab[]>([]);
  const [activitySummary, setActivitySummary] = useState<UserActivitySummary | null>(
    null,
  );
  const [activityItems, setActivityItems] = useState<UserActivityItem[]>([]);
  const [userMgmtRefreshTick, setUserMgmtRefreshTick] = useState(0);
  const [activeTab, setActiveTab] = useState<AdminTab>("hero");
  const [isDeletingLabId, setIsDeletingLabId] = useState<string | null>(null);

  const [pricingMsg, setPricingMsg] = useState("");
  const [commercialRefreshTick, setCommercialRefreshTick] = useState(0);
  const [priceCurrency, setPriceCurrency] = useState<"USD" | "MXN">("USD");
  const [priceAmount, setPriceAmount] = useState("");
  const [labPrices, setLabPrices] = useState<LabPrice[]>([]);

  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "fixed">("percent");
  const [couponPercent, setCouponPercent] = useState("");
  const [couponAmount, setCouponAmount] = useState("");
  const [couponCurrency, setCouponCurrency] = useState<"USD" | "MXN">("USD");
  const [couponScope, setCouponScope] = useState<"all" | "lab">("all");
  const [couponLabId, setCouponLabId] = useState<string>(initialLabs[0]?.id ?? "");
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const selectedManagedUser = useMemo(
    () => managedUsers.find((managedUser) => managedUser.id === selectedManagedUserId) ?? null,
    [managedUsers, selectedManagedUserId],
  );
  const selectedLabData = useMemo(
    () => labs.find((lab) => lab.id === selectedLab) ?? null,
    [labs, selectedLab],
  );
  const resourceBlockCount = useMemo(
    () =>
      blocks.filter(
        (block) => (block.group ?? getDefaultDayBlockGroup(block.type)) === "resource",
      ).length,
    [blocks],
  );
  const challengeBlockCount = useMemo(
    () =>
      blocks.filter(
        (block) => (block.group ?? getDefaultDayBlockGroup(block.type)) === "challenge",
      ).length,
    [blocks],
  );
  const canUndoBlocks = blockUndoPast.length > 0;
  const canRedoBlocks = blockUndoFuture.length > 0;
  const visibleBuilderBlocks = useMemo(
    () =>
      blocks.filter((block) => {
        const blockGroup = block.group ?? getDefaultDayBlockGroup(block.type);
        return dayBlocksViewPreset === "all" || dayBlocksViewPreset === blockGroup;
      }),
    [blocks, dayBlocksViewPreset],
  );
  const activeBuilderBlock = useMemo(() => {
    if (visibleBuilderBlocks.length === 0) return null;
    if (!focusedBlockId) return visibleBuilderBlocks[0];
    return (
      visibleBuilderBlocks.find((block) => block.id === focusedBlockId) ??
      visibleBuilderBlocks[0]
    );
  }, [focusedBlockId, visibleBuilderBlocks]);
  const activeBuilderBlockId = activeBuilderBlock?.id ?? null;
  const dayShortcutKeyLabel =
    typeof navigator !== "undefined" && /mac/i.test(navigator.platform)
      ? "Cmd"
      : "Ctrl";
  const dayBlockTemplates = useMemo<DayBlockTemplate[]>(
    () => [
      {
        id: "starter-video-text-challenge",
        label: "Video + lectura + reto",
        description: "Estructura base para cualquier tema con recurso principal y actividad.",
        build: createVideoTextChallengeTemplateBlocks,
      },
      {
        id: "starter-reading-quiz",
        label: "Lectura + quiz",
        description: "Ideal para evaluación rápida y refuerzo de conceptos.",
        build: createReadingQuizTemplateBlocks,
      },
      {
        id: "starter-media-checklist",
        label: "Media + checklist",
        description: "Contenido guiado con pasos accionables para práctica.",
        build: createMediaChecklistTemplateBlocks,
      },
    ],
    [],
  );
  const currentDayDraftSignature = useMemo(
    () =>
      buildDayDraftSignature({
        dayNumber,
        dayTitle,
        dayDiscussionPrompt,
        blocks,
      }),
    [blocks, dayDiscussionPrompt, dayNumber, dayTitle],
  );
  const dayIsDirty = currentDayDraftSignature !== daySavedSignature;
  const dayPublishChecklist = useMemo(
    () => buildDayPublishChecklist(dayTitle, dayDiscussionPrompt, blocks),
    [blocks, dayDiscussionPrompt, dayTitle],
  );
  const daySaveState: "clean" | "dirty" | "saving" | "saved" | "error" = isDaySaving
    ? "saving"
    : daySaveError
      ? "error"
      : dayIsDirty
        ? "dirty"
        : dayLastSavedAt
          ? "saved"
          : "clean";
  const dayDeletePhrase = editingDayId ? `ELIMINAR DIA ${dayNumber}` : "";
  const daySavedTimeLabel = dayLastSavedAt
    ? new Date(dayLastSavedAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    return () => {
      if (blockDeleteUndoTimeoutRef.current) {
        clearTimeout(blockDeleteUndoTimeoutRef.current);
      }
    };
  }, []);

  const clearBlockHistory = useCallback(() => {
    setBlockUndoPast([]);
    setBlockUndoFuture([]);
  }, []);

  const clearBlockDeleteUndo = useCallback(() => {
    setLastRemovedBlock(null);
    if (blockDeleteUndoTimeoutRef.current) {
      clearTimeout(blockDeleteUndoTimeoutRef.current);
      blockDeleteUndoTimeoutRef.current = null;
    }
  }, []);

  const rememberRemovedBlock = useCallback(
    (payload: { block: DayBlock; index: number }) => {
      setLastRemovedBlock(payload);
      if (blockDeleteUndoTimeoutRef.current) {
        clearTimeout(blockDeleteUndoTimeoutRef.current);
      }
      blockDeleteUndoTimeoutRef.current = setTimeout(() => {
        setLastRemovedBlock(null);
        blockDeleteUndoTimeoutRef.current = null;
      }, BLOCK_DELETE_UNDO_WINDOW_MS);
    },
    [],
  );

  const commitBlocks = useCallback(
    (
      updater: DayBlock[] | ((prev: DayBlock[]) => DayBlock[]),
      options?: { skipHistory?: boolean },
    ) => {
      setDaySaveError(null);
      setBlocks((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (prev: DayBlock[]) => DayBlock[])(prev)
            : updater;
        const safeNext = cloneDayBlocks(next);

        if (options?.skipHistory || isHistoryNavigationRef.current) {
          return safeNext;
        }

        if (getBlocksSignature(prev) === getBlocksSignature(safeNext)) {
          return safeNext;
        }

        const prevSnapshot = cloneDayBlocks(prev);
        setBlockUndoPast((past) => {
          const nextPast = [...past, prevSnapshot];
          if (nextPast.length > MAX_DAY_BLOCK_HISTORY) {
            return nextPast.slice(nextPast.length - MAX_DAY_BLOCK_HISTORY);
          }
          return nextPast;
        });
        setBlockUndoFuture([]);

        return safeNext;
      });
    },
    [],
  );

  const undoBlocks = useCallback(() => {
    setBlockUndoPast((past) => {
      if (past.length === 0) return past;

      const previousSnapshot = past[past.length - 1];
      const nextPast = past.slice(0, -1);
      setBlockUndoFuture((future) => {
        const currentSnapshot = cloneDayBlocks(blocksRef.current);
        const nextFuture = [currentSnapshot, ...future];
        return nextFuture.slice(0, MAX_DAY_BLOCK_HISTORY);
      });

      isHistoryNavigationRef.current = true;
      setBlocks(cloneDayBlocks(previousSnapshot));
      queueMicrotask(() => {
        isHistoryNavigationRef.current = false;
      });

      return nextPast;
    });
  }, []);

  const redoBlocks = useCallback(() => {
    setBlockUndoFuture((future) => {
      if (future.length === 0) return future;

      const [nextSnapshot, ...nextFuture] = future;
      setBlockUndoPast((past) => {
        const currentSnapshot = cloneDayBlocks(blocksRef.current);
        const nextPast = [...past, currentSnapshot];
        if (nextPast.length > MAX_DAY_BLOCK_HISTORY) {
          return nextPast.slice(nextPast.length - MAX_DAY_BLOCK_HISTORY);
        }
        return nextPast;
      });

      isHistoryNavigationRef.current = true;
      setBlocks(cloneDayBlocks(nextSnapshot));
      queueMicrotask(() => {
        isHistoryNavigationRef.current = false;
      });

      return nextFuture;
    });
  }, []);

  const fetchLabs = useCallback(async () => {
    const { data, error } = await supabase
      .from("labs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const nextLabs = data as AdminLab[];
      setLabs(nextLabs);
      setSelectedLab((prev) => prev ?? nextLabs[0]?.id ?? null);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const loadDays = async () => {
      if (!selectedLab) {
        if (active) {
          setDays([]);
          setDaysMsg("");
        }
        return;
      }

      const { data, error } = await supabase
        .from("days")
        .select("id, day_number, title, video_url, content")
        .eq("lab_id", selectedLab)
        .order("day_number", { ascending: true });

      if (!active) return;

      if (error) {
        setDaysMsg("Error al cargar dias: " + error.message);
        return;
      }

      const nextDays = (data as AdminDay[] | null) ?? [];
      setDays(nextDays);
      setDaysMsg("");

      if (editingDayId && !nextDays.some((d) => d.id === editingDayId)) {
        setEditingDayId(null);
      }
      if (!editingDayId) {
        setDayNumber(getNextDayNumber(nextDays));
      }
    };

    void loadDays();
    return () => {
      active = false;
    };
  }, [daysRefreshTick, editingDayId, selectedLab, supabase]);

  useEffect(() => {
    let active = true;

    const loadComments = async () => {
      if (!selectedLab) {
        if (active) {
          setComments([]);
          setCommentsMsg("");
        }
        return;
      }

      let query = supabase
        .from("comments")
        .select("id, day_number, user_email, content, created_at")
        .eq("lab_id", selectedLab)
        .order("created_at", { ascending: false })
        .limit(100);

      const parsedDayFilter = Number.parseInt(commentDayFilter, 10);
      if (Number.isInteger(parsedDayFilter) && parsedDayFilter > 0) {
        query = query.eq("day_number", parsedDayFilter);
      }

      const { data, error } = await query;
      if (!active) return;

      if (error) {
        setCommentsMsg("Error al cargar comentarios: " + error.message);
        return;
      }

      setCommentsMsg("");
      setComments((data as AdminComment[] | null) ?? []);
    };

    void loadComments();
    return () => {
      active = false;
    };
  }, [commentDayFilter, commentsRefreshTick, selectedLab, supabase]);

  useEffect(() => {
    let active = true;

    const loadManagedUsers = async () => {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.set("q", userSearch.trim());
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const payload = (await response.json()) as {
        users?: ManagedUser[];
        error?: string;
      };

      if (!active) return;
      if (!response.ok) {
        setUserMgmtMsg(payload.error ?? "No se pudieron cargar usuarios");
        return;
      }

      const users = payload.users ?? [];
      setManagedUsers(users);
      setUserMgmtMsg("");
      if (!selectedManagedUserId && users.length > 0) {
        setSelectedManagedUserId(users[0].id);
      }
      if (
        selectedManagedUserId &&
        !users.some((managedUser) => managedUser.id === selectedManagedUserId)
      ) {
        setSelectedManagedUserId(users[0]?.id ?? null);
      }
    };

    void loadManagedUsers();
    return () => {
      active = false;
    };
  }, [selectedManagedUserId, userMgmtRefreshTick, userSearch]);

  useEffect(() => {
    let active = true;

    const loadSelectedUserData = async () => {
      if (!selectedManagedUserId) {
        if (active) {
          setEntitlementLabs([]);
          setActivitySummary(null);
          setActivityItems([]);
        }
        return;
      }

      const [entitlementsRes, activityRes] = await Promise.all([
        fetch(`/api/admin/user-entitlements?userId=${selectedManagedUserId}`),
        fetch(`/api/admin/user-activity?userId=${selectedManagedUserId}`),
      ]);

      const entitlementsPayload = (await entitlementsRes.json()) as {
        labs?: UserEntitlementLab[];
        error?: string;
      };
      const activityPayload = (await activityRes.json()) as {
        summary?: UserActivitySummary;
        progress?: UserActivityItem[];
        comments?: UserActivityItem[];
        error?: string;
      };

      if (!active) return;

      if (!entitlementsRes.ok) {
        setUserMgmtMsg(
          entitlementsPayload.error ?? "No se pudieron cargar accesos del usuario",
        );
      } else {
        setEntitlementLabs(entitlementsPayload.labs ?? []);
      }

      if (!activityRes.ok) {
        setUserMgmtMsg(
          activityPayload.error ?? "No se pudo cargar actividad del usuario",
        );
      } else {
        setActivitySummary(activityPayload.summary ?? null);
        const merged = [
          ...(activityPayload.comments ?? []),
          ...(activityPayload.progress ?? []),
        ].slice(0, 20);
        setActivityItems(merged);
      }
    };

    void loadSelectedUserData();
    return () => {
      active = false;
    };
  }, [selectedManagedUserId]);

  useEffect(() => {
    let active = true;

    const loadCommercialData = async () => {
      if (activeTab !== "commerce") return;

      if (!selectedLab) {
        if (active) {
          setLabPrices([]);
          setCoupons([]);
          setPricingMsg("Selecciona un lab para configurar precios/comercial.");
        }
        return;
      }

      const [pricesRes, couponsRes] = await Promise.all([
        fetch(`/api/admin/pricing?labId=${selectedLab}`),
        fetch("/api/admin/coupons"),
      ]);

      const pricesPayload = (await pricesRes.json()) as {
        prices?: LabPrice[];
        error?: string;
      };
      const couponsPayload = (await couponsRes.json()) as {
        coupons?: Coupon[];
        error?: string;
      };

      if (!active) return;

      if (!pricesRes.ok) {
        setPricingMsg(pricesPayload.error ?? "No se pudieron cargar precios");
      } else {
        setLabPrices(pricesPayload.prices ?? []);
        setPricingMsg("");
      }

      if (!couponsRes.ok) {
        setPricingMsg(
          couponsPayload.error ?? "No se pudieron cargar cupones/comercial",
        );
      } else {
        setCoupons(couponsPayload.coupons ?? []);
      }
    };

    void loadCommercialData();
    return () => {
      active = false;
    };
  }, [activeTab, commercialRefreshTick, selectedLab]);

  useEffect(() => {
    let active = true;

    const loadLabMetrics = async () => {
      if (activeTab !== "labs") return;
      const response = await fetch("/api/admin/labs/metrics");
      const payload = (await response.json()) as {
        metrics?: Record<string, LabQuickMetrics>;
        error?: string;
      };

      if (!active) return;
      if (!response.ok) {
        setMsg(payload.error ?? "No se pudieron cargar métricas rápidas");
        return;
      }

      setLabMetrics(payload.metrics ?? {});
    };

    void loadLabMetrics();
    return () => {
      active = false;
    };
  }, [activeTab, labs.length]);

  useEffect(() => {
    if (activeTab !== "days" || !selectedLab) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        dayFormRef.current?.requestSubmit();
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoBlocks();
        } else {
          undoBlocks();
        }
        return;
      }

      if (key === "y") {
        event.preventDefault();
        redoBlocks();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, selectedLab, redoBlocks, undoBlocks]);

  const createLab = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg("Guardando Lab...");

    const nextTitle = title.trim();
    const nextDescription = description.trim();
    const normalizedSlug = normalizeLabSlug(createLabSlug || nextTitle);
    const normalizedCoverUrl = normalizeOptionalUrl(createLabCoverUrl);
    const normalizedAccent = normalizeAccentColor(createLabAccentColor);
    const normalizedLabels = parseLabelsInput(labelsInput);
    const warnings: string[] = [];

    const { data: createdLab, error: insertError } = await supabase
      .from("labs")
      .insert([
        {
          title: nextTitle,
          description: nextDescription || null,
        },
      ])
      .select("id")
      .single();

    if (insertError || !createdLab?.id) {
      setMsg("Error: " + (insertError?.message ?? "No se pudo crear el lab"));
      return;
    }

    if (normalizedLabels.length > 0) {
      const { error } = await supabase
        .from("labs")
        .update({ labels: normalizedLabels })
        .eq("id", createdLab.id);

      if (error) {
        if (isMissingLabelsColumnError(error.message)) {
          warnings.push("faltan etiquetas (ejecuta docs/supabase-lab-labels.sql)");
        } else {
          warnings.push(`etiquetas: ${error.message}`);
        }
      }
    }

    if (normalizedSlug || normalizedCoverUrl || normalizedAccent) {
      const appearancePayload: {
        slug?: string;
        cover_image_url?: string;
        accent_color?: string;
      } = {};
      if (normalizedSlug) appearancePayload.slug = normalizedSlug;
      if (normalizedCoverUrl) appearancePayload.cover_image_url = normalizedCoverUrl;
      if (normalizedAccent) appearancePayload.accent_color = normalizedAccent;

      const { error } = await supabase
        .from("labs")
        .update(appearancePayload)
        .eq("id", createdLab.id);

      if (error) {
        if (isMissingLabMetaColumnsError(error.message)) {
          warnings.push("faltan columnas visuales (ejecuta docs/supabase-lab-meta.sql)");
        } else if (isDuplicateSlugError(error.message)) {
          warnings.push("slug repetido: ajústalo desde Editar texto");
        } else {
          warnings.push(`meta: ${error.message}`);
        }
      }
    }

    setMsg(
      warnings.length > 0
        ? `Lab creado con avisos: ${warnings.join(" · ")}`
        : "Lab creado",
    );
    setTitle("");
    setDescription("");
    setCreateLabSlug("");
    setCreateLabCoverUrl("");
    setCreateLabAccentColor("#0A56C6");
    setLabelsInput("");
    await fetchLabs();
  };

  const saveLabLabels = async (labId: string) => {
    const rawValue = labLabelDrafts[labId] ?? "";
    const labels = parseLabelsInput(rawValue);
    setSavingLabelsLabId(labId);
    setMsg("Guardando etiquetas...");

    const { error } = await supabase.from("labs").update({ labels }).eq("id", labId);

    if (error && isMissingLabelsColumnError(error.message)) {
      setMsg("Falta columna labels. Ejecuta docs/supabase-lab-labels.sql");
      setSavingLabelsLabId(null);
      return;
    }

    if (error) {
      setMsg("Error: " + error.message);
      setSavingLabelsLabId(null);
      return;
    }

    setLabs((prev) =>
      prev.map((lab) => (lab.id === labId ? { ...lab, labels } : lab)),
    );
    setMsg("Etiquetas guardadas");
    setSavingLabelsLabId(null);
  };

  const startEditLabMeta = (lab: AdminLab) => {
    setEditingLabId(lab.id);
    setLabMetaDrafts((prev) => ({
      ...prev,
      [lab.id]: {
        title: lab.title,
        description: lab.description ?? "",
        slug: lab.slug ?? "",
        coverImageUrl: lab.cover_image_url ?? "",
        accentColor: lab.accent_color ?? "#0A56C6",
      },
    }));
    setMsg("");
  };

  const cancelEditLabMeta = () => {
    setEditingLabId(null);
    setSavingLabMetaId(null);
  };

  const saveLabMeta = async (labId: string) => {
    const currentLab = labs.find((lab) => lab.id === labId);
    if (!currentLab) return;

    const draft = labMetaDrafts[labId] ?? {
      title: currentLab.title,
      description: currentLab.description ?? "",
      slug: currentLab.slug ?? "",
      coverImageUrl: currentLab.cover_image_url ?? "",
      accentColor: currentLab.accent_color ?? "#0A56C6",
    };
    const nextTitle = draft.title.trim();
    const nextDescription = draft.description.trim();
    const nextSlug = normalizeLabSlug(draft.slug || nextTitle);
    const nextCoverImageUrl = normalizeOptionalUrl(draft.coverImageUrl);
    const nextAccentColor = normalizeAccentColor(draft.accentColor);

    if (!nextTitle) {
      setMsg("El título del lab no puede estar vacío.");
      return;
    }

    setSavingLabMetaId(labId);
    setMsg("Guardando cambios del lab...");

    const { error } = await supabase
      .from("labs")
      .update({
        title: nextTitle,
        description: nextDescription || null,
        slug: nextSlug || null,
        cover_image_url: nextCoverImageUrl,
        accent_color: nextAccentColor,
      })
      .eq("id", labId);

    if (error) {
      if (isMissingLabMetaColumnsError(error.message)) {
        setMsg("Faltan columnas visuales. Ejecuta docs/supabase-lab-meta.sql");
      } else if (isDuplicateSlugError(error.message)) {
        setMsg("Ese slug ya existe. Usa otro valor.");
      } else {
        setMsg("Error: " + error.message);
      }
      setSavingLabMetaId(null);
      return;
    }

    setLabs((prev) =>
      prev.map((lab) =>
        lab.id === labId
          ? {
              ...lab,
              title: nextTitle,
              description: nextDescription || null,
              slug: nextSlug || null,
              cover_image_url: nextCoverImageUrl,
              accent_color: nextAccentColor,
            }
          : lab,
      ),
    );
    setMsg("Lab actualizado");
    setSavingLabMetaId(null);
    setEditingLabId(null);
  };

  const duplicateLab = async (labId: string) => {
    setDuplicatingLabId(labId);
    setMsg("Duplicando lab...");
    const response = await fetch(`/api/admin/labs/${labId}/duplicate`, {
      method: "POST",
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      lab?: AdminLab;
    };
    setDuplicatingLabId(null);

    if (!response.ok || !payload.ok || !payload.lab) {
      setMsg(payload.error ?? "No se pudo duplicar el lab");
      return;
    }

    setMsg(`Lab duplicado: ${payload.lab.title}`);
    await fetchLabs();
    handleSelectLab(payload.lab.id);
  };

  const saveHeroSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHeroMsg("Guardando portada...");

    const { error } = await supabase.from("app_settings").upsert(
      [
        {
          id: 1,
          hero_title: heroTitle.trim(),
          hero_subtitle: heroSubtitle.trim(),
        },
      ],
      { onConflict: "id" },
    );

    if (error) {
      setHeroMsg("Error: " + error.message);
      return;
    }

    setHeroMsg("Portada guardada");
  };

  const saveDay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLab || isDaySaving) return;
    setIsDaySaving(true);
    setDaySaveError(null);
    setDayMsg("Guardando dia...");

    const checklist = buildDayPublishChecklist(dayTitle, dayDiscussionPrompt, blocks);
    if (!checklist.requiredReady) {
      setDayMsg("Completa los requisitos del checklist antes de guardar.");
      setDaySaveError("Checklist incompleto");
      setIsDaySaving(false);
      return;
    }

    const effectiveBlocks = ensurePrimaryResourceBlock(checklist.normalizedBlocks);

    if (effectiveBlocks.length === 0) {
      setDayMsg("Agrega al menos un bloque con contenido.");
      setDaySaveError("No hay bloques con contenido");
      setIsDaySaving(false);
      return;
    }

    const primaryVideoBlock = effectiveBlocks.find((block) => {
      const group = block.group ?? getDefaultDayBlockGroup(block.type);
      return group === "resource" && block.role === "primary" && block.type === "video" && block.url;
    });
    const firstVideoBlock = effectiveBlocks.find(
      (block) => block.type === "video" && block.url,
    );
    const payload = {
      day_number: dayNumber,
      title: dayTitle,
      video_url: primaryVideoBlock?.url ?? firstVideoBlock?.url ?? null,
      content: serializeDayBlocks(effectiveBlocks, {
        discussionPrompt: dayDiscussionPrompt,
      }),
    };
    const { error } = editingDayId
      ? await supabase.from("days").update(payload).eq("id", editingDayId)
      : await supabase.from("days").insert([
          {
            lab_id: selectedLab,
            ...payload,
          },
        ]);

    if (error) {
      setDayMsg("Error: " + error.message);
      setDaySaveError(error.message);
      setIsDaySaving(false);
      return;
    }

    const savedAt = getCurrentTimestamp();
    if (editingDayId) {
      setDayMsg("Dia actualizado correctamente");
      setShowDeleteDayConfirm(false);
      setDeleteDayConfirmValue("");
      setDaySavedSignature(
        buildDayDraftSignature({
          dayNumber,
          dayTitle,
          dayDiscussionPrompt,
          blocks,
        }),
      );
      setDayLastSavedAt(savedAt);
    } else {
      setDayMsg("Dia guardado correctamente");
      const nextDayNumber = dayNumber + 1;
      const blankBlock = createBlock("text");
      setShowDeleteDayConfirm(false);
      setDeleteDayConfirmValue("");
      setDayTitle("");
      setDayDiscussionPrompt("");
      commitBlocks([blankBlock], { skipHistory: true });
      clearBlockHistory();
      setDayNumber(nextDayNumber);
      setFocusedBlockId(null);
      setPendingDeleteBlockId(null);
      clearBlockDeleteUndo();
      setDaySavedSignature(
        buildDayDraftSignature({
          dayNumber: nextDayNumber,
          dayTitle: "",
          dayDiscussionPrompt: "",
          blocks: [blankBlock],
        }),
      );
      setDayLastSavedAt(savedAt);
    }

    setDaySaveError(null);
    setIsDaySaving(false);
    setDaysRefreshTick((prev) => prev + 1);
  };

  const startCreateDay = () => {
    const nextDay = getNextDayNumber(days);
    const blankBlock = createBlock("text");
    setEditingDayId(null);
    setDayMsg("");
    setDayTitle("");
    setDayDiscussionPrompt("");
    setDaySaveError(null);
    setIsDaySaving(false);
    setShowDeleteDayConfirm(false);
    setDeleteDayConfirmValue("");
    setFocusedBlockId(blankBlock.id);
    setPendingDeleteBlockId(null);
    clearBlockDeleteUndo();
    commitBlocks([blankBlock], { skipHistory: true });
    clearBlockHistory();
    setDayBlocksViewPreset("all");
    setDayNumber(nextDay);
    setDayLastSavedAt(null);
    setDaySavedSignature(
      buildDayDraftSignature({
        dayNumber: nextDay,
        dayTitle: "",
        dayDiscussionPrompt: "",
        blocks: [blankBlock],
      }),
    );
  };

  const startEditDay = (day: AdminDay) => {
    const nextPrompt = parseDayDiscussionPrompt(day.content);
    const parsedBlocks = parseDayBlocks(day.content, day.video_url);
    const nextBlocks = parsedBlocks.length > 0 ? parsedBlocks : [createBlock("text")];
    setEditingDayId(day.id);
    setDayNumber(day.day_number);
    setDayTitle(day.title);
    setDayDiscussionPrompt(nextPrompt);
    setDaySaveError(null);
    setIsDaySaving(false);
    setShowDeleteDayConfirm(false);
    setDeleteDayConfirmValue("");
    setFocusedBlockId(nextBlocks[0]?.id ?? null);
    setPendingDeleteBlockId(null);
    clearBlockDeleteUndo();
    commitBlocks(nextBlocks, {
      skipHistory: true,
    });
    clearBlockHistory();
    setDayBlocksViewPreset("all");
    setDayLastSavedAt(getCurrentTimestamp());
    setDaySavedSignature(
      buildDayDraftSignature({
        dayNumber: day.day_number,
        dayTitle: day.title,
        dayDiscussionPrompt: nextPrompt,
        blocks: nextBlocks,
      }),
    );
    setDayMsg(`Editando dia ${day.day_number}`);
  };

  const addBlock = (type: DayBlockType) => {
    setPendingDeleteBlockId(null);
    const nextBlock = createBlock(type);
    setFocusedBlockId(nextBlock.id);
    commitBlocks((prev) => [...prev, nextBlock]);
  };

  const consolidateChallengeIntoGuidedBlock = () => {
    let nextFocusedId: string | null = null;
    let consolidated = false;

    commitBlocks((prev) => {
      const challengeTextEntries = prev
        .map((block, index) => ({ block, index }))
        .filter(({ block }) => {
          const group = block.group ?? getDefaultDayBlockGroup(block.type);
          return group === "challenge" && block.type === "text";
        });

      if (challengeTextEntries.length === 0) return prev;

      const guided = createBlock("challenge_steps");
      if (guided.type !== "challenge_steps") return prev;

      guided.group = "challenge";
      guided.role = "support";
      guided.title = "Reto del día";
      guided.steps = challengeTextEntries
        .map(({ block }, index) =>
          createChallengeStep(`Paso ${index + 1}`, block.text ?? ""),
        )
        .filter((step) => hasRichTextContent(step.text));

      if ((guided.steps?.length ?? 0) === 0) {
        guided.steps = [createChallengeStep("Paso 1", "")];
      }

      const removeIds = new Set(challengeTextEntries.map(({ block }) => block.id));
      const insertIndex = challengeTextEntries[0]?.index ?? prev.length;
      const next = prev.filter((block) => !removeIds.has(block.id));
      next.splice(insertIndex, 0, guided);

      nextFocusedId = guided.id;
      consolidated = true;
      return next;
    });

    if (consolidated && nextFocusedId) {
      setFocusedBlockId(nextFocusedId);
      setDayMsg("Reto consolidado en un solo bloque guiado.");
    } else {
      setDayMsg("No hay bloques de texto en Reto del día para consolidar.");
    }
  };

  const applyTemplate = () => {
    const template = dayBlockTemplates.find((item) => item.id === selectedTemplateId);
    if (!template) return;

    const hasDraftContent =
      dayPublishChecklist.normalizedBlocks.length > 0 || dayTitle.trim().length > 0;
    if (
      hasDraftContent &&
      !window.confirm(
        `Se reemplazarán los bloques actuales con la plantilla "${template.label}". ¿Continuar?`,
      )
    ) {
      return;
    }

    const nextBlocks = ensurePrimaryResourceBlock(template.build());
    commitBlocks(nextBlocks);
    clearBlockDeleteUndo();
    clearBlockHistory();
    setFocusedBlockId(nextBlocks[0]?.id ?? null);
    setPendingDeleteBlockId(null);
    setDayBlocksViewPreset("all");
    setDayMsg(`Plantilla aplicada: ${template.label}`);
  };

  const uploadFileForBlock = async (block: DayBlock, file: File) => {
    if (!selectedLab) return;
    if (
      block.type === "text" ||
      block.type === "checklist" ||
      block.type === "quiz" ||
      block.type === "challenge_steps"
    ) {
      return;
    }

    setUploadingBlockId(block.id);
    setDayMsg(`Subiendo ${file.name}...`);

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const extension = cleanFileName.includes(".")
      ? cleanFileName.split(".").pop()
      : "";
    const uuid =
      globalThis.crypto?.randomUUID?.() ??
      `${selectedLab}_${dayNumber}_${block.id}_${cleanFileName}`;
    const uniqueName = `${uuid}${extension ? `.${extension}` : ""}`;
    const path = `labs/${selectedLab}/day-${dayNumber}/${uniqueName}`;

    const { error } = await supabase.storage
      .from("lab-media")
      .upload(path, file, { upsert: false, cacheControl: "3600" });

    if (error) {
      setDayMsg("Error al subir archivo: " + error.message);
      setUploadingBlockId(null);
      return;
    }

    const { data } = supabase.storage.from("lab-media").getPublicUrl(path);
    updateBlock(block.id, { url: data.publicUrl });
    setDayMsg("Archivo subido correctamente");
    setUploadingBlockId(null);
  };

  const uploadLabCoverFile = async (
    file: File,
    options?: { labId?: string },
  ): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      setMsg("Selecciona una imagen valida (PNG, JPG, WEBP o AVIF).");
      return null;
    }

    const MAX_COVER_FILE_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_COVER_FILE_BYTES) {
      setMsg("La portada excede 8MB. Usa una imagen mas ligera.");
      return null;
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const extension = cleanFileName.includes(".")
      ? cleanFileName.split(".").pop()?.toLowerCase()
      : "";
    const uuid =
      globalThis.crypto?.randomUUID?.() ??
      `${options?.labId ?? "draft"}_${Date.now()}_${cleanFileName}`;
    const uniqueName = `${uuid}${extension ? `.${extension}` : ""}`;
    const labScope = options?.labId ? `labs/${options.labId}` : "labs/drafts";
    const path = `${labScope}/cover/${uniqueName}`;

    const { error } = await supabase.storage
      .from("lab-media")
      .upload(path, file, { upsert: false, cacheControl: "3600" });

    if (error) {
      setMsg("Error al subir portada: " + error.message);
      return null;
    }

    const { data } = supabase.storage.from("lab-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreateLabCoverUpload = async (file: File) => {
    setIsUploadingCreateCover(true);
    setMsg("Subiendo portada...");
    const publicUrl = await uploadLabCoverFile(file);
    if (publicUrl) {
      setCreateLabCoverUrl(publicUrl);
      setMsg("Portada lista. Se aplicara al crear el lab.");
    }
    setIsUploadingCreateCover(false);
  };

  const handleEditLabCoverUpload = async (lab: AdminLab, file: File) => {
    setUploadingLabCoverId(lab.id);
    setMsg(`Subiendo portada para "${lab.title}"...`);
    const publicUrl = await uploadLabCoverFile(file, { labId: lab.id });
    if (publicUrl) {
      setLabMetaDrafts((prev) => ({
        ...prev,
        [lab.id]: {
          ...(prev[lab.id] ?? {
            title: lab.title,
            description: lab.description ?? "",
            slug: lab.slug ?? "",
            coverImageUrl: lab.cover_image_url ?? "",
            accentColor: lab.accent_color ?? "#0A56C6",
          }),
          coverImageUrl: publicUrl,
        },
      }));
      setMsg("Portada subida. Guarda los cambios del lab para aplicarla.");
    }
    setUploadingLabCoverId(null);
  };

  const handleQuickLabCoverUpload = async (lab: AdminLab, file: File) => {
    setUploadingLabCoverId(lab.id);
    setMsg(`Subiendo portada para "${lab.title}"...`);
    const publicUrl = await uploadLabCoverFile(file, { labId: lab.id });
    if (!publicUrl) {
      setUploadingLabCoverId(null);
      return;
    }

    const { error } = await supabase
      .from("labs")
      .update({ cover_image_url: publicUrl })
      .eq("id", lab.id);

    if (error) {
      if (isMissingLabMetaColumnsError(error.message)) {
        setMsg("Faltan columnas visuales. Ejecuta docs/supabase-lab-meta.sql");
      } else {
        setMsg("Error al guardar portada: " + error.message);
      }
      setUploadingLabCoverId(null);
      return;
    }

    setLabs((prev) =>
      prev.map((item) =>
        item.id === lab.id ? { ...item, cover_image_url: publicUrl } : item,
      ),
    );
    setLabMetaDrafts((prev) => ({
      ...prev,
      [lab.id]: {
        ...(prev[lab.id] ?? {
          title: lab.title,
          description: lab.description ?? "",
          slug: lab.slug ?? "",
          coverImageUrl: lab.cover_image_url ?? "",
          accentColor: lab.accent_color ?? "#0A56C6",
        }),
        coverImageUrl: publicUrl,
      },
    }));
    setMsg(`Portada actualizada para "${lab.title}".`);
    setUploadingLabCoverId(null);
  };

  const updateBlock = (id: string, patch: Partial<DayBlock>) => {
    commitBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    );
  };

  const updateChecklistItem = (
    blockId: string,
    itemId: string,
    patch: Partial<DayChecklistItem>,
  ) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "checklist") return block;
        return {
          ...block,
          items: (block.items ?? []).map((item) =>
            item.id === itemId ? { ...item, ...patch } : item,
          ),
        };
      }),
    );
  };

  const addChecklistItem = (blockId: string) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "checklist") return block;
        return {
          ...block,
          items: [...(block.items ?? []), createChecklistItem()],
        };
      }),
    );
  };

  const removeChecklistItem = (blockId: string, itemId: string) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "checklist") return block;
        const nextItems = (block.items ?? []).filter((item) => item.id !== itemId);
        if (nextItems.length === 0) return { ...block, items: [createChecklistItem()] };
        return { ...block, items: nextItems };
      }),
    );
  };

  const updateQuizQuestion = (
    blockId: string,
    questionId: string,
    patch: Partial<DayQuizQuestion>,
  ) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "quiz") return block;
        return {
          ...block,
          questions: (block.questions ?? []).map((question) =>
            question.id === questionId ? { ...question, ...patch } : question,
          ),
        };
      }),
    );
  };

  const addQuizQuestion = (blockId: string) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "quiz") return block;
        return {
          ...block,
          questions: [...(block.questions ?? []), createQuizQuestion()],
        };
      }),
    );
  };

  const removeQuizQuestion = (blockId: string, questionId: string) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "quiz") return block;
        const nextQuestions = (block.questions ?? []).filter(
          (question) => question.id !== questionId,
        );
        if (nextQuestions.length === 0) return { ...block, questions: [createQuizQuestion()] };
        return { ...block, questions: nextQuestions };
      }),
    );
  };

  const addQuizOption = (blockId: string, questionId: string) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "quiz") return block;
        return {
          ...block,
          questions: (block.questions ?? []).map((question) => {
            if (question.id !== questionId) return question;
            if (question.options.length >= 6) return question;
            return { ...question, options: [...question.options, ""] };
          }),
        };
      }),
    );
  };

  const updateQuizOption = (
    blockId: string,
    questionId: string,
    optionIndex: number,
    value: string,
  ) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "quiz") return block;
        return {
          ...block,
          questions: (block.questions ?? []).map((question) => {
            if (question.id !== questionId) return question;
            const nextOptions = [...question.options];
            nextOptions[optionIndex] = value;
            return { ...question, options: nextOptions };
          }),
        };
      }),
    );
  };

  const removeQuizOption = (
    blockId: string,
    questionId: string,
    optionIndex: number,
  ) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "quiz") return block;
        return {
          ...block,
          questions: (block.questions ?? []).map((question) => {
            if (question.id !== questionId) return question;
            if (question.options.length <= 2) return question;
            const nextOptions = question.options.filter((_, idx) => idx !== optionIndex);
            let nextCorrect = question.correctIndex;
            if (typeof nextCorrect === "number") {
              if (nextCorrect === optionIndex) {
                nextCorrect = null;
              } else if (nextCorrect > optionIndex) {
                nextCorrect -= 1;
              }
            }
            return {
              ...question,
              options: nextOptions,
              correctIndex: nextCorrect,
            };
          }),
        };
      }),
    );
  };

  const updateChallengeStep = (
    blockId: string,
    stepId: string,
    patch: Partial<DayChallengeStep>,
  ) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "challenge_steps") return block;
        return {
          ...block,
          steps: (block.steps ?? []).map((step) =>
            step.id === stepId ? { ...step, ...patch } : step,
          ),
        };
      }),
    );
  };

  const addChallengeStep = (blockId: string) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "challenge_steps") return block;
        const nextIndex = (block.steps?.length ?? 0) + 1;
        return {
          ...block,
          steps: [...(block.steps ?? []), createChallengeStep(`Paso ${nextIndex}`, "")],
        };
      }),
    );
  };

  const removeChallengeStep = (blockId: string, stepId: string) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId || block.type !== "challenge_steps") return block;
        const nextSteps = (block.steps ?? []).filter((step) => step.id !== stepId);
        if (nextSteps.length === 0) {
          return {
            ...block,
            steps: [createChallengeStep("Paso 1", "")],
          };
        }
        return { ...block, steps: nextSteps };
      }),
    );
  };

  const removeBlock = (id: string) => {
    if (blocks.length === 1) return;
    const targetIndex = blocks.findIndex((block) => block.id === id);
    if (targetIndex < 0) return;
    const removedSnapshot = cloneDayBlocks([blocks[targetIndex]])[0];
    setPendingDeleteBlockId(null);
    const fallbackFocus =
      blocks[targetIndex + 1]?.id ??
      blocks[targetIndex - 1]?.id ??
      null;
    setFocusedBlockId((prev) => (prev === id ? fallbackFocus : prev));
    commitBlocks((prev) => prev.filter((block) => block.id !== id));
    rememberRemovedBlock({
      block: removedSnapshot,
      index: targetIndex,
    });
  };

  const undoRemoveBlock = useCallback(() => {
    if (!lastRemovedBlock) return;
    const blockSnapshot = cloneDayBlocks([lastRemovedBlock.block])[0];
    commitBlocks((prev) => {
      if (prev.some((block) => block.id === blockSnapshot.id)) return prev;
      const next = [...prev];
      const insertIndex = Math.min(Math.max(lastRemovedBlock.index, 0), next.length);
      next.splice(insertIndex, 0, blockSnapshot);
      return next;
    });
    setFocusedBlockId(blockSnapshot.id);
    clearBlockDeleteUndo();
  }, [clearBlockDeleteUndo, commitBlocks, lastRemovedBlock]);

  const moveBlock = (index: number, direction: -1 | 1) => {
    commitBlocks((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      setCommentsMsg("No se pudo borrar: " + error.message);
      return;
    }
    setComments((prev) => prev.filter((comment) => comment.id !== commentId));
  };

  const deleteDay = async () => {
    if (!editingDayId || isDeletingDay) return;

    const targetDay = days.find((day) => day.id === editingDayId);
    if (!targetDay) return;

    setIsDeletingDay(true);
    setDaySaveError(null);
    setDayMsg("Eliminando dia...");

    const { error } = await supabase.from("days").delete().eq("id", editingDayId);
    if (error) {
      setDayMsg("Error al eliminar: " + error.message);
      setDaySaveError(error.message);
      setIsDeletingDay(false);
      return;
    }

    const nextDays = days.filter((day) => day.id !== editingDayId);
    const nextDayNumber = getNextDayNumber(nextDays);
    const blankBlock = createBlock("text");
    setDays(nextDays);
    setEditingDayId(null);
    setDayTitle("");
    setDayDiscussionPrompt("");
    setShowDeleteDayConfirm(false);
    setDeleteDayConfirmValue("");
      setFocusedBlockId(blankBlock.id);
    setPendingDeleteBlockId(null);
    clearBlockDeleteUndo();
    commitBlocks([blankBlock], { skipHistory: true });
    clearBlockHistory();
    setDayNumber(nextDayNumber);
    setDayLastSavedAt(null);
    setDaySavedSignature(
      buildDayDraftSignature({
        dayNumber: nextDayNumber,
        dayTitle: "",
        dayDiscussionPrompt: "",
        blocks: [blankBlock],
      }),
    );
    setDayMsg(`Dia ${targetDay.day_number} eliminado`);
    setIsDeletingDay(false);
    setDaysRefreshTick((prev) => prev + 1);
  };

  const toggleUserLabAccess = async (labId: string, grant: boolean) => {
    if (!selectedManagedUserId) return;

    setUserMgmtMsg("Guardando acceso...");
    const response = await fetch("/api/admin/user-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedManagedUserId,
        labId,
        grant,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setUserMgmtMsg(payload.error ?? "No se pudo actualizar acceso");
      return;
    }

    setEntitlementLabs((prev) =>
      prev.map((lab) =>
        lab.id === labId
          ? { ...lab, hasAccess: grant, status: grant ? "active" : "revoked" }
          : lab,
      ),
    );
    setUserMgmtMsg(grant ? "Acceso concedido" : "Acceso revocado");
    setUserMgmtRefreshTick((prev) => prev + 1);
  };

  const deleteLab = async (lab: AdminLab) => {
    const confirmed = window.confirm(
      `¿Eliminar por completo el Lab "${lab.title}"?\n\nEsto elimina días, comentarios, progreso y accesos asociados.`,
    );
    if (!confirmed) return;

    setIsDeletingLabId(lab.id);
    const response = await fetch(`/api/admin/labs/${lab.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMsg(payload.error ?? "No se pudo eliminar el lab");
      setIsDeletingLabId(null);
      return;
    }

    setMsg("Lab eliminado correctamente");
    if (selectedLab === lab.id) {
      setSelectedLab(null);
      setEditingDayId(null);
      setDays([]);
    }
    await fetchLabs();
    setCommercialRefreshTick((prev) => prev + 1);
    setIsDeletingLabId(null);
  };

  const savePrice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLab) {
      setPricingMsg("Selecciona un lab.");
      return;
    }

    const amount = Number(priceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPricingMsg("Monto inválido.");
      return;
    }

    setPricingMsg("Guardando precio...");
    const response = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labId: selectedLab,
        currency: priceCurrency,
        amount,
        isActive: true,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setPricingMsg(payload.error ?? "No se pudo guardar precio");
      return;
    }

    setPricingMsg("Precio guardado");
    setPriceAmount("");
    setCommercialRefreshTick((prev) => prev + 1);
  };

  const createCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setPricingMsg("Guardando cupón...");
    const response = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        discountType: couponType,
        percentOff: couponType === "percent" ? Number(couponPercent) : null,
        amountOff: couponType === "fixed" ? Number(couponAmount) : null,
        currency: couponType === "fixed" ? couponCurrency : null,
        labId: couponScope === "lab" ? couponLabId || selectedLab : null,
        expiresAt: couponExpiresAt || null,
        isActive: true,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setPricingMsg(payload.error ?? "No se pudo crear cupón");
      return;
    }

    setCouponCode("");
    setCouponPercent("");
    setCouponAmount("");
    setCouponExpiresAt("");
    setPricingMsg("Cupón creado");
    setCommercialRefreshTick((prev) => prev + 1);
  };

  const toggleCouponActive = async (couponId: string, nextValue: boolean) => {
    setPricingMsg("Actualizando cupón...");
    const response = await fetch("/api/admin/coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: couponId, isActive: nextValue }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setPricingMsg(payload.error ?? "No se pudo actualizar cupón");
      return;
    }
    setPricingMsg(nextValue ? "Cupón activado" : "Cupón desactivado");
    setCommercialRefreshTick((prev) => prev + 1);
  };

  const handleSelectLab = (labId: string) => {
    const blankBlock = createBlock("text");
    setSelectedLab(labId);
    setCouponLabId(labId);
    setEditingDayId(null);
    setDayMsg("");
    setDayTitle("");
    setDayDiscussionPrompt("");
    setDaySaveError(null);
    setIsDaySaving(false);
    setDayLastSavedAt(null);
    setShowDeleteDayConfirm(false);
    setDeleteDayConfirmValue("");
    setFocusedBlockId(blankBlock.id);
    setPendingDeleteBlockId(null);
    clearBlockDeleteUndo();
    commitBlocks([blankBlock], { skipHistory: true });
    clearBlockHistory();
    setDayNumber(1);
    setDaySavedSignature(
      buildDayDraftSignature({
        dayNumber: 1,
        dayTitle: "",
        dayDiscussionPrompt: "",
        blocks: [blankBlock],
      }),
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="ast-admin-theme relative isolate min-h-screen !bg-[#020617] p-4 text-slate-100 md:p-6 xl:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,86,198,0.3),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(4,164,90,0.16),transparent_26%),linear-gradient(180deg,rgba(2,9,24,0.2),rgba(2,9,24,0.78))]" />
      <div className="relative mx-auto w-full max-w-[1440px] space-y-10">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--ast-sky)]/35 bg-[rgba(4,12,31,0.88)] px-4 py-4 shadow-[0_14px_30px_rgba(2,6,23,0.52)]">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold text-slate-50">
            Panel de Admin
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
            >
              Ir al Inicio
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full border border-orange-400/50 bg-orange-500/12 px-3 py-1.5 text-sm text-orange-200 transition hover:bg-orange-500/22"
            >
              Salir
            </button>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 text-xs">
          {[
            { key: "hero", label: "Hero" },
            { key: "labs", label: "Labs" },
            { key: "days", label: "Días" },
            { key: "comments", label: "Comentarios" },
            { key: "users", label: "Usuarios" },
            { key: "commerce", label: "Comercial" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as AdminTab)}
              className={`rounded-full px-3 py-1.5 font-semibold transition ${
                activeTab === tab.key
                  ? "border border-blue-300/80 bg-blue-600/75 text-white shadow-[0_0_0_1px_rgba(147,197,253,0.4)]"
                  : "border border-slate-600 bg-slate-900 text-slate-100 hover:border-slate-500 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "hero" && (
          <section className="rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(9,18,44,0.96),rgba(4,11,30,0.96))] p-6 shadow-[0_18px_36px_rgba(1,7,22,0.5)]">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-blue-200">
            1. Hero de Inicio
          </h2>
          <form onSubmit={saveHeroSettings} className="space-y-4">
            <input
              type="text"
              placeholder="Titulo principal"
              className="p-2 rounded bg-black border border-gray-600 w-full"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Subtitulo del hero"
              className="p-2 h-24 rounded bg-black border border-gray-600 w-full"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              required
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-white font-bold"
            >
              Guardar Hero
            </button>
            {heroMsg && <span className="ml-4 text-yellow-300">{heroMsg}</span>}
          </form>
          </section>
        )}

        {activeTab === "labs" && (
          <section className="rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(9,18,44,0.96),rgba(4,11,30,0.96))] p-6 shadow-[0_18px_36px_rgba(1,7,22,0.5)]">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-blue-200">
            2. Crear Nuevo Curso (Lab)
          </h2>
          <form onSubmit={createLab} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Titulo del Lab"
                className="p-2 rounded bg-black border border-gray-600 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Descripcion corta"
                className="p-2 rounded bg-black border border-gray-600 w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.3fr)_140px]">
              <input
                type="text"
                placeholder="Slug (opcional, ej. prompt-engineering)"
                className="p-2 rounded bg-black border border-gray-600 w-full"
                value={createLabSlug}
                onChange={(e) => setCreateLabSlug(e.target.value)}
              />
              <input
                type="text"
                placeholder="URL de portada (opcional)"
                className="p-2 rounded bg-black border border-gray-600 w-full"
                value={createLabCoverUrl}
                onChange={(e) => setCreateLabCoverUrl(e.target.value)}
              />
              <div className="rounded border border-gray-600 bg-black p-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void handleCreateLabCoverUpload(file);
                      e.currentTarget.value = "";
                    }}
                    className="w-full text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-xs file:text-white hover:file:bg-gray-600"
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                  Uploader directo portada
                  {isUploadingCreateCover ? " · subiendo..." : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded border border-gray-600 bg-black p-2">
                <input
                  type="color"
                  value={normalizeAccentColor(createLabAccentColor) ?? "#0A56C6"}
                  onChange={(e) => setCreateLabAccentColor(e.target.value)}
                  className="h-8 w-8 rounded border border-gray-700 bg-transparent p-0"
                  aria-label="Color de acento"
                />
                <input
                  type="text"
                  value={createLabAccentColor}
                  onChange={(e) => setCreateLabAccentColor(e.target.value)}
                  placeholder="#0A56C6"
                  className="w-full bg-transparent text-xs text-gray-200 outline-none"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="Etiquetas (coma): NEW, TOP, AUDIO"
              className="p-2 rounded bg-black border border-gray-600 w-full"
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={isUploadingCreateCover}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-white font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingCreateCover ? "Subiendo portada..." : "Crear Lab"}
            </button>
            {msg && <span className="ml-4 text-yellow-300">{msg}</span>}
          </form>

          <div className="mt-8 border-t border-gray-700 pt-5">
            <h3 className="text-sm uppercase tracking-widest text-gray-400 mb-3">
              Labs existentes (eliminación completa)
            </h3>
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {labs.map((lab) => {
                const isEditing = editingLabId === lab.id;
                const metaDraft = labMetaDrafts[lab.id] ?? {
                  title: lab.title,
                  description: lab.description ?? "",
                  slug: lab.slug ?? "",
                  coverImageUrl: lab.cover_image_url ?? "",
                  accentColor: lab.accent_color ?? "#0A56C6",
                };
                const isSelected = selectedLab === lab.id;
                const metrics = labMetrics[lab.id];
                return (
                  <div
                    key={lab.id}
                    className={`rounded border p-2.5 ${
                      isSelected
                        ? "border-cyan-500/60 bg-cyan-950/20"
                        : "border-gray-700 bg-black/30"
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                      <div className="min-w-0 space-y-1.5">
                        {isEditing ? (
                          <div className="grid gap-2">
                            <input
                              type="text"
                              value={metaDraft.title}
                              onChange={(e) =>
                                setLabMetaDrafts((prev) => ({
                                  ...prev,
                                  [lab.id]: {
                                    ...(prev[lab.id] ?? {
                                      title: lab.title,
                                      description: lab.description ?? "",
                                    }),
                                    title: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Título del lab"
                              className="w-full rounded border border-gray-600 bg-black p-2 text-sm"
                            />
                            <input
                              type="text"
                              value={metaDraft.description}
                              onChange={(e) =>
                                setLabMetaDrafts((prev) => ({
                                  ...prev,
                                  [lab.id]: {
                                    ...(prev[lab.id] ?? {
                                      title: lab.title,
                                      description: lab.description ?? "",
                                    }),
                                    description: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Subtexto / descripción corta"
                              className="w-full rounded border border-gray-600 bg-black p-2 text-sm"
                            />
                            <input
                              type="text"
                              value={metaDraft.slug}
                              onChange={(e) =>
                                setLabMetaDrafts((prev) => ({
                                  ...prev,
                                  [lab.id]: {
                                    ...(prev[lab.id] ?? {
                                      title: lab.title,
                                      description: lab.description ?? "",
                                      slug: lab.slug ?? "",
                                      coverImageUrl: lab.cover_image_url ?? "",
                                      accentColor: lab.accent_color ?? "#0A56C6",
                                    }),
                                    slug: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Slug (ej. prompt-engineering)"
                              className="w-full rounded border border-gray-600 bg-black p-2 text-sm"
                            />
                            <input
                              type="text"
                              value={metaDraft.coverImageUrl}
                              onChange={(e) =>
                                setLabMetaDrafts((prev) => ({
                                  ...prev,
                                  [lab.id]: {
                                    ...(prev[lab.id] ?? {
                                      title: lab.title,
                                      description: lab.description ?? "",
                                      slug: lab.slug ?? "",
                                      coverImageUrl: lab.cover_image_url ?? "",
                                      accentColor: lab.accent_color ?? "#0A56C6",
                                    }),
                                    coverImageUrl: e.target.value,
                                  },
                                }))
                              }
                              placeholder="URL imagen portada"
                              className="w-full rounded border border-gray-600 bg-black p-2 text-sm"
                            />
                            <div className="rounded border border-gray-600 bg-black p-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/avif"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    void handleEditLabCoverUpload(lab, file);
                                    e.currentTarget.value = "";
                                  }}
                                  className="w-full text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-xs file:text-white hover:file:bg-gray-600"
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-gray-400">
                                Uploader directo portada
                                {uploadingLabCoverId === lab.id ? " · subiendo..." : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 rounded border border-gray-600 bg-black p-2">
                              <input
                                type="color"
                                value={normalizeAccentColor(metaDraft.accentColor) ?? "#0A56C6"}
                                onChange={(e) =>
                                  setLabMetaDrafts((prev) => ({
                                    ...prev,
                                    [lab.id]: {
                                      ...(prev[lab.id] ?? {
                                        title: lab.title,
                                        description: lab.description ?? "",
                                        slug: lab.slug ?? "",
                                        coverImageUrl: lab.cover_image_url ?? "",
                                        accentColor: lab.accent_color ?? "#0A56C6",
                                      }),
                                      accentColor: e.target.value,
                                    },
                                  }))
                                }
                                className="h-8 w-8 rounded border border-gray-700 bg-transparent p-0"
                                aria-label="Color de acento"
                              />
                              <input
                                type="text"
                                value={metaDraft.accentColor}
                                onChange={(e) =>
                                  setLabMetaDrafts((prev) => ({
                                    ...prev,
                                    [lab.id]: {
                                      ...(prev[lab.id] ?? {
                                        title: lab.title,
                                        description: lab.description ?? "",
                                        slug: lab.slug ?? "",
                                        coverImageUrl: lab.cover_image_url ?? "",
                                        accentColor: lab.accent_color ?? "#0A56C6",
                                      }),
                                      accentColor: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="#0A56C6"
                                className="w-full bg-transparent text-xs text-gray-200 outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-100">{lab.title}</p>
                              {isSelected && (
                                <span className="rounded-full border border-cyan-500/50 bg-cyan-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                                  Seleccionado
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-gray-500">
                              {lab.description ?? "Sin descripción"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                              <span className="rounded border border-gray-700/80 bg-black/35 px-2 py-0.5">
                                slug: {lab.slug ?? "auto"}
                              </span>
                              <span className="rounded border border-gray-700/80 bg-black/35 px-2 py-0.5">
                                portada: {lab.cover_image_url ? "Sí" : "No"}
                              </span>
                              <span className="rounded border border-gray-700/80 bg-black/35 px-2 py-0.5">
                                acento: {lab.accent_color ?? "default"}
                              </span>
                            </div>
                          </>
                        )}

                        <div className="flex flex-wrap items-center gap-1">
                          {normalizeLabels(lab.labels).map((label) => (
                            <span
                              key={`${lab.id}-${label}`}
                              className="rounded-full border border-cyan-500/50 bg-cyan-900/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-200"
                            >
                              {label}
                            </span>
                          ))}
                          {normalizeLabels(lab.labels).length === 0 && (
                            <span className="text-[10px] text-gray-500">Sin etiquetas</span>
                          )}
                        </div>

                        {metrics && (
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            <span className="rounded border border-gray-700/70 bg-black/35 px-2 py-0.5 text-gray-300">
                              Días: {metrics.dayCount}
                            </span>
                            <span className="rounded border border-gray-700/70 bg-black/35 px-2 py-0.5 text-gray-300">
                              Comentarios: {metrics.commentCount}
                            </span>
                            <span className="rounded border border-gray-700/70 bg-black/35 px-2 py-0.5 text-gray-300">
                              Activos: {metrics.activeEntitlementCount}
                            </span>
                            <span className="rounded border border-gray-700/70 bg-black/35 px-2 py-0.5 text-gray-300">
                              Progreso: {metrics.progressCount}
                            </span>
                          </div>
                        )}

                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <input
                            type="text"
                            value={labLabelDrafts[lab.id] ?? formatLabelsForInput(lab.labels)}
                            onChange={(e) =>
                              setLabLabelDrafts((prev) => ({
                                ...prev,
                                [lab.id]: e.target.value,
                              }))
                            }
                            placeholder="NEW, TOP, ETC"
                            className="w-full rounded border border-gray-600 bg-black p-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => void saveLabLabels(lab.id)}
                            disabled={savingLabelsLabId === lab.id}
                            className="rounded-md border border-cyan-600/70 bg-cyan-900/45 px-2.5 py-1 text-[11px] font-medium leading-4 text-cyan-100 transition hover:bg-cyan-800/55 disabled:opacity-60"
                          >
                            {savingLabelsLabId === lab.id
                              ? "Guardando..."
                              : "Guardar etiquetas"}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                        <button
                          type="button"
                          onClick={() => handleSelectLab(lab.id)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-medium leading-4 transition ${
                            isSelected
                              ? "border-cyan-400/70 bg-cyan-900/40 text-cyan-100"
                              : "border-gray-600 bg-gray-800 text-gray-200 hover:border-gray-500 hover:bg-gray-700"
                          }`}
                        >
                          {isSelected ? "Seleccionado" : "Seleccionar"}
                        </button>

                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveLabMeta(lab.id)}
                              disabled={savingLabMetaId === lab.id || uploadingLabCoverId === lab.id}
                              className="rounded-md border border-emerald-500/70 bg-emerald-900/45 px-2.5 py-1 text-[11px] font-medium leading-4 text-emerald-100 transition hover:bg-emerald-800/55 disabled:opacity-50"
                            >
                              {savingLabMetaId === lab.id
                                ? "Guardando..."
                                : uploadingLabCoverId === lab.id
                                  ? "Subiendo portada..."
                                  : "Guardar"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditLabMeta}
                              className="rounded-md border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] font-medium leading-4 text-gray-200 transition hover:border-gray-500 hover:bg-gray-700"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <label
                              className={`inline-flex cursor-pointer items-center rounded-md border px-2.5 py-1 text-[11px] font-medium leading-4 transition ${
                                uploadingLabCoverId === lab.id
                                  ? "border-sky-500/70 bg-sky-900/40 text-sky-100 opacity-80"
                                  : "border-sky-500/70 bg-sky-900/30 text-sky-100 hover:bg-sky-800/55"
                              }`}
                            >
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/avif"
                                className="hidden"
                                disabled={uploadingLabCoverId === lab.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  void handleQuickLabCoverUpload(lab, file);
                                  e.currentTarget.value = "";
                                }}
                              />
                              {uploadingLabCoverId === lab.id
                                ? "Subiendo portada..."
                                : "Subir portada"}
                            </label>
                            <button
                              type="button"
                              onClick={() => startEditLabMeta(lab)}
                              className="rounded-md border border-indigo-500/70 bg-indigo-900/40 px-2.5 py-1 text-[11px] font-medium leading-4 text-indigo-100 transition hover:bg-indigo-800/55"
                            >
                              Editar texto
                            </button>
                            <button
                              type="button"
                              onClick={() => void duplicateLab(lab.id)}
                              disabled={duplicatingLabId === lab.id}
                              className="rounded-md border border-emerald-500/70 bg-emerald-900/35 px-2.5 py-1 text-[11px] font-medium leading-4 text-emerald-100 transition hover:bg-emerald-800/55 disabled:opacity-50"
                            >
                              {duplicatingLabId === lab.id ? "Duplicando..." : "Duplicar"}
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => void deleteLab(lab)}
                          disabled={isDeletingLabId === lab.id}
                          className="rounded-md border border-red-600/80 bg-red-900/45 px-2.5 py-1 text-[11px] font-medium leading-4 text-red-100 transition hover:bg-red-800/60 disabled:opacity-50"
                        >
                          {isDeletingLabId === lab.id ? "Eliminando..." : "Eliminar Lab"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {labs.length === 0 && (
                <p className="text-sm text-gray-400">No hay labs para mostrar.</p>
              )}
            </div>
          </div>
          </section>
        )}

        {activeTab === "days" && (
          <section className="rounded-2xl border border-white/15 bg-[linear-gradient(160deg,rgba(15,23,42,0.78),rgba(2,6,23,0.84))] p-4 shadow-[0_16px_34px_rgba(2,6,23,0.35)] md:p-6">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-emerald-200">
            3. Disenar Dias con Bloques de Contenido
          </h2>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
            <div className="space-y-6 xl:border-r xl:border-gray-700 xl:pr-5">
              <h3 className="text-sm text-gray-400 mb-2 uppercase font-bold">
                Selecciona un Lab:
              </h3>
              <ul className="grid grid-cols-1 gap-2">
                {labs.map((lab) => (
                  <li
                    key={lab.id}
                    onClick={() => handleSelectLab(lab.id)}
                    className={`p-2 rounded cursor-pointer transition ${selectedLab === lab.id ? "bg-green-900 text-white border border-green-500" : "bg-gray-900 text-gray-400 hover:bg-gray-700"}`}
                  >
                    {lab.title}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm text-gray-400 uppercase font-bold">
                    Dias existentes
                  </h3>
                  <button
                    type="button"
                    onClick={startCreateDay}
                    className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
                  >
                    Nuevo
                  </button>
                </div>
                {daysMsg && <p className="text-xs text-yellow-300 mb-2">{daysMsg}</p>}
                <ul className="grid grid-cols-1 gap-2">
                  {days.map((day) => (
                    <li
                      key={day.id}
                      className={`rounded border p-2.5 transition ${
                        editingDayId === day.id
                          ? "border-green-500 bg-green-950/30"
                          : "border-gray-700 bg-black/40 hover:border-gray-500"
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full text-left space-y-1"
                        title={`Dia ${day.day_number}: ${day.title}`}
                        onClick={() => startEditDay(day)}
                      >
                        <p className="text-[11px] uppercase tracking-wider text-gray-400">
                          Dia {day.day_number}
                        </p>
                        <p className="truncate text-sm font-medium leading-snug text-gray-100">
                          {day.title}
                        </p>
                      </button>
                    </li>
                  ))}
                  {days.length === 0 && (
                    <li className="text-xs text-gray-500">Aun no hay dias.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="min-w-0">
              {!selectedLab ? (
                <div className="h-full flex items-center justify-center text-gray-500 italic">
                  Selecciona un curso de la lista para agregar contenido.
                </div>
              ) : (
                <form
                  ref={dayFormRef}
                  onSubmit={saveDay}
                  className="space-y-4 animate-fadeIn"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-xl tracking-tight text-white">
                        {editingDayId ? "Editar Dia" : "Constructor de Dia"}
                      </h3>
                      <p className="mt-1 text-xs text-gray-400">
                        Orden visual libre. El bloque con rol Principal define la ruta del día.
                      </p>
                    </div>
                    {editingDayId && (
                      <button
                        type="button"
                        onClick={startCreateDay}
                        className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                      >
                        Salir de edicion
                      </button>
                    )}
                  </div>

                  <div className="sticky top-4 z-20 rounded-xl border border-[var(--ast-sky)]/35 bg-[rgba(4,12,31,0.9)] p-3 shadow-[0_10px_24px_rgba(1,8,22,0.45)] backdrop-blur-sm">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300/80">
                          Estado de publicación
                        </p>
                        <p
                          className={`text-sm font-semibold ${
                            daySaveState === "saving"
                              ? "text-amber-200"
                              : daySaveState === "error"
                                ? "text-rose-200"
                                : daySaveState === "dirty"
                                  ? "text-cyan-200"
                                  : daySaveState === "saved"
                                    ? "text-emerald-200"
                                    : "text-slate-200"
                          }`}
                        >
                          {daySaveState === "saving" && "Publicando cambios..."}
                          {daySaveState === "error" &&
                            `Error de publicación${daySaveError ? `: ${daySaveError}` : ""}`}
                          {daySaveState === "dirty" && "Borrador local sin publicar"}
                          {daySaveState === "saved" &&
                            `Publicado a las ${daySavedTimeLabel ?? "--:--"}`}
                          {daySaveState === "clean" && "Sin cambios pendientes de publicación"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-600/70 bg-black/30 px-2.5 py-1 text-[11px] text-slate-200">
                          {dayShortcutKeyLabel} + S publicar
                        </span>
                        <span className="rounded-full border border-slate-600/70 bg-black/30 px-2.5 py-1 text-[11px] text-slate-200">
                          {dayShortcutKeyLabel} + Z deshacer
                        </span>
                        <button
                          type="submit"
                          disabled={isDaySaving || !dayPublishChecklist.requiredReady}
                          className="rounded-md border border-emerald-400/60 bg-emerald-600/85 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {isDaySaving
                            ? "Publicando..."
                            : editingDayId
                              ? "Publicar cambios"
                              : "Publicar Día"}
                        </button>
                      </div>
                    </div>

                    {lastRemovedBlock && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-300/35 bg-amber-500/12 px-2.5 py-2 text-xs text-amber-100">
                        <span>
                          Bloque eliminado. Puedes deshacer dentro de{" "}
                          {Math.round(BLOCK_DELETE_UNDO_WINDOW_MS / 1000)} segundos.
                        </span>
                        <button
                          type="button"
                          onClick={undoRemoveBlock}
                          className="rounded border border-amber-300/50 bg-amber-500/20 px-2 py-1 font-semibold text-amber-100 hover:bg-amber-500/30"
                        >
                          Deshacer eliminación
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-[110px_minmax(0,1fr)]">
                    <div>
                      <label className="text-xs text-gray-400">Dia #</label>
                      <input
                        type="number"
                        value={dayNumber}
                        min={1}
                        onChange={(e) => {
                          setDaySaveError(null);
                          setDayNumber(Number(e.target.value));
                        }}
                        className="w-full p-2 rounded bg-black border border-gray-600"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">
                        Titulo del Dia
                      </label>
                      <input
                        type="text"
                        value={dayTitle}
                        onChange={(e) => {
                          setDaySaveError(null);
                          setDayTitle(e.target.value);
                        }}
                        placeholder="Ej: Introduccion"
                        className="w-full p-2 rounded bg-black border border-gray-600"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400">
                      Prompt de discusión del foro (opcional)
                    </label>
                    <textarea
                      value={dayDiscussionPrompt}
                      onChange={(e) => {
                        setDaySaveError(null);
                        setDayDiscussionPrompt(e.target.value);
                      }}
                      placeholder="Ej: ¿Qué aplicarías mañana de este día y por qué?"
                      rows={3}
                      className="mt-1 w-full rounded bg-black border border-gray-600 p-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Si lo dejas vacío, el foro usará un prompt automático.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[var(--ast-sky)]/30 bg-[rgba(3,11,32,0.72)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">
                        Checklist de publicación
                      </p>
                      <p className="text-xs text-slate-300">
                        Requeridos completados:{" "}
                        <span className="font-semibold text-white">
                          {
                            dayPublishChecklist.checks.filter(
                              (check) => check.required && check.done,
                            ).length
                          }
                        </span>
                        /
                        {
                          dayPublishChecklist.checks.filter((check) => check.required)
                            .length
                        }
                      </p>
                    </div>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {dayPublishChecklist.checks.map((check) => (
                        <div
                          key={check.id}
                          className={`rounded border px-2.5 py-2 text-xs ${
                            check.done
                              ? "border-emerald-300/40 bg-emerald-500/12 text-emerald-100"
                              : check.required
                                ? "border-rose-300/45 bg-rose-500/12 text-rose-100"
                                : "border-slate-500/45 bg-slate-700/20 text-slate-200"
                          }`}
                        >
                          <span className="font-semibold">
                            {check.done ? "Listo" : check.required ? "Pendiente" : "Opcional"}
                          </span>
                          {" · "}
                          {check.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-700 rounded-lg p-4 space-y-4 bg-gray-900/60">
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <p className="text-sm font-semibold tracking-tight text-gray-100">
                        Bloques del día
                        <span className="ml-2 text-xs font-medium text-gray-400">
                          mezcla libre de medios
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => addBlock("text")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Texto
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("video")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Video
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("audio")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Audio
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("image")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Imagen
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("file")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Documento
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("checklist")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Checklist
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("quiz")}
                          className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                        >
                          + Quiz
                        </button>
                        <button
                          type="button"
                          onClick={() => addBlock("challenge_steps")}
                          className="px-3 py-1 text-xs rounded border border-emerald-300/45 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                        >
                          + Reto guiado
                        </button>
                        <button
                          type="button"
                          onClick={consolidateChallengeIntoGuidedBlock}
                          className="px-3 py-1 text-xs rounded border border-emerald-300/40 bg-black/35 text-emerald-100 hover:bg-emerald-500/18"
                        >
                          Consolidar reto en 1 bloque
                        </button>
                        <div className="ml-1 flex items-center gap-1 rounded border border-cyan-400/35 bg-cyan-500/10 px-1.5 py-1">
                          <select
                            value={selectedTemplateId}
                            onChange={(event) => setSelectedTemplateId(event.target.value)}
                            className="rounded border border-cyan-300/30 bg-black/40 px-2 py-1 text-xs text-cyan-100"
                          >
                            {dayBlockTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={applyTemplate}
                            className="rounded border border-cyan-300/55 bg-cyan-500/25 px-2 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/35"
                          >
                            Aplicar plantilla
                          </button>
                        </div>
                        <div className="ml-1 h-5 w-px bg-gray-700" />
                        <button
                          type="button"
                          onClick={undoBlocks}
                          disabled={!canUndoBlocks}
                          className="px-3 py-1 text-xs rounded border border-gray-700 bg-black/40 text-gray-200 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Deshacer (Ctrl/Cmd + Z)"
                        >
                          Deshacer
                        </button>
                        <button
                          type="button"
                          onClick={redoBlocks}
                          disabled={!canRedoBlocks}
                          className="px-3 py-1 text-xs rounded border border-gray-700 bg-black/40 text-gray-200 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Rehacer (Ctrl/Cmd + Y o Cmd + Shift + Z)"
                        >
                          Rehacer
                        </button>
                        <span className="text-[11px] text-gray-400">
                          {dayShortcutKeyLabel} + Z
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowStudentPreview((prev) => !prev)}
                          className="rounded border border-indigo-300/50 bg-indigo-500/18 px-3 py-1 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/28"
                        >
                          {showStudentPreview ? "Ocultar preview" : "Mostrar preview"}
                        </button>
                      </div>
                    </div>

                    <p className="rounded border border-gray-700/80 bg-black/25 px-3 py-2 text-[11px] text-gray-300">
                      Tip: en <span className="text-white font-semibold">Recurso principal</span>,
                      marca un solo bloque como <span className="text-white font-semibold">Principal (ruta)</span>.
                      Ese bloque define el paso 1 y la lógica de avance.
                    </p>

                    <div className="rounded border border-gray-700 bg-black/30 p-2">
                      <p className="mb-2 text-[11px] uppercase tracking-wider text-gray-400">
                        Preset visual del constructor
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDayBlocksViewPreset("all")}
                          className={`rounded px-3 py-1 text-xs font-semibold transition ${
                            dayBlocksViewPreset === "all"
                              ? "border border-white/25 bg-white/12 text-white"
                              : "border border-gray-700 bg-black/40 text-gray-300 hover:border-gray-500"
                          }`}
                        >
                          Todo ({blocks.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDayBlocksViewPreset("resource")}
                          className={`rounded px-3 py-1 text-xs font-semibold transition ${
                            dayBlocksViewPreset === "resource"
                              ? "border border-blue-300/60 bg-blue-500/20 text-blue-100"
                              : "border border-gray-700 bg-black/40 text-gray-300 hover:border-blue-300/45"
                          }`}
                        >
                          Recurso principal ({resourceBlockCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDayBlocksViewPreset("challenge")}
                          className={`rounded px-3 py-1 text-xs font-semibold transition ${
                            dayBlocksViewPreset === "challenge"
                              ? "border border-emerald-300/55 bg-emerald-500/18 text-emerald-100"
                              : "border border-gray-700 bg-black/40 text-gray-300 hover:border-emerald-300/45"
                          }`}
                        >
                          Reto del día ({challengeBlockCount})
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
                      <aside className="space-y-3 rounded-lg border border-cyan-500/28 bg-cyan-500/8 p-2.5">
                        <div className="rounded-lg border border-indigo-400/35 bg-indigo-500/10 p-2.5">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-indigo-100/90">
                            Resumen del lab
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-100">
                            {selectedLabData?.title ?? "Lab sin seleccionar"}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-300/85">
                            {selectedLabData?.description?.trim() ||
                              "Este lab no tiene resumen todavía. Puedes agregarlo en la pestaña Labs > Editar texto."}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/85">
                            Mapa del día
                          </p>
                          <p className="mt-1 text-xs text-slate-300/85">
                            Selecciona un bloque para editarlo en el panel derecho.
                          </p>
                        </div>
                        <div className="space-y-2">
                          {visibleBuilderBlocks.map((item, itemIndex) => {
                            const itemGroup =
                              item.group ?? getDefaultDayBlockGroup(item.type);
                            const itemRole = normalizeBlockRole(item.role, itemGroup);
                            const isActive = activeBuilderBlockId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setFocusedBlockId(item.id)}
                                className={`w-full rounded border px-2.5 py-2 text-left transition ${
                                  isActive
                                    ? "border-cyan-300/65 bg-cyan-500/18 text-cyan-50"
                                    : "border-slate-600/70 bg-black/35 text-slate-200 hover:border-cyan-300/50 hover:bg-cyan-500/12"
                                }`}
                              >
                                <p className="text-[11px] uppercase tracking-wider text-slate-300">
                                  Bloque {itemIndex + 1}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold">
                                  {getBlockTypeLabel(item.type)}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-300/90">
                                  {itemGroup === "resource"
                                    ? "Recurso principal"
                                    : "Reto del día"}
                                  {itemRole === "primary" ? " · Ruta" : ""}
                                </p>
                              </button>
                            );
                          })}
                          {visibleBuilderBlocks.length === 0 && (
                            <p className="rounded border border-dashed border-slate-600 bg-black/30 p-2 text-xs text-slate-300">
                              No hay bloques para este preset.
                            </p>
                          )}
                        </div>
                        {showStudentPreview && activeBuilderBlock && (
                          <div className="rounded-lg border border-indigo-400/35 bg-indigo-500/10 p-2.5">
                            <p className="text-[11px] uppercase tracking-[0.16em] text-indigo-100/90">
                              Preview alumno
                            </p>
                            <p className="mt-1 text-[11px] text-slate-300/85">
                              Así verá este bloque el participante.
                            </p>
                            <div className="mt-2 rounded border border-slate-600/70 bg-[#031330] p-2">
                              {renderStudentBlockPreview(activeBuilderBlock)}
                            </div>
                          </div>
                        )}
                      </aside>

                      <div className="space-y-3">
                    {blocks.map((block, index) => (
                      (() => {
                        const blockGroup = block.group ?? getDefaultDayBlockGroup(block.type);
                        const blockRole = normalizeBlockRole(block.role, blockGroup);
                        const blockResourceSlot = normalizeResourceSlotForBuilder(
                          block.resourceSlot,
                          block.type,
                          blockGroup,
                          blockRole,
                        );
                        const isVisibleInPreset =
                          dayBlocksViewPreset === "all" ||
                          dayBlocksViewPreset === blockGroup;
                        const isVisibleInFocus =
                          !activeBuilderBlockId || activeBuilderBlockId === block.id;
                        if (!isVisibleInPreset || !isVisibleInFocus) return null;

                        return (
                      <div
                        key={block.id}
                        className={`rounded-lg p-3 space-y-3 ${
                          blockGroup === "challenge"
                            ? "border border-emerald-300/45 bg-emerald-500/12"
                            : "border border-blue-300/35 bg-blue-500/10"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] uppercase tracking-wider text-gray-400">
                                Bloque {index + 1}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <p className="text-sm font-semibold text-green-400">
                                  {getBlockTypeLabel(block.type)}
                                </p>
                                {blockGroup === "resource" && blockRole === "primary" && (
                                  <span className="rounded-full border border-amber-300/50 bg-amber-500/18 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                                    Ruta
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className={`px-2 py-1 text-xs rounded border ${
                                  activeBuilderBlockId === block.id
                                    ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-100"
                                    : "border-gray-600 bg-black/35 text-gray-200 hover:border-cyan-300/55"
                                }`}
                                onClick={() => {
                                  setFocusedBlockId(block.id);
                                }}
                                title="Editar este bloque en foco"
                              >
                                {activeBuilderBlockId === block.id ? "Activo" : "Enfocar"}
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
                                onClick={() => moveBlock(index, -1)}
                                disabled={index === 0}
                                title="Mover bloque arriba"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40"
                                onClick={() => moveBlock(index, 1)}
                                disabled={index === blocks.length - 1}
                                title="Mover bloque abajo"
                              >
                                ↓
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                            <label className="text-xs text-gray-400">Sección</label>
                            <select
                              value={blockGroup}
                              onChange={(e) => {
                                const nextGroup = e.target.value as DayBlockGroup;
                                updateBlock(block.id, {
                                  group: nextGroup,
                                  role:
                                    nextGroup === "resource"
                                      ? normalizeBlockRole(block.role, nextGroup)
                                      : "support",
                                  resourceSlot: normalizeResourceSlotForBuilder(
                                    block.resourceSlot,
                                    block.type,
                                    nextGroup,
                                    nextGroup === "resource"
                                      ? normalizeBlockRole(block.role, nextGroup)
                                      : "support",
                                  ),
                                });
                              }}
                              className="rounded border border-gray-700 bg-black px-2 py-1 text-xs text-gray-200"
                            >
                              <option value="resource">Recurso principal</option>
                              <option value="challenge">Reto del día</option>
                            </select>

                            {blockGroup === "resource" && (
                              <>
                                <label className="text-xs text-gray-400">Rol</label>
                                <select
                                  value={blockRole}
                                  onChange={(e) =>
                                    updateBlock(block.id, {
                                      role: e.target.value as DayBlockRole,
                                      resourceSlot: normalizeResourceSlotForBuilder(
                                        block.resourceSlot,
                                        block.type,
                                        blockGroup,
                                        e.target.value as DayBlockRole,
                                      ),
                                    })
                                  }
                                  className="rounded border border-gray-700 bg-black px-2 py-1 text-xs text-gray-200"
                                >
                                  <option value="primary">Principal (ruta)</option>
                                  <option value="support">Soporte</option>
                                </select>
                              </>
                            )}
                          </div>
                          {blockGroup === "resource" && (
                            <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
                              <label className="text-xs text-gray-400">Panel recursos</label>
                              <select
                                value={blockResourceSlot}
                                onChange={(e) =>
                                  updateBlock(block.id, {
                                    resourceSlot: normalizeResourceSlotForBuilder(
                                      e.target.value as DayResourceSlot,
                                      block.type,
                                      blockGroup,
                                      blockRole,
                                    ),
                                  })
                                }
                                className="rounded border border-gray-700 bg-black px-2 py-1 text-xs text-gray-200"
                              >
                                <option value="none">No mostrar</option>
                                {canUseResourceLink(block.type) && (
                                  <option value="link">Liga</option>
                                )}
                                {block.type === "file" && (
                                  <option value="download">Descargable</option>
                                )}
                                {block.type === "text" && (
                                  <option value="text">Texto</option>
                                )}
                                {block.type === "image" && (
                                  <option value="media">Imagen</option>
                                )}
                              </select>
                            </div>
                          )}
                          {blockGroup === "resource" && (
                            <p className="text-[11px] text-gray-400">
                              Principal: aparece como paso 1 en Ruta del día y controla el avance.
                            </p>
                          )}
                        </div>

                        {block.type === "text" && (
                          <RichTextEditor
                            value={block.text ?? ""}
                            onChange={(nextHtml) =>
                              updateBlock(block.id, { text: nextHtml })
                            }
                            placeholder="Escribe la lectura/instrucción..."
                            minHeightClassName="min-h-[150px]"
                            compact
                          />
                        )}

                        {block.type === "challenge_steps" && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                Título del reto (opcional)
                              </p>
                              <RichTextEditor
                                value={block.title ?? ""}
                                onChange={(nextHtml) =>
                                  updateBlock(block.id, { title: nextHtml })
                                }
                                placeholder="Ejemplo: Reto guiado del día"
                                minHeightClassName="min-h-[72px]"
                                compact
                              />
                            </div>

                            <div className="space-y-2">
                              {(block.steps ?? []).map((step, stepIndex) => (
                                <div
                                  key={step.id}
                                  className="rounded border border-emerald-300/35 bg-emerald-500/8 p-2.5 space-y-2"
                                >
                                  <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                                    <p className="text-[11px] uppercase tracking-wide text-emerald-100/80">
                                      Paso {stepIndex + 1}
                                    </p>
                                    <input
                                      type="text"
                                      value={step.label}
                                      onChange={(event) =>
                                        updateChallengeStep(block.id, step.id, {
                                          label: event.target.value,
                                        })
                                      }
                                      placeholder={`Paso ${stepIndex + 1}`}
                                      className="rounded border border-gray-700 bg-black px-2 py-1 text-xs text-gray-100"
                                    />
                                    <button
                                      type="button"
                                      className="px-2 py-1 text-xs rounded bg-red-900/60 hover:bg-red-800"
                                      onClick={() => removeChallengeStep(block.id, step.id)}
                                    >
                                      Quitar
                                    </button>
                                  </div>

                                  <RichTextEditor
                                    value={step.text}
                                    onChange={(nextHtml) =>
                                      updateChallengeStep(block.id, step.id, { text: nextHtml })
                                    }
                                    placeholder={`Contenido del paso ${stepIndex + 1}`}
                                    minHeightClassName="min-h-[92px]"
                                    compact
                                  />
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                              onClick={() => addChallengeStep(block.id)}
                            >
                              + Agregar paso
                            </button>
                          </div>
                        )}

                        {(block.type === "video" ||
                          block.type === "audio" ||
                          block.type === "image" ||
                          block.type === "file") && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="file"
                                accept={getFileAcceptForBlock(block.type)}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  void uploadFileForBlock(block, file);
                                  e.currentTarget.value = "";
                                }}
                                className="text-xs text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-xs file:text-white hover:file:bg-gray-600"
                              />
                              {uploadingBlockId === block.id && (
                                <span className="text-xs text-yellow-300">
                                  Subiendo...
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={block.url ?? ""}
                              onChange={(e) =>
                                updateBlock(block.id, { url: e.target.value })
                              }
                              placeholder="URL del recurso (o se llena al subir archivo)"
                              className="w-full p-2 rounded bg-gray-950 border border-gray-700"
                            />
                            <input
                              type="text"
                              value={block.caption ?? ""}
                              onChange={(e) =>
                                updateBlock(block.id, { caption: e.target.value })
                              }
                              placeholder={
                                block.type === "file"
                                  ? "Nombre del documento (ej. Guía de trabajo)"
                                  : "Titulo opcional"
                              }
                              className="w-full p-2 rounded bg-gray-950 border border-gray-700"
                            />
                          </div>
                        )}

                        {block.type === "checklist" && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                Título del checklist (opcional)
                              </p>
                              <RichTextEditor
                                value={block.title ?? ""}
                                onChange={(nextHtml) =>
                                  updateBlock(block.id, { title: nextHtml })
                                }
                                placeholder="Título del checklist"
                                minHeightClassName="min-h-[72px]"
                                compact
                              />
                            </div>
                            <div className="space-y-2">
                              {(block.items ?? []).map((item, itemIndex) => (
                                <div
                                  key={item.id}
                                  className="rounded border border-gray-700/70 bg-black/30 p-2 space-y-2"
                                >
                                  <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                    Punto {itemIndex + 1}
                                  </p>
                                  <RichTextEditor
                                    value={item.text}
                                    onChange={(nextHtml) =>
                                      updateChecklistItem(block.id, item.id, {
                                        text: nextHtml,
                                      })
                                    }
                                    placeholder={`Contenido del punto ${itemIndex + 1}`}
                                    minHeightClassName="min-h-[86px]"
                                    compact
                                  />
                                  <button
                                    type="button"
                                    className="px-3 py-1 text-xs rounded bg-red-900/60 hover:bg-red-800"
                                    onClick={() => removeChecklistItem(block.id, item.id)}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                                onClick={() => addChecklistItem(block.id)}
                              >
                                + Agregar punto
                              </button>
                            </div>
                          </div>
                        )}

                        {block.type === "quiz" && (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                Título del quiz (opcional)
                              </p>
                              <RichTextEditor
                                value={block.title ?? ""}
                                onChange={(nextHtml) =>
                                  updateBlock(block.id, { title: nextHtml })
                                }
                                placeholder="Título del quiz"
                                minHeightClassName="min-h-[72px]"
                                compact
                              />
                            </div>

                            <div className="space-y-3">
                              {(block.questions ?? []).map((question, questionIndex) => (
                                <div
                                  key={question.id}
                                  className="rounded border border-gray-700 p-3 bg-gray-950/50 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-gray-400">
                                      Pregunta {questionIndex + 1}
                                    </p>
                                    <button
                                      type="button"
                                      className="px-2 py-1 text-xs rounded bg-red-900/60 hover:bg-red-800"
                                      onClick={() =>
                                        removeQuizQuestion(block.id, question.id)
                                      }
                                    >
                                      Eliminar pregunta
                                    </button>
                                  </div>

                                  <div className="space-y-1">
                                    <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                      Enunciado
                                    </p>
                                    <RichTextEditor
                                      value={question.prompt}
                                      onChange={(nextHtml) =>
                                        updateQuizQuestion(block.id, question.id, {
                                          prompt: nextHtml,
                                        })
                                      }
                                      placeholder="Enunciado de la pregunta"
                                      minHeightClassName="min-h-[92px]"
                                      compact
                                    />
                                  </div>

                                  {(question.options ?? []).map((option, optionIndex) => (
                                    <div key={`${question.id}_${optionIndex}`} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={option}
                                        onChange={(e) =>
                                          updateQuizOption(
                                            block.id,
                                            question.id,
                                            optionIndex,
                                            e.target.value,
                                          )
                                        }
                                        placeholder={`Opción ${optionIndex + 1}`}
                                        className="flex-1 p-2 rounded bg-black border border-gray-700"
                                      />
                                      <button
                                        type="button"
                                        className="px-2 py-1 text-xs rounded bg-red-900/60 hover:bg-red-800"
                                        onClick={() =>
                                          removeQuizOption(
                                            block.id,
                                            question.id,
                                            optionIndex,
                                          )
                                        }
                                      >
                                        -
                                      </button>
                                    </div>
                                  ))}

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                                      onClick={() => addQuizOption(block.id, question.id)}
                                    >
                                      + Opción
                                    </button>
                                    <select
                                      value={
                                        typeof question.correctIndex === "number"
                                          ? String(question.correctIndex)
                                          : ""
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value.trim();
                                        updateQuizQuestion(block.id, question.id, {
                                          correctIndex:
                                            value === ""
                                              ? null
                                              : Number.parseInt(value, 10),
                                        });
                                      }}
                                      className="p-2 rounded bg-black border border-gray-700 text-sm"
                                    >
                                      <option value="">Respuesta correcta</option>
                                      {(question.options ?? []).map((_, optionIndex) => (
                                        <option
                                          key={`${question.id}_correct_${optionIndex}`}
                                          value={optionIndex}
                                        >
                                          Opción {optionIndex + 1}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-1">
                                    <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                      Explicación opcional
                                    </p>
                                    <RichTextEditor
                                      value={question.explanation ?? ""}
                                      onChange={(nextHtml) =>
                                        updateQuizQuestion(block.id, question.id, {
                                          explanation: nextHtml,
                                        })
                                      }
                                      placeholder="Explicación opcional al revisar resultados"
                                      minHeightClassName="min-h-[82px]"
                                      compact
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
                              onClick={() => addQuizQuestion(block.id)}
                            >
                              + Agregar pregunta
                            </button>
                          </div>
                        )}

                        <div className="flex justify-end border-t border-gray-700/70 pt-2">
                          {pendingDeleteBlockId === block.id ? (
                            <div className="flex flex-wrap items-center gap-2 rounded border border-red-500/45 bg-red-950/25 px-2.5 py-1.5 text-[11px]">
                              <span className="text-red-100">¿Eliminar este bloque?</span>
                              <button
                                type="button"
                                className="rounded border border-gray-500/60 bg-black/30 px-2 py-1 text-gray-200 hover:border-gray-400"
                                onClick={() => setPendingDeleteBlockId(null)}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="rounded border border-red-500/70 bg-red-700/75 px-2 py-1 font-semibold text-red-50 hover:bg-red-600"
                                onClick={() => removeBlock(block.id)}
                                disabled={blocks.length === 1}
                              >
                                Sí, eliminar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="px-3 py-1 text-xs rounded border border-red-700/70 bg-red-950/45 text-red-200 hover:bg-red-900/55 disabled:opacity-40"
                              onClick={() => setPendingDeleteBlockId(block.id)}
                              disabled={blocks.length === 1}
                            >
                              Eliminar bloque
                            </button>
                          )}
                        </div>
                      </div>
                        );
                      })()
                    ))}

                    {dayBlocksViewPreset !== "all" &&
                      ((dayBlocksViewPreset === "resource" &&
                        resourceBlockCount === 0) ||
                        (dayBlocksViewPreset === "challenge" &&
                          challengeBlockCount === 0)) && (
                        <p className="rounded border border-dashed border-gray-600 bg-black/30 p-3 text-sm text-gray-400">
                          No hay bloques en esta sección todavía.
                        </p>
                      )}
                      </div>
                  </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isDaySaving || !dayPublishChecklist.requiredReady}
                      className="flex-1 rounded bg-green-600 py-2 font-bold transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isDaySaving
                        ? "Publicando..."
                        : editingDayId
                          ? "Publicar cambios"
                          : "Publicar Dia"}
                    </button>
                    {editingDayId && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteDayConfirm((prev) => !prev);
                          setDeleteDayConfirmValue("");
                        }}
                        className="px-4 py-2 rounded font-bold bg-red-700 transition hover:bg-red-600"
                      >
                        Eliminar Dia
                      </button>
                    )}
                  </div>
                  {showDeleteDayConfirm && editingDayId && (
                    <div className="rounded-lg border border-red-400/45 bg-red-950/25 p-3 text-sm text-red-100">
                      <p className="font-semibold">Confirmación de borrado</p>
                      <p className="mt-1 text-xs text-red-100/85">
                        Escribe <span className="font-bold">{dayDeletePhrase}</span> para confirmar.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={deleteDayConfirmValue}
                          onChange={(event) => setDeleteDayConfirmValue(event.target.value)}
                          placeholder={dayDeletePhrase}
                          className="min-w-[240px] flex-1 rounded border border-red-300/45 bg-black/35 px-2 py-1 text-sm text-white"
                        />
                        <button
                          type="button"
                          onClick={() => void deleteDay()}
                          disabled={
                            deleteDayConfirmValue.trim() !== dayDeletePhrase || isDeletingDay
                          }
                          className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {isDeletingDay ? "Eliminando..." : "Confirmar eliminación"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteDayConfirm(false);
                            setDeleteDayConfirmValue("");
                          }}
                          className="rounded border border-gray-500/70 bg-black/25 px-3 py-1.5 text-xs text-gray-200 hover:border-gray-400"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  {dayMsg && (
                    <p className="text-center text-yellow-300 mt-2">{dayMsg}</p>
                  )}
                </form>
              )}
            </div>
          </div>
          </section>
        )}

        {activeTab === "comments" && (
          <section className="rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(9,18,44,0.96),rgba(4,11,30,0.96))] p-6 shadow-[0_18px_36px_rgba(1,7,22,0.5)]">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-amber-200">
            4. Moderacion de Comentarios
          </h2>
          {!selectedLab ? (
            <p className="text-gray-400">
              Selecciona un lab para moderar comentarios.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div>
                  <label className="text-xs text-gray-400">Filtrar por dia</label>
                  <input
                    type="number"
                    min={1}
                    value={commentDayFilter}
                    onChange={(e) => setCommentDayFilter(e.target.value)}
                    placeholder="Todos"
                    className="w-32 p-2 rounded bg-black border border-gray-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCommentsRefreshTick((prev) => prev + 1)}
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                >
                  Refrescar
                </button>
              </div>

              {commentsMsg && <p className="text-yellow-300">{commentsMsg}</p>}
              {comments.length === 0 ? (
                <p className="text-gray-400">No hay comentarios en este filtro.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-auto pr-1">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border border-gray-700 rounded p-3 bg-black/40"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <p className="text-xs text-gray-400">
                            Dia {comment.day_number} • {comment.user_email ?? "Sin correo"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteComment(comment.id)}
                          className="px-3 py-1 rounded bg-red-900/60 hover:bg-red-800 text-xs"
                        >
                          Borrar
                        </button>
                      </div>
                      <p className="text-sm text-gray-200 mt-2 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </section>
        )}

        {activeTab === "users" && (
          <section className="rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(9,18,44,0.96),rgba(4,11,30,0.96))] p-6 shadow-[0_18px_36px_rgba(1,7,22,0.5)]">
          <h2 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-cyan-200">
            5. Gestión de Usuarios
          </h2>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="min-w-64">
                <label className="text-xs text-gray-400">Buscar por correo</label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="usuario@correo.com"
                  className="w-full p-2 rounded bg-black border border-gray-600"
                />
              </div>
              <button
                type="button"
                onClick={() => setUserMgmtRefreshTick((prev) => prev + 1)}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm"
              >
                Refrescar usuarios
              </button>
              {userMgmtMsg && <p className="text-sm text-yellow-300">{userMgmtMsg}</p>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="border border-gray-700 rounded-lg p-3 max-h-96 overflow-auto space-y-2">
                {managedUsers.map((managedUser) => (
                  <button
                    key={managedUser.id}
                    type="button"
                    onClick={() => setSelectedManagedUserId(managedUser.id)}
                    className={`w-full text-left rounded p-2 border transition ${selectedManagedUserId === managedUser.id ? "bg-cyan-950/30 border-cyan-500" : "bg-black/30 border-gray-700 hover:border-gray-500"}`}
                  >
                    <p className="text-sm font-semibold text-gray-100 truncate">
                      {managedUser.email ?? "Sin correo"}
                    </p>
                    <p className="text-xs text-gray-400">
                      Rol: {managedUser.role} • Labs activos: {managedUser.active_labs}
                    </p>
                  </button>
                ))}
                {managedUsers.length === 0 && (
                  <p className="text-sm text-gray-400">No hay usuarios para mostrar.</p>
                )}
              </div>

              <div className="lg:col-span-2 border border-gray-700 rounded-lg p-4 space-y-4">
                {!selectedManagedUserId ? (
                  <p className="text-gray-400">Selecciona un usuario para gestionar.</p>
                ) : (
                  <>
                    <div className="rounded border border-gray-700 p-3 bg-black/30">
                      <h3 className="text-sm font-bold text-cyan-200 mb-2">
                        Información del usuario
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <p className="text-gray-300">
                          <span className="text-gray-500">Correo:</span>{" "}
                          {selectedManagedUser?.email ?? "Sin correo"}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-500">Rol:</span>{" "}
                          {selectedManagedUser?.role ?? "student"}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-500">Creado:</span>{" "}
                          {selectedManagedUser?.created_at
                            ? new Date(selectedManagedUser.created_at).toLocaleString()
                            : "N/D"}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-500">Último login:</span>{" "}
                          {selectedManagedUser?.last_sign_in_at
                            ? new Date(selectedManagedUser.last_sign_in_at).toLocaleString()
                            : "N/D"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded border border-gray-700 p-3 bg-black/30">
                        <p className="text-xs text-gray-400">Labs activos</p>
                        <p className="text-2xl font-black">
                          {entitlementLabs.filter((lab) => lab.hasAccess).length}
                        </p>
                      </div>
                      <div className="rounded border border-gray-700 p-3 bg-black/30">
                        <p className="text-xs text-gray-400">Progresos registrados</p>
                        <p className="text-2xl font-black">
                          {activitySummary?.progress_count ?? 0}
                        </p>
                      </div>
                      <div className="rounded border border-gray-700 p-3 bg-black/30">
                        <p className="text-xs text-gray-400">Comentarios recientes</p>
                        <p className="text-2xl font-black">
                          {activitySummary?.comments_count ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="border border-gray-700 rounded p-3">
                      <h3 className="text-sm font-bold text-cyan-200 mb-2">
                        Accesos a Labs
                      </h3>
                      <div className="space-y-2 max-h-52 overflow-auto pr-1">
                        {entitlementLabs.map((lab) => (
                          <div
                            key={lab.id}
                            className="flex items-center justify-between gap-3 rounded border border-gray-700 p-2 bg-black/30"
                          >
                            <div>
                              <p className="text-sm text-gray-100">{lab.title}</p>
                              <p className="text-xs text-gray-500">
                                Estado: {lab.status}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void toggleUserLabAccess(lab.id, !lab.hasAccess)}
                              className={`text-xs px-3 py-1 rounded ${lab.hasAccess ? "bg-red-900/60 hover:bg-red-800" : "bg-emerald-800 hover:bg-emerald-700"}`}
                            >
                              {lab.hasAccess ? "Revocar" : "Conceder"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-gray-700 rounded p-3">
                      <h3 className="text-sm font-bold text-cyan-200 mb-2">
                        Actividad (comentarios/progreso)
                      </h3>
                      <div className="space-y-2 max-h-52 overflow-auto pr-1">
                        {activityItems.map((item, index) => (
                          <div
                            key={`${item.type}-${item.lab_id}-${item.day_number ?? 0}-${index}`}
                            className="rounded border border-gray-700 p-2 bg-black/30"
                          >
                            <p className="text-xs text-gray-400">
                              {item.type === "comment" ? "Comentario" : "Progreso"} •{" "}
                              {item.lab_title} • Día {item.day_number ?? "-"}
                            </p>
                            {item.content && (
                              <p className="text-sm text-gray-200 line-clamp-2 mt-1">
                                {item.content}
                              </p>
                            )}
                            {item.created_at && (
                              <p className="text-[11px] text-gray-500 mt-1">
                                {new Date(item.created_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ))}
                        {activityItems.length === 0 && (
                          <p className="text-sm text-gray-400">
                            Sin actividad registrada.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          </section>
        )}

        {activeTab === "commerce" && (
          <section className="space-y-6 rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(9,18,44,0.96),rgba(4,11,30,0.96))] p-6 shadow-[0_18px_36px_rgba(1,7,22,0.5)]">
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-emerald-200">
              6. Comercial: Precios y Cupones
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded border border-gray-700 p-4 bg-black/30 space-y-3">
                <h3 className="font-semibold text-emerald-200">Configurar precios por lab</h3>
                <div>
                  <label className="text-xs text-gray-400">Lab</label>
                  <select
                    value={selectedLab ?? ""}
                    onChange={(e) => handleSelectLab(e.target.value)}
                    className="w-full p-2 rounded bg-black border border-gray-600"
                  >
                    <option value="" disabled>
                      Selecciona un lab
                    </option>
                    {labs.map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.title}
                      </option>
                    ))}
                  </select>
                </div>
                <form onSubmit={savePrice} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value as "USD" | "MXN")}
                    className="p-2 rounded bg-black border border-gray-600"
                  >
                    <option value="USD">USD</option>
                    <option value="MXN">MXN</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="Monto"
                    className="p-2 rounded bg-black border border-gray-600"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-sm font-bold"
                  >
                    Guardar precio
                  </button>
                </form>

                <div className="space-y-2">
                  {(labPrices ?? []).map((price) => (
                    <div
                      key={price.id}
                      className="rounded border border-gray-700 p-2 bg-black/30 text-sm flex justify-between"
                    >
                      <span>{price.currency}</span>
                      <span>{formatMoney(price.amount_cents, price.currency)}</span>
                    </div>
                  ))}
                  {labPrices.length === 0 && (
                    <p className="text-sm text-gray-400">Sin precios configurados para este lab.</p>
                  )}
                </div>
              </div>

              <div className="rounded border border-gray-700 p-4 bg-black/30 space-y-3">
                <h3 className="font-semibold text-emerald-200">Crear cupón</h3>
                <form onSubmit={createCoupon} className="space-y-3">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Código (ej: ASTRO20)"
                    className="w-full p-2 rounded bg-black border border-gray-600"
                    required
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={couponType}
                      onChange={(e) =>
                        setCouponType(e.target.value as "percent" | "fixed")
                      }
                      className="p-2 rounded bg-black border border-gray-600"
                    >
                      <option value="percent">% Porcentaje</option>
                      <option value="fixed">Monto fijo</option>
                    </select>
                    <select
                      value={couponScope}
                      onChange={(e) => setCouponScope(e.target.value as "all" | "lab")}
                      className="p-2 rounded bg-black border border-gray-600"
                    >
                      <option value="all">Aplica a todos</option>
                      <option value="lab">Solo un lab</option>
                    </select>
                  </div>

                  {couponType === "percent" ? (
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={couponPercent}
                      onChange={(e) => setCouponPercent(e.target.value)}
                      placeholder="Porcentaje (1-100)"
                      className="w-full p-2 rounded bg-black border border-gray-600"
                      required
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={couponAmount}
                        onChange={(e) => setCouponAmount(e.target.value)}
                        placeholder="Monto descuento"
                        className="p-2 rounded bg-black border border-gray-600"
                        required
                      />
                      <select
                        value={couponCurrency}
                        onChange={(e) =>
                          setCouponCurrency(e.target.value as "USD" | "MXN")
                        }
                        className="p-2 rounded bg-black border border-gray-600"
                      >
                        <option value="USD">USD</option>
                        <option value="MXN">MXN</option>
                      </select>
                    </div>
                  )}

                  {couponScope === "lab" && (
                    <select
                      value={couponLabId || selectedLab || ""}
                      onChange={(e) => setCouponLabId(e.target.value)}
                      className="w-full p-2 rounded bg-black border border-gray-600"
                      required
                    >
                      <option value="" disabled>
                        Selecciona lab del cupón
                      </option>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.title}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="datetime-local"
                    value={couponExpiresAt}
                    onChange={(e) => setCouponExpiresAt(e.target.value)}
                    className="w-full p-2 rounded bg-black border border-gray-600"
                  />

                  <button
                    type="submit"
                    className="w-full px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-sm font-bold"
                  >
                    Crear cupón
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded border border-gray-700 p-4 bg-black/30">
              <h3 className="font-semibold text-emerald-200 mb-3">Cupones existentes</h3>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="rounded border border-gray-700 p-3 bg-black/30 flex items-start justify-between gap-3"
                  >
                    <div className="text-sm">
                      <p className="font-semibold text-gray-100">{coupon.code}</p>
                      <p className="text-xs text-gray-400">
                        {coupon.discount_type === "percent"
                          ? `${coupon.percent_off ?? 0}%`
                          : `${formatMoney(coupon.amount_off_cents ?? 0, coupon.currency ?? "USD")} fijo`}
                        {" · "}
                        {coupon.lab_id ? "Lab específico" : "Global"}
                        {" · "}
                        {coupon.is_active ? "Activo" : "Inactivo"}
                      </p>
                      {coupon.expires_at && (
                        <p className="text-[11px] text-gray-500">
                          Expira: {new Date(coupon.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleCouponActive(coupon.id, !coupon.is_active)}
                      className={`px-3 py-1 text-xs rounded ${
                        coupon.is_active
                          ? "bg-red-900/70 hover:bg-red-800"
                          : "bg-emerald-800 hover:bg-emerald-700"
                      }`}
                    >
                      {coupon.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                ))}
                {coupons.length === 0 && (
                  <p className="text-sm text-gray-400">No hay cupones todavía.</p>
                )}
              </div>
            </div>

            {pricingMsg && <p className="text-sm text-yellow-300">{pricingMsg}</p>}
          </section>
        )}
      </div>
    </div>
  );
}

function buildDayDraftSignature(input: {
  dayNumber: number;
  dayTitle: string;
  dayDiscussionPrompt: string;
  blocks: DayBlock[];
}): string {
  return JSON.stringify({
    dayNumber: input.dayNumber,
    dayTitle: input.dayTitle.trim(),
    dayDiscussionPrompt: input.dayDiscussionPrompt.trim(),
    blocks: input.blocks,
  });
}

function getCurrentTimestamp(): number {
  return Date.now();
}

function normalizeDayBlocksForSave(blocks: DayBlock[]): DayBlock[] {
  return blocks
    .map((block) => {
      const group: DayBlockGroup = block.group ?? getDefaultDayBlockGroup(block.type);
      const role: DayBlockRole = normalizeBlockRole(block.role, group);

      if (block.type === "text") {
        const normalizedText = normalizeRichTextInput(block.text ?? "");
        return {
          ...block,
          group,
          role,
          text: normalizedText,
        };
      }

      if (block.type === "checklist") {
        const items = (block.items ?? [])
          .map((item) => ({
            id: item.id,
            text: normalizeRichTextInput(item.text ?? ""),
          }))
          .filter((item) => hasRichTextContent(item.text));

        return {
          ...block,
          group,
          role,
          title: normalizeRichTextInput(block.title ?? ""),
          items,
        };
      }

      if (block.type === "quiz") {
        const questions = (block.questions ?? [])
          .map((question) => {
            const options = (question.options ?? [])
              .map((option) => option.trim())
              .filter(Boolean);

            const hasValidCorrect =
              typeof question.correctIndex === "number" &&
              question.correctIndex >= 0 &&
              question.correctIndex < options.length;

            return {
              id: question.id,
              prompt: normalizeRichTextInput(question.prompt ?? ""),
              options,
              correctIndex: hasValidCorrect ? question.correctIndex : null,
              explanation: normalizeRichTextInput(question.explanation ?? ""),
            };
          })
          .filter((question) => hasRichTextContent(question.prompt) && question.options.length >= 2);

        return {
          ...block,
          group,
          role,
          title: normalizeRichTextInput(block.title ?? ""),
          questions,
        };
      }

      if (block.type === "challenge_steps") {
        const steps = (block.steps ?? [])
          .map((step, index) => ({
            id: step.id,
            label: step.label?.trim() || `Paso ${index + 1}`,
            text: normalizeRichTextInput(step.text ?? ""),
          }))
          .filter((step) => hasRichTextContent(step.text));

        return {
          ...block,
          group,
          role,
          title: normalizeRichTextInput(block.title ?? ""),
          steps,
        };
      }

      return {
        ...block,
        group,
        role,
        url: block.url?.trim() ?? "",
        caption: block.caption?.trim() ?? "",
      };
    })
    .filter((block) => {
      if (block.type === "text") return hasRichTextContent(block.text ?? "");
      if (block.type === "checklist") return (block.items?.length ?? 0) > 0;
      if (block.type === "quiz") return (block.questions?.length ?? 0) > 0;
      if (block.type === "challenge_steps") return (block.steps?.length ?? 0) > 0;
      return Boolean(block.url);
    });
}

function buildDayPublishChecklist(
  dayTitle: string,
  dayDiscussionPrompt: string,
  blocks: DayBlock[],
): DayPublishChecklist {
  const normalizedBlocks = normalizeDayBlocksForSave(blocks);
  const resourceBlocks = normalizedBlocks.filter(
    (block) => (block.group ?? getDefaultDayBlockGroup(block.type)) === "resource",
  );
  const challengeBlocks = normalizedBlocks.filter(
    (block) => (block.group ?? getDefaultDayBlockGroup(block.type)) === "challenge",
  );
  const hasExplicitPrimary = resourceBlocks.some((block) => block.role === "primary");

  const checks: DayPublishCheck[] = [
    {
      id: "title",
      label: "Título del día definido",
      done: dayTitle.trim().length > 0,
      required: true,
    },
    {
      id: "content",
      label: "Al menos 1 bloque con contenido",
      done: normalizedBlocks.length > 0,
      required: true,
    },
    {
      id: "resource",
      label: "Incluye bloque en Recurso principal",
      done: resourceBlocks.length > 0,
      required: true,
    },
    {
      id: "primary",
      label: "Marca el bloque principal (ruta)",
      done: hasExplicitPrimary,
      required: false,
    },
    {
      id: "challenge",
      label: "Incluye bloque en Reto del día",
      done: challengeBlocks.length > 0,
      required: false,
    },
    {
      id: "forum_prompt",
      label: "Prompt del foro personalizado",
      done: dayDiscussionPrompt.trim().length > 0,
      required: false,
    },
  ];

  return {
    checks,
    requiredReady: checks.filter((check) => check.required).every((check) => check.done),
    normalizedBlocks,
    resourceBlocksCount: resourceBlocks.length,
    challengeBlocksCount: challengeBlocks.length,
  };
}

function createVideoTextChallengeTemplateBlocks(): DayBlock[] {
  const primaryVideo = createBlock("video");
  const supportText = createBlock("text");
  const challengeGuide = createBlock("challenge_steps");

  primaryVideo.group = "resource";
  primaryVideo.role = "primary";
  primaryVideo.url = "";
  primaryVideo.caption = "Título o referencia del recurso principal";

  supportText.group = "resource";
  supportText.role = "support";
  supportText.text =
    "<p><strong>Objetivo del día:</strong> [define aquí el objetivo].</p><p><strong>Contexto:</strong> [explica por qué este recurso importa].</p>";

  if (challengeGuide.type === "challenge_steps") {
    challengeGuide.group = "challenge";
    challengeGuide.role = "support";
    challengeGuide.title = "Reto del día";
    challengeGuide.steps = [
      createChallengeStep(
        "Paso 1",
        "<p>Define la situación real que quieres resolver hoy.</p>",
      ),
      createChallengeStep(
        "Paso 2",
        "<p>Aplica el prompt o marco del día con contexto específico.</p>",
      ),
      createChallengeStep(
        "Paso 3",
        "<p>Publica tu resultado y qué cambió respecto a tu versión inicial.</p>",
      ),
    ];
  }

  return [primaryVideo, supportText, challengeGuide];
}

function createReadingQuizTemplateBlocks(): DayBlock[] {
  const principalReading = createBlock("text");
  const supportFile = createBlock("file");
  const challengeQuiz = createBlock("quiz");

  principalReading.group = "resource";
  principalReading.role = "primary";
  principalReading.text =
    "<h3>Lectura base</h3><p>[Escribe aquí la lectura o instrucciones principales del día].</p>";

  supportFile.group = "resource";
  supportFile.role = "support";
  supportFile.caption = "Recurso descargable (opcional)";
  supportFile.url = "";

  if (challengeQuiz.type === "quiz") {
    challengeQuiz.group = "challenge";
    challengeQuiz.title = "Verificación del día";
    challengeQuiz.questions = [
      {
        id: createQuizQuestion().id,
        prompt: "Pregunta 1: [escribe la pregunta]",
        options: ["Opción A", "Opción B", "Opción C"],
        correctIndex: 0,
        explanation: "Explicación opcional para retroalimentación.",
      },
    ];
  }

  return [principalReading, supportFile, challengeQuiz];
}

function createMediaChecklistTemplateBlocks(): DayBlock[] {
  const primaryMedia = createBlock("video");
  const guideText = createBlock("text");
  const challengeGuide = createBlock("challenge_steps");

  primaryMedia.group = "resource";
  primaryMedia.role = "primary";
  primaryMedia.url = "";
  primaryMedia.caption = "Recurso audiovisual principal";

  guideText.group = "resource";
  guideText.role = "support";
  guideText.text =
    "<p><strong>Guía rápida:</strong> [pasos o contexto clave para el alumno].</p>";

  if (challengeGuide.type === "challenge_steps") {
    challengeGuide.group = "challenge";
    challengeGuide.role = "support";
    challengeGuide.title = "Pasos de la actividad";
    challengeGuide.steps = [
      createChallengeStep("Paso 1", "<p>Observa el recurso y detecta un patrón clave.</p>"),
      createChallengeStep("Paso 2", "<p>Replica el patrón con tu propio caso real.</p>"),
      createChallengeStep("Paso 3", "<p>Comparte resultado y aprendizaje en el foro.</p>"),
    ];
  }

  return [primaryMedia, guideText, challengeGuide];
}

function renderStudentBlockPreview(block: DayBlock) {
  if (block.type === "text") {
    const html = sanitizeRichText(block.text ?? "");
    if (!hasRichTextContent(html)) {
      return <p className="text-xs text-slate-400">Este bloque aún no tiene contenido.</p>;
    }
    return (
      <div
        className="prose prose-invert max-w-none text-xs leading-relaxed [&_p]:my-2 [&_h3]:my-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (block.type === "checklist") {
    const items = (block.items ?? []).filter((item) => hasRichTextContent(item.text));
    const checklistTitle = sanitizeRichText(block.title ?? "");
    return (
      <div className="space-y-2 text-xs">
        {hasRichTextContent(checklistTitle) && (
          <div
            className="font-semibold text-emerald-100 [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: checklistTitle }}
          />
        )}
        {items.length > 0 ? (
          <ul className="space-y-1 text-slate-200">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="flex items-start gap-1.5">
                <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <div
                  className="[&_p]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(item.text) }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">Agrega puntos al checklist para previsualizar.</p>
        )}
      </div>
    );
  }

  if (block.type === "quiz") {
    const question = (block.questions ?? []).find((item) => hasRichTextContent(item.prompt));
    if (!question) {
      return <p className="text-xs text-slate-400">Agrega al menos una pregunta.</p>;
    }
    const quizTitle = sanitizeRichText(block.title ?? "");
    const questionPrompt = sanitizeRichText(question.prompt ?? "");
    return (
      <div className="space-y-2 text-xs">
        {hasRichTextContent(quizTitle) && (
          <div
            className="font-semibold text-cyan-100 [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: quizTitle }}
          />
        )}
        <div
          className="font-medium text-slate-100 [&_p]:my-0.5"
          dangerouslySetInnerHTML={{ __html: questionPrompt }}
        />
        <ol className="space-y-1 text-slate-300">
          {question.options.filter(Boolean).slice(0, 4).map((option, index) => (
            <li key={`${question.id}_${index}`}>{index + 1}. {option}</li>
          ))}
        </ol>
      </div>
    );
  }

  if (block.type === "challenge_steps") {
    const steps = (block.steps ?? []).filter((step) => hasRichTextContent(step.text));
    const title = sanitizeRichText(block.title ?? "");
    return (
      <div className="space-y-2 text-xs">
        {hasRichTextContent(title) && (
          <div
            className="font-semibold text-emerald-100 [&_p]:my-0.5"
            dangerouslySetInnerHTML={{ __html: title }}
          />
        )}
        {steps.length > 0 ? (
          <div className="space-y-1.5">
            {steps.slice(0, 4).map((step, index) => (
              <div
                key={step.id}
                className="rounded border border-emerald-300/35 bg-emerald-500/8 px-2 py-1.5"
              >
                <p className="text-[10px] uppercase tracking-wider text-emerald-200/90">
                  {step.label?.trim() || `Paso ${index + 1}`}
                </p>
                <div
                  className="mt-1 text-slate-200 [&_p]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(step.text ?? "") }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">Agrega al menos un paso para previsualizar.</p>
        )}
      </div>
    );
  }

  if (block.type === "video") {
    const youtubeId = extractYouTubeVideoId(block.url);
    if (youtubeId) {
      return (
        <div className="space-y-2">
          <iframe
            className="h-32 w-full rounded border border-slate-600/80"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="Preview video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          {block.caption && <p className="text-xs text-slate-300">{block.caption}</p>}
        </div>
      );
    }
  }

  if (block.url?.trim()) {
    return (
      <div className="space-y-1 text-xs">
        <p className="font-medium text-slate-100">{block.caption || getBlockTypeLabel(block.type)}</p>
        <a
          href={block.url}
          target="_blank"
          rel="noreferrer"
          className="break-all text-cyan-200 underline hover:text-cyan-100"
        >
          {block.url}
        </a>
      </div>
    );
  }

  return <p className="text-xs text-slate-400">Carga archivo o URL para ver la vista previa.</p>;
}

function normalizeBlockRole(
  role: DayBlockRole | undefined,
  group: DayBlockGroup,
): DayBlockRole {
  if (group === "challenge") return "support";
  return role === "primary" ? "primary" : "support";
}

function normalizeResourceSlotForBuilder(
  slot: DayResourceSlot | undefined,
  type: DayBlockType,
  group: DayBlockGroup,
  role: DayBlockRole,
): DayResourceSlot {
  if (group !== "resource" || role === "primary") return "none";

  if (slot === "text") return type === "text" ? "text" : "none";
  if (slot === "download") return type === "file" ? "download" : "none";
  if (slot === "media") return type === "image" ? "media" : "none";
  if (slot === "link") return canUseResourceLink(type) ? "link" : "none";
  return "none";
}

function canUseResourceLink(type: DayBlockType): boolean {
  return type === "video" || type === "audio" || type === "image" || type === "file";
}

function cloneDayBlocks(blocks: DayBlock[]): DayBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as DayBlock[];
}

function getBlocksSignature(blocks: DayBlock[]): string {
  return JSON.stringify(blocks);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, [contenteditable='true'], [contenteditable=''], [role='textbox']",
    ),
  );
}

function ensurePrimaryResourceBlock(blocks: DayBlock[]): DayBlock[] {
  const resourceIndexes = blocks
    .map((block, index) =>
      (block.group ?? getDefaultDayBlockGroup(block.type)) === "resource" ? index : -1,
    )
    .filter((index) => index >= 0);

  if (resourceIndexes.length === 0) return blocks;

  const existingPrimaryIndex = blocks.findIndex(
    (block) =>
      (block.group ?? getDefaultDayBlockGroup(block.type)) === "resource" &&
      block.role === "primary",
  );
  const selectedPrimaryIndex =
    existingPrimaryIndex >= 0 ? existingPrimaryIndex : resourceIndexes[0];

  return blocks.map((block, index) => {
    const group = block.group ?? getDefaultDayBlockGroup(block.type);
    const nextRole = normalizeBlockRole(
      index === selectedPrimaryIndex ? "primary" : "support",
      group,
    );
    if (block.role === nextRole) return block;
    return { ...block, role: nextRole };
  });
}

function getBlockTypeLabel(type: DayBlockType): string {
  if (type === "text") return "Texto";
  if (type === "video") return "Video";
  if (type === "audio") return "Audio";
  if (type === "image") return "Imagen";
  if (type === "file") return "Documento";
  if (type === "checklist") return "Checklist";
  if (type === "quiz") return "Quiz";
  if (type === "challenge_steps") return "Reto guiado";
  return type;
}

function getNextDayNumber(days: AdminDay[]): number {
  if (days.length === 0) return 1;
  const maxDay = Math.max(...days.map((day) => day.day_number));
  return Number.isFinite(maxDay) ? maxDay + 1 : 1;
}

function formatMoney(amountCents: number, currency: "USD" | "MXN" | string) {
  const safeAmount = Number.isFinite(amountCents) ? amountCents : 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "MXN",
  }).format(safeAmount / 100);
}

function getFileAcceptForBlock(type: DayBlockType): string {
  if (type === "video") return "video/*";
  if (type === "audio") return "audio/*";
  if (type === "image") return "image/*";
  if (type === "file") return ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip";
  return "*/*";
}

function normalizeLabels(labels: string[] | null | undefined): string[] {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => (typeof label === "string" ? label.trim().toUpperCase() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function formatLabelsForInput(labels: string[] | null | undefined): string {
  return normalizeLabels(labels).join(", ");
}

function parseLabelsInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

function isMissingLabelsColumnError(message: string): boolean {
  return isMissingColumnError(message, "labels");
}

function isMissingLabMetaColumnsError(message: string): boolean {
  return (
    isMissingColumnError(message, "slug") ||
    isMissingColumnError(message, "cover_image_url") ||
    isMissingColumnError(message, "accent_color")
  );
}

function isDuplicateSlugError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate key") &&
    (lower.includes("slug") || lower.includes("labs_slug"))
  );
}
