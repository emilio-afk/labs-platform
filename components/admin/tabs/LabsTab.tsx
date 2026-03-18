"use client";

import React from "react";
import { normalizeAccentColor } from "@/utils/labMeta";
import type { AdminLab, LabMetaDraft, LabQuickMetrics } from "../types";

interface LabsTabProps {
  labs: AdminLab[];
  selectedLab: string | null;
  handleSelectLab: (labId: string | null) => void;
  msg: string;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  createLabSlug: string;
  setCreateLabSlug: (value: string) => void;
  createLabCoverUrl: string;
  setCreateLabCoverUrl: (value: string) => void;
  isUploadingCreateCover: boolean;
  createLabAccentColor: string;
  setCreateLabAccentColor: (value: string) => void;
  labelsInput: string;
  setLabelsInput: (value: string) => void;
  uploadingLabCoverId: string | null;
  labLabelDrafts: Record<string, string>;
  setLabLabelDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingLabelsLabId: string | null;
  editingLabId: string | null;
  labMetaDrafts: Record<string, LabMetaDraft>;
  setLabMetaDrafts: React.Dispatch<React.SetStateAction<Record<string, LabMetaDraft>>>;
  savingLabMetaId: string | null;
  duplicatingLabId: string | null;
  isDeletingLabId: string | null;
  labMetrics: Record<string, LabQuickMetrics>;
  createLab: (e: React.FormEvent<HTMLFormElement>) => void;
  saveLabLabels: (labId: string) => Promise<void>;
  startEditLabMeta: (lab: AdminLab) => void;
  cancelEditLabMeta: () => void;
  saveLabMeta: (labId: string) => Promise<void>;
  duplicateLab: (labId: string) => Promise<void>;
  deleteLab: (lab: AdminLab) => Promise<void>;
  handleCreateLabCoverUpload: (file: File) => Promise<void>;
  handleEditLabCoverUpload: (lab: AdminLab, file: File) => Promise<void>;
  handleQuickLabCoverUpload: (lab: AdminLab, file: File) => Promise<void>;
  formatLabelsForInput: (labels: string[] | null | undefined) => string;
  normalizeLabels: (labels: string[] | null | undefined) => string[];
}

export default function LabsTab({
  labs,
  selectedLab,
  handleSelectLab,
  msg,
  title,
  setTitle,
  description,
  setDescription,
  createLabSlug,
  setCreateLabSlug,
  createLabCoverUrl,
  setCreateLabCoverUrl,
  isUploadingCreateCover,
  createLabAccentColor,
  setCreateLabAccentColor,
  labelsInput,
  setLabelsInput,
  uploadingLabCoverId,
  labLabelDrafts,
  setLabLabelDrafts,
  savingLabelsLabId,
  editingLabId,
  labMetaDrafts,
  setLabMetaDrafts,
  savingLabMetaId,
  duplicatingLabId,
  isDeletingLabId,
  labMetrics,
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
  formatLabelsForInput,
  normalizeLabels,
}: LabsTabProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(8,20,52,0.88),rgba(4,12,32,0.95))] shadow-[0_24px_48px_rgba(1,5,18,0.55)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(10,86,198,0.9),transparent)]">
    <div className="border-b border-[var(--ui-primary)]/22 bg-[rgba(10,86,198,0.13)] px-6 py-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--ast-sky-text)]">Módulo 02</p>
      <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-black tracking-tight text-[var(--ui-text)]">
        Labs
      </h2>
      <p className="mt-0.5 text-[11px] text-[var(--ast-sky)]/70">Crea cursos, edita metadatos, gestiona portadas y etiquetas.</p>
    </div>
    <div className="p-6">
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
        className="bg-[var(--ui-primary)] hover:bg-[var(--ast-atlantic)] px-6 py-2 rounded text-white font-bold disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
    </section>
  );
}
