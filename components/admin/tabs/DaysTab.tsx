"use client";

import React from "react";
import type {
  DayBlock,
  DayBlockType,
  DayChallengeStep,
  DayQuizQuestion,
} from "@/utils/dayBlocks";
import type {
  AdminLab,
  AdminDay,
  DayBlocksViewPreset,
  DayPublishChecklist,
  DayBlockTemplate,
} from "../types";
import { BLOCK_DELETE_UNDO_WINDOW_MS } from "../types";
import DaySidebar from "../days/DaySidebar";
import PublishChecklist from "../days/PublishChecklist";
import BlockBuilder from "../days/BlockBuilder";

interface DaysTabProps {
  labs: AdminLab[];
  selectedLab: string | null;
  selectedLabData: AdminLab | null;
  handleSelectLab: (labId: string | null) => void;
  days: AdminDay[];
  daysMsg: string;
  editingDayId: string | null;
  dayNumber: number;
  setDayNumber: (value: number) => void;
  dayTitle: string;
  setDayTitle: (value: string) => void;
  dayDiscussionPrompt: string;
  setDayDiscussionPrompt: (value: string) => void;
  blocks: DayBlock[];
  dayMsg: string;
  dayPublishChecklist: DayPublishChecklist;
  daySaveState: "clean" | "dirty" | "saving" | "saved" | "error";
  daySaveError: string | null;
  daySavedTimeLabel: string | null;
  dayShortcutKeyLabel: string;
  dayBlocksViewPreset: DayBlocksViewPreset;
  setDayBlocksViewPreset: (value: DayBlocksViewPreset) => void;
  resourceBlockCount: number;
  challengeBlockCount: number;
  visibleBuilderBlocks: DayBlock[];
  activeBuilderBlock: DayBlock | null;
  activeBuilderBlockId: string | null;
  focusedBlockId: string | null;
  setFocusedBlockId: (id: string | null) => void;
  pendingDeleteBlockId: string | null;
  setPendingDeleteBlockId: (id: string | null) => void;
  lastRemovedBlock: { block: DayBlock; index: number } | null;
  showStudentPreview: boolean;
  setShowStudentPreview: React.Dispatch<React.SetStateAction<boolean>>;
  showDeleteDayConfirm: boolean;
  setShowDeleteDayConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  deleteDayConfirmValue: string;
  setDeleteDayConfirmValue: (value: string) => void;
  dayDeletePhrase: string;
  isDaySaving: boolean;
  isDeletingDay: boolean;
  uploadingBlockId: string | null;
  canUndoBlocks: boolean;
  canRedoBlocks: boolean;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  dayBlockTemplates: DayBlockTemplate[];
  dayFormRef: React.RefObject<HTMLFormElement | null>;
  saveDay: (e: React.FormEvent<HTMLFormElement>) => void;
  startCreateDay: () => void;
  startEditDay: (day: AdminDay) => void;
  addBlock: (type: DayBlockType) => void;
  updateBlock: (id: string, patch: Partial<DayBlock>) => void;
  moveBlock: (index: number, direction: -1 | 1) => void;
  removeBlock: (id: string) => void;
  undoRemoveBlock: () => void;
  undoBlocks: () => void;
  redoBlocks: () => void;
  applyTemplate: () => void;
  consolidateChallengeIntoGuidedBlock: () => void;
  deleteDay: () => Promise<void>;
  uploadFileForBlock: (block: DayBlock, file: File) => Promise<void>;
  setDaySaveError: (error: string | null) => void;
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

export default function DaysTab({
  labs,
  selectedLab,
  selectedLabData,
  handleSelectLab,
  days,
  daysMsg,
  editingDayId,
  dayNumber,
  setDayNumber,
  dayTitle,
  setDayTitle,
  dayDiscussionPrompt,
  setDayDiscussionPrompt,
  blocks,
  dayMsg,
  dayPublishChecklist,
  daySaveState,
  daySaveError,
  daySavedTimeLabel,
  dayShortcutKeyLabel,
  dayBlocksViewPreset,
  setDayBlocksViewPreset,
  resourceBlockCount,
  challengeBlockCount,
  visibleBuilderBlocks,
  activeBuilderBlock,
  activeBuilderBlockId,
  focusedBlockId,
  setFocusedBlockId,
  pendingDeleteBlockId,
  setPendingDeleteBlockId,
  lastRemovedBlock,
  showStudentPreview,
  setShowStudentPreview,
  showDeleteDayConfirm,
  setShowDeleteDayConfirm,
  deleteDayConfirmValue,
  setDeleteDayConfirmValue,
  dayDeletePhrase,
  isDaySaving,
  isDeletingDay,
  uploadingBlockId,
  canUndoBlocks,
  canRedoBlocks,
  selectedTemplateId,
  setSelectedTemplateId,
  dayBlockTemplates,
  dayFormRef,
  saveDay,
  startCreateDay,
  startEditDay,
  addBlock,
  updateBlock,
  moveBlock,
  removeBlock,
  undoRemoveBlock,
  undoBlocks,
  redoBlocks,
  applyTemplate,
  consolidateChallengeIntoGuidedBlock,
  deleteDay,
  uploadFileForBlock,
  setDaySaveError,
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
}: DaysTabProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ast-mint)]/22 bg-[linear-gradient(160deg,rgba(8,20,52,0.88),rgba(4,12,32,0.95))] shadow-[0_24px_48px_rgba(1,5,18,0.55)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(4,164,90,0.7),transparent)]">
    <div className="border-b border-[var(--ast-mint)]/20 bg-[rgba(4,164,90,0.10)] px-6 py-4">
      <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--ast-mint)]">Módulo 03</p>
      <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-black tracking-tight text-[var(--ui-text)]">
        Constructor de Días
      </h2>
      <p className="mt-0.5 text-[11px] text-[var(--ast-mint)]/65">Diseña el contenido de cada día con bloques modulares.</p>
    </div>
    <div className="p-4 md:p-6">
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
      <DaySidebar
        labs={labs}
        selectedLab={selectedLab}
        handleSelectLab={handleSelectLab}
        days={days}
        editingDayId={editingDayId}
        startEditDay={startEditDay}
        startCreateDay={startCreateDay}
        daysMsg={daysMsg}
      />

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
                  placeholder="Ej: Fundamentos de inteligencia artificial"
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

            <PublishChecklist dayPublishChecklist={dayPublishChecklist} />

            <BlockBuilder
              blocks={blocks}
              visibleBuilderBlocks={visibleBuilderBlocks}
              activeBuilderBlock={activeBuilderBlock}
              activeBuilderBlockId={activeBuilderBlockId}
              focusedBlockId={focusedBlockId}
              setFocusedBlockId={setFocusedBlockId}
              pendingDeleteBlockId={pendingDeleteBlockId}
              setPendingDeleteBlockId={setPendingDeleteBlockId}
              uploadingBlockId={uploadingBlockId}
              dayBlocksViewPreset={dayBlocksViewPreset}
              setDayBlocksViewPreset={setDayBlocksViewPreset}
              resourceBlockCount={resourceBlockCount}
              challengeBlockCount={challengeBlockCount}
              showStudentPreview={showStudentPreview}
              setShowStudentPreview={setShowStudentPreview}
              canUndoBlocks={canUndoBlocks}
              canRedoBlocks={canRedoBlocks}
              selectedTemplateId={selectedTemplateId}
              setSelectedTemplateId={setSelectedTemplateId}
              dayBlockTemplates={dayBlockTemplates}
              dayShortcutKeyLabel={dayShortcutKeyLabel}
              selectedLabData={selectedLabData}
              addBlock={addBlock}
              updateBlock={updateBlock}
              moveBlock={moveBlock}
              removeBlock={removeBlock}
              undoBlocks={undoBlocks}
              redoBlocks={redoBlocks}
              applyTemplate={applyTemplate}
              consolidateChallengeIntoGuidedBlock={consolidateChallengeIntoGuidedBlock}
              uploadFileForBlock={uploadFileForBlock}
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
    </div>
    </section>
  );
}
