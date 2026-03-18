"use client";

import React from "react";
import RichTextEditor from "@/components/RichTextEditor";
import {
  getDefaultDayBlockGroup,
  type DayBlock,
  type DayBlockGroup,
  type DayBlockRole,
  type DayResourceSlot,
  type DayChallengeStep,
  type DayQuizQuestion,
} from "@/utils/dayBlocks";
import type { DayBlocksViewPreset } from "../types";
import { normalizeBlockRole } from "../utils/blockNormalization";
import {
  getBlockTypeLabel,
  getFileAcceptForBlock,
  canUseResourceLink,
  normalizeResourceSlotForBuilder,
} from "../utils/formatting";

interface BlockItemProps {
  block: DayBlock;
  index: number;
  totalBlocks: number;
  activeBuilderBlockId: string | null;
  dayBlocksViewPreset: DayBlocksViewPreset;
  setFocusedBlockId: (id: string | null) => void;
  pendingDeleteBlockId: string | null;
  setPendingDeleteBlockId: (id: string | null) => void;
  uploadingBlockId: string | null;
  moveBlock: (index: number, direction: -1 | 1) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, patch: Partial<DayBlock>) => void;
  updateChecklistItem: (blockId: string, itemId: string, patch: { text?: string }) => void;
  addChecklistItem: (blockId: string) => void;
  removeChecklistItem: (blockId: string, itemId: string) => void;
  updateQuizQuestion: (blockId: string, questionId: string, patch: Partial<DayQuizQuestion>) => void;
  addQuizQuestion: (blockId: string) => void;
  removeQuizQuestion: (blockId: string, questionId: string) => void;
  addQuizOption: (blockId: string, questionId: string) => void;
  updateQuizOption: (blockId: string, questionId: string, optionIndex: number, value: string) => void;
  removeQuizOption: (blockId: string, questionId: string, optionIndex: number) => void;
  updateChallengeStep: (blockId: string, stepId: string, patch: Partial<DayChallengeStep>) => void;
  addChallengeStep: (blockId: string) => void;
  removeChallengeStep: (blockId: string, stepId: string) => void;
  uploadFileForBlock: (block: DayBlock, file: File) => Promise<void>;
}

export default function BlockItem({
  block,
  index,
  totalBlocks,
  activeBuilderBlockId,
  dayBlocksViewPreset,
  setFocusedBlockId,
  pendingDeleteBlockId,
  setPendingDeleteBlockId,
  uploadingBlockId,
  moveBlock,
  removeBlock,
  updateBlock,
  updateChecklistItem,
  addChecklistItem,
  removeChecklistItem,
  updateQuizQuestion,
  addQuizQuestion,
  removeQuizQuestion,
  addQuizOption,
  updateQuizOption,
  removeQuizOption,
  updateChallengeStep,
  addChallengeStep,
  removeChallengeStep,
  uploadFileForBlock,
}: BlockItemProps) {
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
              disabled={index === totalBlocks - 1}
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
                    className="px-2 py-1 text-xs rounded bg-[var(--ast-rust)]/60 hover:bg-[var(--ast-rust)]"
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
                  className="px-3 py-1 text-xs rounded bg-[var(--ast-rust)]/60 hover:bg-[var(--ast-rust)]"
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
                    className="px-2 py-1 text-xs rounded bg-[var(--ast-rust)]/60 hover:bg-[var(--ast-rust)]"
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
                      className="px-2 py-1 text-xs rounded bg-[var(--ast-rust)]/60 hover:bg-[var(--ast-rust)]"
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
              disabled={totalBlocks === 1}
            >
              Sí, eliminar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="px-3 py-1 text-xs rounded border border-red-700/70 bg-red-950/45 text-red-200 hover:bg-red-900/55 disabled:opacity-40"
            onClick={() => setPendingDeleteBlockId(block.id)}
            disabled={totalBlocks === 1}
          >
            Eliminar bloque
          </button>
        )}
      </div>
    </div>
  );
}
