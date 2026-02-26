"use client";

export default function ProgressBar({
  completed,
  total,
  label = "Progreso del lab",
}: {
  completed: number;
  total: number;
  label?: string;
}) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-end justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#cfe0fa]">
          {label}
        </span>
        <span className="text-lg font-black text-white">{percentage}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-[var(--ast-sky)]/25 bg-[rgba(4,12,31,0.7)]">
        <div
          className="h-full bg-gradient-to-r from-[var(--ast-emerald)] to-[var(--ast-mint)] transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
