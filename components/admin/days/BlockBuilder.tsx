"use client";

import React from "react";
import {
  getDefaultDayBlockGroup,
  type DayBlock,
  type DayBlockType,
  type DayChallengeStep,
  type DayQuizQuestion,
} from "@/utils/dayBlocks";
import type {
  AdminLab,
  DayBlocksViewPreset,
  DayBlockTemplate,
} from "../types";
import { normalizeBlockRole } from "../utils/blockNormalization";
import { getBlockTypeLabel } from "../utils/formatting";
import { renderStudentBlockPreview } from "./StudentPreview";
import BlockItem from "./BlockItem";

interface BlockBuilderProps {
  blocks: DayBlock[];
  visibleBuilderBlocks: DayBlock[];
  activeBuilderBlock: DayBlock | null;
  activeBuilderBlockId: string | null;
  focusedBlockId: string | null;
  setFocusedBlockId: (id: string | null) => void;
  pendingDeleteBlockId: string | null;
  setPendingDeleteBlockId: (id: string | null) => void;
  uploadingBlockId: string | null;
  dayBlocksViewPreset: DayBlocksViewPreset;
  setDayBlocksViewPreset: (value: DayBlocksViewPreset) => void;
  resourceBlockCount: number;
  challengeBlockCount: number;
  showStudentPreview: boolean;
  setShowStudentPreview: React.Dispatch<React.SetStateAction<boolean>>;
  canUndoBlocks: boolean;
  canRedoBlocks: boolean;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  dayBlockTemplates: DayBlockTemplate[];
  dayShortcutKeyLabel: string;
  selectedLabData: AdminLab | null;
  addBlock: (type: DayBlockType) => void;
  updateBlock: (id: string, patch: Partial<DayBlock>) => void;
  moveBlock: (index: number, direction: -1 | 1) => void;
  removeBlock: (id: string) => void;
  undoBlocks: () => void;
  redoBlocks: () => void;
  applyTemplate: () => void;
  consolidateChallengeIntoGuidedBlock: () => void;
  uploadFileForBlock: (block: DayBlock, file: File) => Promise<void>;
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
}

export default function BlockBuilder({
  blocks,
  visibleBuilderBlocks,
  activeBuilderBlock,
  activeBuilderBlockId,
  setFocusedBlockId,
  pendingDeleteBlockId,
  setPendingDeleteBlockId,
  uploadingBlockId,
  dayBlocksViewPreset,
  setDayBlocksViewPreset,
  resourceBlockCount,
  challengeBlockCount,
  showStudentPreview,
  setShowStudentPreview,
  canUndoBlocks,
  canRedoBlocks,
  selectedTemplateId,
  setSelectedTemplateId,
  dayBlockTemplates,
  dayShortcutKeyLabel,
  selectedLabData,
  addBlock,
  updateBlock,
  moveBlock,
  removeBlock,
  undoBlocks,
  redoBlocks,
  applyTemplate,
  consolidateChallengeIntoGuidedBlock,
  uploadFileForBlock,
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
}: BlockBuilderProps) {
  return (
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
            <BlockItem
              key={block.id}
              block={block}
              index={index}
              totalBlocks={blocks.length}
              activeBuilderBlockId={activeBuilderBlockId}
              dayBlocksViewPreset={dayBlocksViewPreset}
              setFocusedBlockId={setFocusedBlockId}
              pendingDeleteBlockId={pendingDeleteBlockId}
              setPendingDeleteBlockId={setPendingDeleteBlockId}
              uploadingBlockId={uploadingBlockId}
              moveBlock={moveBlock}
              removeBlock={removeBlock}
              updateBlock={updateBlock}
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
              uploadFileForBlock={uploadFileForBlock}
            />
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
  );
}
