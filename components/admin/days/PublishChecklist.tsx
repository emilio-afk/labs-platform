"use client";

import React from "react";
import type { DayPublishChecklist } from "../types";

interface PublishChecklistProps {
  dayPublishChecklist: DayPublishChecklist;
}

export default function PublishChecklist({
  dayPublishChecklist,
}: PublishChecklistProps) {
  return (
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
  );
}
