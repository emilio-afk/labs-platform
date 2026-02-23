"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";
import { getLabPalette } from "@/utils/labPalette";

type Currency = "USD" | "MXN";

export type MarketplaceLab = {
  id: string;
  slug?: string | null;
  title: string;
  description: string | null;
  labels: string[];
  createdAt: string | null;
  backgroundImageUrl?: string | null;
  accentColor?: string | null;
  hasAccess: boolean;
  prices: Array<{
    currency: Currency;
    amountCents: number;
  }>;
};

type LabsMarketplaceProps = {
  labs: MarketplaceLab[];
  isAuthenticated: boolean;
  isAdmin: boolean;
};

type SortMode = "featured" | "newest" | "price_asc" | "price_desc" | "title";
type AccessFilter = "all" | "active" | "blocked";

export default function LabsMarketplace({
  labs,
  isAuthenticated,
  isAdmin,
}: LabsMarketplaceProps) {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");

  const tags = useMemo(() => {
    return Array.from(
      new Set(
        labs.flatMap((lab) => lab.labels.map((label) => label.trim().toUpperCase())),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [labs]);

  const accessStats = useMemo(() => {
    const active = labs.filter((lab) => lab.hasAccess).length;
    const blocked = labs.length - active;
    return { active, blocked };
  }, [labs]);

  const showAccessFilter =
    !isAdmin && isAuthenticated && accessStats.active > 0 && accessStats.blocked > 0;
  const effectiveAccessFilter: AccessFilter = showAccessFilter ? accessFilter : "all";

  const filteredLabs = useMemo(() => {
    const text = query.trim().toLowerCase();

    const filtered = labs.filter((lab) => {
      if (selectedTag !== "ALL" && !lab.labels.includes(selectedTag)) return false;
      if (!isAdmin) {
        if (effectiveAccessFilter === "active" && !lab.hasAccess) return false;
        if (effectiveAccessFilter === "blocked" && lab.hasAccess) return false;
      }

      if (!text) return true;
      const haystack = `${lab.title} ${lab.description ?? ""} ${lab.labels.join(" ")}`.toLowerCase();
      return haystack.includes(text);
    });

    return filtered.sort((a, b) => compareLabs(a, b, sortMode));
  }, [labs, query, selectedTag, effectiveAccessFilter, sortMode, isAdmin]);

  const canUseCart = isAuthenticated && !isAdmin;

  return (
    <section className="space-y-4">
      <div className="z-20 rounded-xl border border-white/8 bg-[rgba(38,38,38,0.72)] p-2 shadow-[0_6px_18px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-[300px] xl:w-[340px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ast-bone)]/55">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar labs, temas o etiquetas..."
              className="w-full rounded-md border border-white/12 bg-white/[0.04] py-1 pl-9 pr-8 text-[13px] text-[var(--ast-bone)] placeholder:text-[var(--ast-bone)]/45 outline-none transition focus:border-white/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--ast-bone)]/70 hover:bg-white/10"
              >
                ×
              </button>
            )}
          </div>

          {showAccessFilter && (
            <select
              value={accessFilter}
              onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}
              className="w-full rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[13px] text-[var(--ast-bone)] outline-none transition focus:border-white/30 lg:w-[145px]"
              disabled={!isAuthenticated}
            >
              <option value="all">Acceso: Todos</option>
              <option value="active">Con acceso</option>
              <option value="blocked">Bloqueados</option>
            </select>
          )}

          <select
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            className="w-full rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[13px] text-[var(--ast-bone)] outline-none transition focus:border-white/30 lg:w-[160px]"
          >
            <option value="ALL">Etiqueta: Todas</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                Etiqueta: {tag}
              </option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="w-full rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[13px] text-[var(--ast-bone)] outline-none transition focus:border-white/30 lg:w-[130px]"
          >
            <option value="featured">Destacados</option>
            <option value="newest">Más nuevos</option>
            <option value="price_asc">Precio ↑</option>
            <option value="price_desc">Precio ↓</option>
            <option value="title">Título A-Z</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedTag("ALL");
              setAccessFilter("all");
              setSortMode("featured");
            }}
            className="rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[13px] font-semibold text-[var(--ast-bone)]/85 hover:bg-white/10 lg:w-[82px]"
          >
            Limpiar
          </button>

          <span className="text-xs text-[var(--ast-bone)]/60 lg:ml-auto">
            {filteredLabs.length} {filteredLabs.length === 1 ? "lab" : "labs"}
          </span>
        </div>
      </div>

      {filteredLabs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[var(--ast-bone)]/80">
          No hay labs con esos filtros. Prueba limpiar búsqueda o etiqueta.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredLabs.map((lab) => {
          const priceSummary = formatPriceSummary(lab.prices);
          const palette = getLabPalette(lab.id, lab.backgroundImageUrl, lab.accentColor);
          const labHref = `/labs/${lab.slug ?? lab.id}`;
          return (
            <article
              key={lab.id}
              className="relative rounded-2xl border p-6 transition duration-300 hover:-translate-y-1"
              style={{
                background: palette.cardBackground,
                borderColor: palette.borderColor,
                boxShadow: palette.outlineShadow,
              }}
            >
              <div className="mb-3 flex flex-wrap gap-1">
                {lab.hasAccess ? (
                  <span className="rounded-full border border-[var(--ast-mint)]/50 bg-[var(--ast-forest)]/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ast-mint)]">
                    Acceso activo
                  </span>
                ) : (
                  <span className="rounded-full border border-[var(--ast-coral)]/45 bg-[var(--ast-rust)]/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ast-yellow)]">
                    Bloqueado
                  </span>
                )}
                {lab.labels.map((label) => (
                  <span
                    key={`${lab.id}-${label}`}
                    className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      borderColor: palette.borderColor,
                      background: palette.chipBackground,
                      color: palette.chipTextColor,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <h3 className="text-3xl font-bold text-[var(--ast-bone)]">{lab.title}</h3>
              <p className="mt-3 h-[84px] overflow-hidden text-sm leading-relaxed text-[var(--ast-bone)]/75 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
                {lab.description ?? "Sin descripción"}
              </p>

              <p className="mt-4 text-sm font-semibold" style={{ color: palette.accentColor }}>
                {priceSummary}
              </p>

              <div className="mt-5 space-y-2">
                {lab.hasAccess ? (
                  <Link
                    href={labHref}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--ast-mint)] px-4 py-2 text-sm font-bold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)]"
                  >
                    Entrar
                  </Link>
                ) : (
                  <>
                    <div className="flex items-center gap-3 text-xs">
                      <Link
                        href={`${labHref}?day=1`}
                        className="text-[var(--ast-sky)] hover:text-[var(--ast-mint)]"
                      >
                        Ver Día 1
                      </Link>
                      {canUseCart ? (
                        <Link href="/cart" className="text-[var(--ast-mint)] hover:underline">
                          Ir al carrito
                        </Link>
                      ) : (
                        <Link href="/login" className="text-[var(--ast-mint)] hover:underline">
                          Acceder
                        </Link>
                      )}
                    </div>
                    {canUseCart && <AddToCartButton labId={lab.id} />}
                  </>
                )}
              </div>
            </article>
          );
        })}
        </div>
      )}
    </section>
  );
}

function compareLabs(a: MarketplaceLab, b: MarketplaceLab, sortMode: SortMode): number {
  if (sortMode === "title") return a.title.localeCompare(b.title);
  if (sortMode === "newest") {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  }

  if (sortMode === "price_asc" || sortMode === "price_desc") {
    const aPrice = getPrimaryPrice(a.prices)?.amountCents ?? Number.MAX_SAFE_INTEGER;
    const bPrice = getPrimaryPrice(b.prices)?.amountCents ?? Number.MAX_SAFE_INTEGER;
    return sortMode === "price_asc" ? aPrice - bPrice : bPrice - aPrice;
  }

  const aScore = getFeaturedScore(a);
  const bScore = getFeaturedScore(b);
  if (aScore !== bScore) return bScore - aScore;
  return a.title.localeCompare(b.title);
}

function getFeaturedScore(lab: MarketplaceLab): number {
  const labels = new Set(lab.labels);
  let score = 0;
  if (lab.hasAccess) score += 1;
  if (labels.has("TOP")) score += 8;
  if (labels.has("BEST SELLER")) score += 6;
  if (labels.has("NEW")) score += 4;
  return score;
}

function getPrimaryPrice(
  prices: Array<{ currency: Currency; amountCents: number }>,
): { currency: Currency; amountCents: number } | null {
  const usd = prices.find((price) => price.currency === "USD");
  if (usd) return usd;
  return prices[0] ?? null;
}

function formatPriceSummary(prices: Array<{ currency: Currency; amountCents: number }>): string {
  if (prices.length === 0) return "Precio no disponible";
  return [...prices]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((price) => formatMoney(price.amountCents, price.currency))
    .join(" · ");
}

function formatMoney(amountCents: number, currency: Currency): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}
