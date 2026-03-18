"use client";

import React from "react";

interface HeroTabProps {
  heroTitle: string;
  setHeroTitle: (value: string) => void;
  heroSubtitle: string;
  setHeroSubtitle: (value: string) => void;
  heroMsg: string;
  saveHeroSettings: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function HeroTab({
  heroTitle,
  setHeroTitle,
  heroSubtitle,
  setHeroSubtitle,
  heroMsg,
  saveHeroSettings,
}: HeroTabProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(8,20,52,0.92),rgba(4,12,32,0.95))] shadow-[0_24px_48px_rgba(1,5,18,0.55)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(10,86,198,0.9),transparent)]">
      {/* Section header — sky/blue accent */}
      <div className="border-b border-[var(--ui-primary)]/22 bg-[rgba(10,86,198,0.13)] px-6 py-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--ast-sky-text)]">Módulo 01</p>
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-black tracking-tight text-[var(--ui-text)]">
          Hero de Inicio
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--ast-sky)]/70">Título y subtítulo visibles en la portada pública.</p>
      </div>

      <div className="p-6">
        <form onSubmit={saveHeroSettings} className="max-w-2xl space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ast-sky-text)]/80">Título principal</label>
            <input
              type="text"
              placeholder="Domina nuevas habilidades en 5 días"
              className="w-full rounded-lg border border-[var(--ast-sky)]/22 bg-[rgba(3,12,34,0.75)] px-3 py-2.5 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-muted)]/35 focus:border-[var(--ast-sky)]/55 focus:outline-none focus:shadow-[0_0_0_3px_rgba(10,86,198,0.2)]"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ast-sky-text)]/80">Subtítulo</label>
            <textarea
              placeholder="Rutas prácticas de aprendizaje..."
              className="h-24 w-full resize-none rounded-lg border border-[var(--ast-sky)]/22 bg-[rgba(3,12,34,0.75)] px-3 py-2.5 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-muted)]/35 focus:border-[var(--ast-sky)]/55 focus:outline-none focus:shadow-[0_0_0_3px_rgba(10,86,198,0.2)]"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--ui-primary)]/70 bg-[rgba(10,86,198,0.38)] px-5 py-2.5 text-sm font-bold text-[var(--ast-sky)] shadow-[0_0_16px_rgba(10,86,198,0.22)] transition hover:bg-[rgba(10,86,198,0.52)] active:scale-[0.99]"
            >
              <span aria-hidden className="text-base leading-none">↑</span>
              Publicar Hero
            </button>
            {heroMsg && (
              <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ast-yellow)]">
                <span aria-hidden>◈</span> {heroMsg}
              </p>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
