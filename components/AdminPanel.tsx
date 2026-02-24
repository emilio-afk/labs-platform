"use client";

import { createClient } from "@/utils/supabase/client";
import {
  createBlock,
  createChecklistItem,
  createQuizQuestion,
  parseDayBlocks,
  parseDayDiscussionPrompt,
  serializeDayBlocks,
  getDefaultDayBlockGroup,
  type DayBlock,
  type DayChecklistItem,
  type DayQuizQuestion,
  type DayBlockGroup,
  type DayBlockRole,
  type DayBlockType,
} from "@/utils/dayBlocks";
import {
  hasRichTextContent,
  normalizeRichTextInput,
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
  const [dayNumber, setDayNumber] = useState(1);
  const [dayTitle, setDayTitle] = useState("");
  const [dayDiscussionPrompt, setDayDiscussionPrompt] = useState("");
  const [blocks, setBlocks] = useState<DayBlock[]>([createBlock("text")]);
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

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const clearBlockHistory = useCallback(() => {
    setBlockUndoPast([]);
    setBlockUndoFuture([]);
  }, []);

  const commitBlocks = useCallback(
    (
      updater: DayBlock[] | ((prev: DayBlock[]) => DayBlock[]),
      options?: { skipHistory?: boolean },
    ) => {
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
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
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
    if (!selectedLab) return;
    setDayMsg("Guardando dia...");

    const normalizedBlocks = blocks
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
              text: item.text.trim(),
            }))
            .filter((item) => Boolean(item.text));

          return {
            ...block,
            group,
            role,
            title: block.title?.trim() ?? "",
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
                prompt: question.prompt.trim(),
                options,
                correctIndex: hasValidCorrect ? question.correctIndex : null,
                explanation: question.explanation?.trim() ?? "",
              };
            })
            .filter(
              (question) => Boolean(question.prompt) && question.options.length >= 2,
            );

          return {
            ...block,
            group,
            role,
            title: block.title?.trim() ?? "",
            questions,
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
        return Boolean(block.url);
      });

    const effectiveBlocks = ensurePrimaryResourceBlock(normalizedBlocks);

    if (effectiveBlocks.length === 0) {
      setDayMsg("Agrega al menos un bloque con contenido.");
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
      return;
    }

    if (editingDayId) {
      setDayMsg("Dia actualizado correctamente");
    } else {
      setDayMsg("Dia guardado correctamente");
      setDayTitle("");
      setDayDiscussionPrompt("");
      commitBlocks([createBlock("text")], { skipHistory: true });
      clearBlockHistory();
      setDayNumber((prev) => prev + 1);
    }

    setDaysRefreshTick((prev) => prev + 1);
  };

  const startCreateDay = () => {
    setEditingDayId(null);
    setDayMsg("");
    setDayTitle("");
    setDayDiscussionPrompt("");
    commitBlocks([createBlock("text")], { skipHistory: true });
    clearBlockHistory();
    setDayBlocksViewPreset("all");
    setDayNumber(getNextDayNumber(days));
  };

  const startEditDay = (day: AdminDay) => {
    setEditingDayId(day.id);
    setDayNumber(day.day_number);
    setDayTitle(day.title);
    setDayDiscussionPrompt(parseDayDiscussionPrompt(day.content));
    const parsedBlocks = parseDayBlocks(day.content, day.video_url);
    commitBlocks(parsedBlocks.length > 0 ? parsedBlocks : [createBlock("text")], {
      skipHistory: true,
    });
    clearBlockHistory();
    setDayBlocksViewPreset("all");
    setDayMsg(`Editando dia ${day.day_number}`);
  };

  const addBlock = (type: DayBlockType) => {
    commitBlocks((prev) => [...prev, createBlock(type)]);
  };

  const uploadFileForBlock = async (block: DayBlock, file: File) => {
    if (!selectedLab) return;
    if (block.type === "text" || block.type === "checklist" || block.type === "quiz") {
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

  const removeBlock = (id: string) => {
    commitBlocks((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((block) => block.id !== id);
    });
  };

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
    if (!editingDayId) return;

    const targetDay = days.find((day) => day.id === editingDayId);
    if (!targetDay) return;

    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar el Dia ${targetDay.day_number}: "${targetDay.title}"?`,
    );
    if (!confirmed) return;

    setDayMsg("Eliminando dia...");

    const { error } = await supabase.from("days").delete().eq("id", editingDayId);
    if (error) {
      setDayMsg("Error al eliminar: " + error.message);
      return;
    }

    const nextDays = days.filter((day) => day.id !== editingDayId);
    setDays(nextDays);
    setEditingDayId(null);
    setDayTitle("");
    setDayDiscussionPrompt("");
    commitBlocks([createBlock("text")], { skipHistory: true });
    clearBlockHistory();
    setDayNumber(getNextDayNumber(nextDays));
    setDayMsg(`Dia ${targetDay.day_number} eliminado`);
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
    setSelectedLab(labId);
    setCouponLabId(labId);
    setEditingDayId(null);
    setDayMsg("");
    setDayTitle("");
    setDayDiscussionPrompt("");
    commitBlocks([createBlock("text")], { skipHistory: true });
    clearBlockHistory();
    setDayNumber(1);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6 xl:p-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-10">
        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-green-400">Panel de Admin</h1>
          <div className="space-x-4">
            <button
              onClick={() => router.push("/")}
              className="text-gray-400 hover:text-white"
            >
              Ir al Inicio
            </button>
            <button onClick={handleLogout} className="text-red-400">
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
              className={`px-3 py-1 rounded transition ${
                activeTab === tab.key
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "hero" && (
          <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-blue-400">
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
          <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-blue-400">
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_140px]">
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
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-white font-bold"
            >
              Crear Lab
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
                              disabled={savingLabMetaId === lab.id}
                              className="rounded-md border border-emerald-500/70 bg-emerald-900/45 px-2.5 py-1 text-[11px] font-medium leading-4 text-emerald-100 transition hover:bg-emerald-800/55 disabled:opacity-50"
                            >
                              {savingLabMetaId === lab.id ? "Guardando..." : "Guardar"}
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
          <section className="rounded-lg border border-gray-700 bg-gray-800 p-4 md:p-6">
          <h2 className="text-xl font-bold mb-4 text-green-400">
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
                <form onSubmit={saveDay} className="space-y-4 animate-fadeIn">
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

                  <div className="grid gap-4 md:grid-cols-[110px_minmax(0,1fr)]">
                    <div>
                      <label className="text-xs text-gray-400">Dia #</label>
                      <input
                        type="number"
                        value={dayNumber}
                        min={1}
                        onChange={(e) => setDayNumber(Number(e.target.value))}
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
                        onChange={(e) => setDayTitle(e.target.value)}
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
                      onChange={(e) => setDayDiscussionPrompt(e.target.value)}
                      placeholder="Ej: ¿Qué aplicarías mañana de este día y por qué?"
                      rows={3}
                      className="mt-1 w-full rounded bg-black border border-gray-600 p-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Si lo dejas vacío, el foro usará un prompt automático.
                    </p>
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
                          Ctrl/Cmd + Z
                        </span>
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
                              ? "border border-[var(--ast-sky)]/55 bg-[var(--ast-cobalt)]/25 text-[var(--ast-sky)]"
                              : "border border-gray-700 bg-black/40 text-gray-300 hover:border-[var(--ast-sky)]/40"
                          }`}
                        >
                          Recurso principal ({resourceBlockCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDayBlocksViewPreset("challenge")}
                          className={`rounded px-3 py-1 text-xs font-semibold transition ${
                            dayBlocksViewPreset === "challenge"
                              ? "border border-[var(--ast-mint)]/55 bg-[var(--ast-emerald)]/25 text-[var(--ast-mint)]"
                              : "border border-gray-700 bg-black/40 text-gray-300 hover:border-[var(--ast-mint)]/40"
                          }`}
                        >
                          Reto del día ({challengeBlockCount})
                        </button>
                      </div>
                    </div>

                    {blocks.map((block, index) => (
                      (() => {
                        const blockGroup = block.group ?? getDefaultDayBlockGroup(block.type);
                        const blockRole = normalizeBlockRole(block.role, blockGroup);
                        const isVisibleInPreset =
                          dayBlocksViewPreset === "all" ||
                          dayBlocksViewPreset === blockGroup;
                        if (!isVisibleInPreset) return null;

                        return (
                      <div
                        key={block.id}
                        className={`rounded-lg p-3 space-y-3 ${
                          blockGroup === "challenge"
                            ? "border border-[var(--ast-mint)]/45 bg-[rgba(0,73,44,0.22)]"
                            : "border border-[var(--ast-sky)]/35 bg-[rgba(1,25,99,0.18)]"
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
                                  <span className="rounded-full border border-[var(--ast-yellow)]/50 bg-[var(--ast-rust)]/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ast-yellow)]">
                                    Ruta
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
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
                            <input
                              type="text"
                              value={block.title ?? ""}
                              onChange={(e) =>
                                updateBlock(block.id, { title: e.target.value })
                              }
                              placeholder="Titulo del checklist (opcional)"
                              className="w-full p-2 rounded bg-gray-950 border border-gray-700"
                            />
                            <div className="space-y-2">
                              {(block.items ?? []).map((item, itemIndex) => (
                                <div key={item.id} className="flex gap-2">
                                  <input
                                    type="text"
                                    value={item.text}
                                    onChange={(e) =>
                                      updateChecklistItem(block.id, item.id, {
                                        text: e.target.value,
                                      })
                                    }
                                    placeholder={`Punto ${itemIndex + 1}`}
                                    className="flex-1 p-2 rounded bg-gray-950 border border-gray-700"
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
                            <input
                              type="text"
                              value={block.title ?? ""}
                              onChange={(e) =>
                                updateBlock(block.id, { title: e.target.value })
                              }
                              placeholder="Titulo del quiz (opcional)"
                              className="w-full p-2 rounded bg-gray-950 border border-gray-700"
                            />

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

                                  <input
                                    type="text"
                                    value={question.prompt}
                                    onChange={(e) =>
                                      updateQuizQuestion(block.id, question.id, {
                                        prompt: e.target.value,
                                      })
                                    }
                                    placeholder="Enunciado de la pregunta"
                                    className="w-full p-2 rounded bg-black border border-gray-700"
                                  />

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

                                  <input
                                    type="text"
                                    value={question.explanation ?? ""}
                                    onChange={(e) =>
                                      updateQuizQuestion(block.id, question.id, {
                                        explanation: e.target.value,
                                      })
                                    }
                                    placeholder="Explicación opcional al revisar resultados"
                                    className="w-full p-2 rounded bg-black border border-gray-700"
                                  />
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
                          <button
                            type="button"
                            className="px-3 py-1 text-xs rounded border border-red-700/70 bg-red-950/45 text-red-200 hover:bg-red-900/55 disabled:opacity-40"
                            onClick={() => removeBlock(block.id)}
                            disabled={blocks.length === 1}
                          >
                            Eliminar bloque
                          </button>
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

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded font-bold"
                    >
                      {editingDayId ? "Actualizar Dia" : "Guardar Dia"}
                    </button>
                    {editingDayId && (
                      <button
                        type="button"
                        onClick={() => void deleteDay()}
                        className="px-4 py-2 rounded font-bold bg-red-700 hover:bg-red-600"
                      >
                        Eliminar Dia
                      </button>
                    )}
                  </div>
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
          <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-amber-400">
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
          <section className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-bold mb-4 text-cyan-300">
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
          <section className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-6">
            <h2 className="text-xl font-bold text-emerald-300">
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

function normalizeBlockRole(
  role: DayBlockRole | undefined,
  group: DayBlockGroup,
): DayBlockRole {
  if (group === "challenge") return "support";
  return role === "primary" ? "primary" : "support";
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
