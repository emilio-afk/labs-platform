"use client";

import React from "react";
import type { AdminLab, AdminDay } from "../types";

interface DaySidebarProps {
  labs: AdminLab[];
  selectedLab: string | null;
  handleSelectLab: (labId: string | null) => void;
  days: AdminDay[];
  editingDayId: string | null;
  startEditDay: (day: AdminDay) => void;
  startCreateDay: () => void;
  daysMsg: string;
}

export default function DaySidebar({
  labs,
  selectedLab,
  handleSelectLab,
  days,
  editingDayId,
  startEditDay,
  startCreateDay,
  daysMsg,
}: DaySidebarProps) {
  return (
    <div className="space-y-6 xl:border-r xl:border-gray-700 xl:pr-5">
      <h3 className="text-sm text-gray-400 mb-2 uppercase font-bold">
        Selecciona un Lab:
      </h3>
      <ul className="grid grid-cols-1 gap-2">
        {labs.map((lab) => (
          <li
            key={lab.id}
            onClick={() => handleSelectLab(lab.id)}
            className={`p-2 rounded cursor-pointer transition ${selectedLab === lab.id ? "bg-[rgba(4,164,90,0.18)] text-white border border-[var(--ast-mint)]" : "bg-gray-900 text-gray-400 hover:bg-gray-700"}`}
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
  );
}
