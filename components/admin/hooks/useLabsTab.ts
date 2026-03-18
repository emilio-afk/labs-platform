import { useEffect, useState } from "react";
import type { createClient } from "@/utils/supabase/client";
import type { AdminLab, AdminTab, LabMetaDraft, LabQuickMetrics } from "../types";
import {
  formatLabelsForInput,
  isMissingLabelsColumnError,
  isMissingLabMetaColumnsError,
  isDuplicateSlugError,
  normalizeLabels,
  parseLabelsInput,
} from "../utils/formatting";
import { normalizeAccentColor, normalizeLabSlug, normalizeOptionalUrl } from "@/utils/labMeta";

type SupabaseClient = ReturnType<typeof createClient>;

export function useLabsTab(
  supabase: SupabaseClient,
  labs: AdminLab[],
  setLabs: React.Dispatch<React.SetStateAction<AdminLab[]>>,
  fetchLabs: () => Promise<void>,
  selectedLab: string | null,
  handleSelectLab: (labId: string | null) => void,
  refreshCommerce: () => void,
  activeTab: AdminTab,
) {
  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createLabSlug, setCreateLabSlug] = useState("");
  const [createLabCoverUrl, setCreateLabCoverUrl] = useState("");
  const [isUploadingCreateCover, setIsUploadingCreateCover] = useState(false);
  const [createLabAccentColor, setCreateLabAccentColor] = useState("#0A56C6");
  const [labelsInput, setLabelsInput] = useState("");

  // List state
  const [uploadingLabCoverId, setUploadingLabCoverId] = useState<string | null>(null);
  const [labLabelDrafts, setLabLabelDrafts] = useState<Record<string, string>>({});
  const [savingLabelsLabId, setSavingLabelsLabId] = useState<string | null>(null);
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [labMetaDrafts, setLabMetaDrafts] = useState<Record<string, LabMetaDraft>>({});
  const [savingLabMetaId, setSavingLabMetaId] = useState<string | null>(null);
  const [duplicatingLabId, setDuplicatingLabId] = useState<string | null>(null);
  const [isDeletingLabId, setIsDeletingLabId] = useState<string | null>(null);
  const [labMetrics, setLabMetrics] = useState<Record<string, LabQuickMetrics>>({});
  const [msg, setMsg] = useState("");

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
      .insert([{ title: nextTitle, description: nextDescription || null }])
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

    setLabs((prev) => prev.map((lab) => (lab.id === labId ? { ...lab, labels } : lab)));
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
    const response = await fetch(`/api/admin/labs/${labId}/duplicate`, { method: "POST" });
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
      handleSelectLab(null);
    }
    await fetchLabs();
    refreshCommerce();
    setIsDeletingLabId(null);
  };

  return {
    // Create form
    title, setTitle,
    description, setDescription,
    createLabSlug, setCreateLabSlug,
    createLabCoverUrl, setCreateLabCoverUrl,
    isUploadingCreateCover,
    createLabAccentColor, setCreateLabAccentColor,
    labelsInput, setLabelsInput,
    // List state
    uploadingLabCoverId,
    labLabelDrafts, setLabLabelDrafts,
    savingLabelsLabId,
    editingLabId,
    labMetaDrafts, setLabMetaDrafts,
    savingLabMetaId,
    duplicatingLabId,
    isDeletingLabId,
    labMetrics,
    msg, setMsg,
    // Handlers
    createLab,
    saveLabLabels,
    startEditLabMeta,
    cancelEditLabMeta,
    saveLabMeta,
    duplicateLab,
    deleteLab,
    handleCreateLabCoverUpload,
    handleEditLabCoverUpload,
    handleQuickLabCoverUpload,
    // Helpers re-exported for JSX
    formatLabelsForInput,
    normalizeLabels,
  };
}
