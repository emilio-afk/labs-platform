"use client";

export default function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  // Calculamos el porcentaje. Si total es 0, evitamos error de división por cero.
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-full mb-8">
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs font-bold text-green-500 uppercase tracking-widest">
          Tu Progreso
        </span>
        <span className="text-2xl font-black text-white">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
