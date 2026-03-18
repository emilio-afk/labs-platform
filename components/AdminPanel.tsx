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
export type { AdminLab } from "./admin/types";
import type {
  AdminLab,
  AdminPanelProps,
  AdminComment,
  AdminDay,
  ManagedUser,
  UserEntitlementLab,
  UserActivitySummary,
  UserActivityItem,
  LabPrice,
  Coupon,
  AdminTab,
  DayBlocksViewPreset,
  DayPublishChecklist,
  DayBlockTemplate,
  LabMetaDraft,
  LabQuickMetrics,
} from "./admin/types";
import { MAX_DAY_BLOCK_HISTORY, BLOCK_DELETE_UNDO_WINDOW_MS } from "./admin/types";
import {
  normalizeBlockRole,
  buildDayDraftSignature,
  getCurrentTimestamp,
  normalizeDayBlocksForSave,
  buildDayPublishChecklist,
  cloneDayBlocks,
  getBlocksSignature,
  ensurePrimaryResourceBlock,
} from "./admin/utils/blockNormalization";
import {
  createVideoTextChallengeTemplateBlocks,
  createReadingQuizTemplateBlocks,
  createMediaChecklistTemplateBlocks,
} from "./admin/utils/blockTemplates";
import {
  getBlockTypeLabel,
  getFileAcceptForBlock,
  formatMoney,
  normalizeLabels,
  formatLabelsForInput,
  parseLabelsInput,
  getNextDayNumber,
  isEditableTarget,
  canUseResourceLink,
  normalizeResourceSlotForBuilder,
  isMissingLabelsColumnError,
  isMissingLabMetaColumnsError,
  isDuplicateSlugError,
} from "./admin/utils/formatting";
import { renderStudentBlockPreview } from "./admin/days/StudentPreview";
import { useHeroTab } from "./admin/hooks/useHeroTab";
import { useCommentsTab } from "./admin/hooks/useCommentsTab";
import { useCommerceTab } from "./admin/hooks/useCommerceTab";
import { useUsersTab } from "./admin/hooks/useUsersTab";
import { useLabsTab } from "./admin/hooks/useLabsTab";
import HeroTab from "./admin/tabs/HeroTab";
import LabsTab from "./admin/tabs/LabsTab";
import DaysTab from "./admin/tabs/DaysTab";
import CommentsTab from "./admin/tabs/CommentsTab";
import UsersTab from "./admin/tabs/UsersTab";
import CommerceTab from "./admin/tabs/CommerceTab";


export default function AdminPanel({
  initialLabs,
  initialHeroTitle,
  initialHeroSubtitle,
}: AdminPanelProps) {
  const [labs, setLabs] = useState<AdminLab[]>(initialLabs);

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

  const [activeTab, setActiveTab] = useState<AdminTab>("hero");

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

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

  const handleSelectLab = (labId: string | null) => {
    const blankBlock = createBlock("text");
    setSelectedLab(labId);
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

  // Tab hooks
  const { heroTitle, setHeroTitle, heroSubtitle, setHeroSubtitle, heroMsg, saveHeroSettings } = useHeroTab(supabase, initialHeroTitle, initialHeroSubtitle);
  const { commentDayFilter, setCommentDayFilter, comments, commentsMsg, commentsRefreshTick, setCommentsRefreshTick, deleteComment } = useCommentsTab(supabase, selectedLab);
  const { pricingMsg, priceCurrency, setPriceCurrency, priceAmount, setPriceAmount, labPrices, couponCode, setCouponCode, couponType, setCouponType, couponPercent, setCouponPercent, couponAmount, setCouponAmount, couponCurrency, setCouponCurrency, couponScope, setCouponScope, couponLabId, setCouponLabId, couponExpiresAt, setCouponExpiresAt, coupons, refresh: refreshCommerce, savePrice, createCoupon, toggleCouponActive } = useCommerceTab(selectedLab, activeTab);
  const { userSearch, setUserSearch, managedUsers, selectedManagedUserId, setSelectedManagedUserId, selectedManagedUser, userMgmtMsg, entitlementLabs, activitySummary, activityItems, toggleUserLabAccess, setUserMgmtRefreshTick } = useUsersTab();
  const { msg, setMsg, title, setTitle, description, setDescription, createLabSlug, setCreateLabSlug, createLabCoverUrl, setCreateLabCoverUrl, isUploadingCreateCover, createLabAccentColor, setCreateLabAccentColor, labelsInput, setLabelsInput, uploadingLabCoverId, labLabelDrafts, setLabLabelDrafts, savingLabelsLabId, editingLabId, labMetaDrafts, setLabMetaDrafts, savingLabMetaId, duplicatingLabId, isDeletingLabId, labMetrics, createLab, saveLabLabels, startEditLabMeta, cancelEditLabMeta, saveLabMeta, duplicateLab, deleteLab, handleCreateLabCoverUpload, handleEditLabCoverUpload, handleQuickLabCoverUpload, formatLabelsForInput, normalizeLabels } = useLabsTab(supabase, labs, setLabs, fetchLabs, selectedLab, handleSelectLab, refreshCommerce, activeTab);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="ast-admin-theme relative isolate min-h-screen !bg-[#040d22] p-4 text-[var(--ui-text)] md:p-6 xl:p-8">
      {/* Spatial background layers */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_48%_at_50%_0%,rgba(10,86,198,0.32),transparent),radial-gradient(circle_at_88%_14%,rgba(4,164,90,0.18),transparent_28%),radial-gradient(circle_at_10%_85%,rgba(10,86,198,0.12),transparent_32%)]" />
      <div className="ast-admin-grid pointer-events-none absolute inset-0 opacity-[0.05]" />

      <div className="relative mx-auto w-full max-w-[1440px] space-y-5">

        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl border border-[var(--ast-sky)]/18 bg-[rgba(3,10,27,0.94)] px-5 py-3.5 shadow-[0_0_0_1px_rgba(185,214,254,0.05),0_24px_48px_rgba(1,5,18,0.65)] backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ast-mint)] opacity-55" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ast-mint)]" />
            </span>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--ui-muted)]/70">Control Panel · Online</p>
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-[1.35rem] font-black leading-tight tracking-tight text-[var(--ui-text)]">
                Astrolab <span className="font-light text-[var(--ast-sky)]/55">/ Admin</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="rounded-lg border border-[var(--ui-border)]/45 bg-transparent px-3 py-1.5 text-[11px] font-medium text-[var(--ui-muted)] transition hover:border-[var(--ast-sky)]/45 hover:text-[var(--ui-text)]"
            >
              ← Plataforma
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-[var(--ast-rust)]/30 bg-[rgba(136,31,0,0.1)] px-3 py-1.5 text-[11px] font-medium text-[var(--ast-coral)] transition hover:bg-[rgba(136,31,0,0.2)]"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Nav tabs */}
        <nav className="flex flex-wrap gap-1.5">
          {[
            { key: "hero",     label: "Hero",         glyph: "◈", activeClass: "border-[var(--ast-sky)]/65 bg-[rgba(10,86,198,0.35)] text-[var(--ast-sky)] shadow-[0_0_22px_rgba(10,86,198,0.3),inset_0_1px_0_rgba(185,214,254,0.18)]" },
            { key: "labs",     label: "Labs",         glyph: "⬡", activeClass: "border-[var(--ui-primary)]/65 bg-[rgba(10,86,198,0.35)] text-[var(--ast-sky)] shadow-[0_0_22px_rgba(10,86,198,0.3),inset_0_1px_0_rgba(185,214,254,0.18)]" },
            { key: "days",     label: "Días",         glyph: "◉", activeClass: "border-[var(--ast-mint)]/65 bg-[rgba(4,164,90,0.26)] text-[var(--ast-mint)] shadow-[0_0_22px_rgba(4,164,90,0.28),inset_0_1px_0_rgba(4,164,90,0.2)]" },
            { key: "comments", label: "Comentarios",  glyph: "◎", activeClass: "border-[var(--ast-yellow)]/55 bg-[rgba(253,244,139,0.12)] text-[var(--ast-yellow)] shadow-[0_0_22px_rgba(253,244,139,0.2),inset_0_1px_0_rgba(253,244,139,0.15)]" },
            { key: "users",    label: "Usuarios",     glyph: "◐", activeClass: "border-[var(--ast-sky)]/65 bg-[rgba(10,86,198,0.35)] text-[var(--ast-sky)] shadow-[0_0_22px_rgba(10,86,198,0.3),inset_0_1px_0_rgba(185,214,254,0.18)]" },
            { key: "commerce", label: "Comercial",    glyph: "◆", activeClass: "border-[var(--ast-mint)]/65 bg-[rgba(4,164,90,0.26)] text-[var(--ast-mint)] shadow-[0_0_22px_rgba(4,164,90,0.28),inset_0_1px_0_rgba(4,164,90,0.2)]" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as AdminTab)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition-all duration-200 ${
                activeTab === tab.key
                  ? tab.activeClass
                  : "border-[var(--ui-border)]/35 bg-[rgba(185,214,254,0.04)] text-[var(--ui-muted)] hover:border-[var(--ui-border)]/55 hover:text-[var(--ui-text)]"
              }`}
            >
              <span aria-hidden className="text-[12px] leading-none opacity-70">{tab.glyph}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "hero" && (
          <HeroTab
            heroTitle={heroTitle}
            setHeroTitle={setHeroTitle}
            heroSubtitle={heroSubtitle}
            setHeroSubtitle={setHeroSubtitle}
            heroMsg={heroMsg}
            saveHeroSettings={saveHeroSettings}
          />
        )}

        {activeTab === "labs" && (
          <LabsTab
            labs={labs}
            selectedLab={selectedLab}
            handleSelectLab={handleSelectLab}
            msg={msg}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            createLabSlug={createLabSlug}
            setCreateLabSlug={setCreateLabSlug}
            createLabCoverUrl={createLabCoverUrl}
            setCreateLabCoverUrl={setCreateLabCoverUrl}
            isUploadingCreateCover={isUploadingCreateCover}
            createLabAccentColor={createLabAccentColor}
            setCreateLabAccentColor={setCreateLabAccentColor}
            labelsInput={labelsInput}
            setLabelsInput={setLabelsInput}
            uploadingLabCoverId={uploadingLabCoverId}
            labLabelDrafts={labLabelDrafts}
            setLabLabelDrafts={setLabLabelDrafts}
            savingLabelsLabId={savingLabelsLabId}
            editingLabId={editingLabId}
            labMetaDrafts={labMetaDrafts}
            setLabMetaDrafts={setLabMetaDrafts}
            savingLabMetaId={savingLabMetaId}
            duplicatingLabId={duplicatingLabId}
            isDeletingLabId={isDeletingLabId}
            labMetrics={labMetrics}
            createLab={createLab}
            saveLabLabels={saveLabLabels}
            startEditLabMeta={startEditLabMeta}
            cancelEditLabMeta={cancelEditLabMeta}
            saveLabMeta={saveLabMeta}
            duplicateLab={duplicateLab}
            deleteLab={deleteLab}
            handleCreateLabCoverUpload={handleCreateLabCoverUpload}
            handleEditLabCoverUpload={handleEditLabCoverUpload}
            handleQuickLabCoverUpload={handleQuickLabCoverUpload}
            formatLabelsForInput={formatLabelsForInput}
            normalizeLabels={normalizeLabels}
          />
        )}

        {activeTab === "days" && (
          <DaysTab
            labs={labs}
            selectedLab={selectedLab}
            selectedLabData={selectedLabData}
            handleSelectLab={handleSelectLab}
            days={days}
            daysMsg={daysMsg}
            editingDayId={editingDayId}
            dayNumber={dayNumber}
            setDayNumber={setDayNumber}
            dayTitle={dayTitle}
            setDayTitle={setDayTitle}
            dayDiscussionPrompt={dayDiscussionPrompt}
            setDayDiscussionPrompt={setDayDiscussionPrompt}
            blocks={blocks}
            dayMsg={dayMsg}
            dayPublishChecklist={dayPublishChecklist}
            daySaveState={daySaveState}
            daySaveError={daySaveError}
            daySavedTimeLabel={daySavedTimeLabel}
            dayShortcutKeyLabel={dayShortcutKeyLabel}
            dayBlocksViewPreset={dayBlocksViewPreset}
            setDayBlocksViewPreset={setDayBlocksViewPreset}
            resourceBlockCount={resourceBlockCount}
            challengeBlockCount={challengeBlockCount}
            visibleBuilderBlocks={visibleBuilderBlocks}
            activeBuilderBlock={activeBuilderBlock}
            activeBuilderBlockId={activeBuilderBlockId}
            focusedBlockId={focusedBlockId}
            setFocusedBlockId={setFocusedBlockId}
            pendingDeleteBlockId={pendingDeleteBlockId}
            setPendingDeleteBlockId={setPendingDeleteBlockId}
            lastRemovedBlock={lastRemovedBlock}
            showStudentPreview={showStudentPreview}
            setShowStudentPreview={setShowStudentPreview}
            showDeleteDayConfirm={showDeleteDayConfirm}
            setShowDeleteDayConfirm={setShowDeleteDayConfirm}
            deleteDayConfirmValue={deleteDayConfirmValue}
            setDeleteDayConfirmValue={setDeleteDayConfirmValue}
            dayDeletePhrase={dayDeletePhrase}
            isDaySaving={isDaySaving}
            isDeletingDay={isDeletingDay}
            uploadingBlockId={uploadingBlockId}
            canUndoBlocks={canUndoBlocks}
            canRedoBlocks={canRedoBlocks}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            dayBlockTemplates={dayBlockTemplates}
            dayFormRef={dayFormRef}
            saveDay={saveDay}
            startCreateDay={startCreateDay}
            startEditDay={startEditDay}
            addBlock={addBlock}
            updateBlock={updateBlock}
            moveBlock={moveBlock}
            removeBlock={removeBlock}
            undoRemoveBlock={undoRemoveBlock}
            undoBlocks={undoBlocks}
            redoBlocks={redoBlocks}
            applyTemplate={applyTemplate}
            consolidateChallengeIntoGuidedBlock={consolidateChallengeIntoGuidedBlock}
            deleteDay={deleteDay}
            uploadFileForBlock={uploadFileForBlock}
            setDaySaveError={setDaySaveError}
            updateChecklistItem={updateChecklistItem}
            addChecklistItem={addChecklistItem}
            removeChecklistItem={removeChecklistItem}
            updateQuizQuestion={updateQuizQuestion}
            addQuizQuestion={addQuizQuestion}
            removeQuizQuestion={removeQuizQuestion}
            addQuizOption={addQuizOption}
            updateQuizOption={updateQuizOption}
            removeQuizOption={removeQuizOption}
            updateChallengeStep={updateChallengeStep}
            addChallengeStep={addChallengeStep}
            removeChallengeStep={removeChallengeStep}
          />
        )}

        {activeTab === "comments" && (
          <CommentsTab
            selectedLab={selectedLab}
            commentDayFilter={commentDayFilter}
            setCommentDayFilter={setCommentDayFilter}
            comments={comments}
            commentsMsg={commentsMsg}
            setCommentsRefreshTick={setCommentsRefreshTick}
            deleteComment={deleteComment}
          />
        )}

        {activeTab === "users" && (
          <UsersTab
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            managedUsers={managedUsers}
            selectedManagedUserId={selectedManagedUserId}
            setSelectedManagedUserId={setSelectedManagedUserId}
            selectedManagedUser={selectedManagedUser}
            userMgmtMsg={userMgmtMsg}
            entitlementLabs={entitlementLabs}
            activitySummary={activitySummary}
            activityItems={activityItems}
            toggleUserLabAccess={toggleUserLabAccess}
            setUserMgmtRefreshTick={setUserMgmtRefreshTick}
          />
        )}

        {activeTab === "commerce" && (
          <CommerceTab
            labs={labs}
            selectedLab={selectedLab}
            handleSelectLab={handleSelectLab}
            pricingMsg={pricingMsg}
            priceCurrency={priceCurrency}
            setPriceCurrency={setPriceCurrency}
            priceAmount={priceAmount}
            setPriceAmount={setPriceAmount}
            labPrices={labPrices}
            couponCode={couponCode}
            setCouponCode={setCouponCode}
            couponType={couponType}
            setCouponType={setCouponType}
            couponPercent={couponPercent}
            setCouponPercent={setCouponPercent}
            couponAmount={couponAmount}
            setCouponAmount={setCouponAmount}
            couponCurrency={couponCurrency}
            setCouponCurrency={setCouponCurrency}
            couponScope={couponScope}
            setCouponScope={setCouponScope}
            couponLabId={couponLabId}
            setCouponLabId={setCouponLabId}
            couponExpiresAt={couponExpiresAt}
            setCouponExpiresAt={setCouponExpiresAt}
            coupons={coupons}
            savePrice={savePrice}
            createCoupon={createCoupon}
            toggleCouponActive={toggleCouponActive}
          />
        )}
      </div>
    </div>
  );
}
