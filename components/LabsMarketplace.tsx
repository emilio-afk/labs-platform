"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";

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

  const hasActiveFilters = query !== "" || selectedTag !== "ALL" || accessFilter !== "all" || sortMode !== "featured";

  return (
    <section className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 shadow-[0_10px_24px_rgba(2,7,22,0.4)]">
        {/* Row 1: search + sort + count */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-[340px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar labs, temas o etiquetas..."
              className="w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] py-2 pl-9 pr-8 text-[13px] text-[var(--ui-text)] placeholder:text-[var(--ui-muted)] outline-none transition focus:border-[var(--ui-primary)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {showAccessFilter && (
              <select
                value={accessFilter}
                onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}
                className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-2.5 py-2 text-[13px] text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-primary)]"
              >
                <option value="all">Acceso: Todos</option>
                <option value="active">Con acceso</option>
                <option value="blocked">Sin acceso</option>
              </select>
            )}

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-2.5 py-2 text-[13px] text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-primary)]"
            >
              <option value="featured">Destacados</option>
              <option value="newest">Más nuevos</option>
              <option value="price_asc">Precio ↑</option>
              <option value="price_desc">Precio ↓</option>
              <option value="title">Título A-Z</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedTag("ALL");
                  setAccessFilter("all");
                  setSortMode("featured");
                }}
                className="rounded-lg border border-[var(--ui-border)] bg-transparent px-3 py-2 text-[13px] text-[var(--ui-muted)] transition hover:border-[var(--ui-primary)]/50 hover:text-[var(--ui-text)]"
              >
                Limpiar
              </button>
            )}

            <span className="text-xs text-[var(--ui-muted)]">
              {filteredLabs.length} {filteredLabs.length === 1 ? "lab" : "labs"}
            </span>
          </div>
        </div>

        {/* Row 2: tag pills */}
        {tags.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {["ALL", ...tags].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`flex-shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all duration-150 ${
                  selectedTag === tag
                    ? "border-[var(--ui-primary)]/70 bg-[rgba(10,86,198,0.22)] text-[var(--ast-sky)]"
                    : "border-[var(--ui-border)]/60 bg-transparent text-[var(--ui-muted)] hover:border-[var(--ui-border)] hover:text-[var(--ui-text)]"
                }`}
              >
                {tag === "ALL" ? "Todas" : tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredLabs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-8 text-center text-sm text-[var(--ui-muted)]">
          No hay labs con esos filtros.{" "}
          <button
            type="button"
            onClick={() => { setQuery(""); setSelectedTag("ALL"); setAccessFilter("all"); setSortMode("featured"); }}
            className="text-[var(--ui-primary)] underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredLabs.map((lab) => {
            const priceSummary = formatPriceSummary(lab.prices);
            const labHref = `/labs/${lab.slug ?? lab.id}`;
            const accentColor = normalizeAccentColor(lab.accentColor);
            const previewImage = lab.backgroundImageUrl || "/labs-people.bg.png";

            return (
              <article
                key={lab.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_14px_26px_rgba(2,7,22,0.42)] transition duration-300 hover:-translate-y-1 hover:border-[var(--ui-border)]/80 hover:shadow-[0_22px_36px_rgba(2,7,22,0.52)]"
              >
                {/* Image with gradient fade */}
                <div className="relative h-40 overflow-hidden flex-shrink-0">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ backgroundImage: `url("${previewImage}")` }}
                  />
                  {/* Gradient fade into card bg */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--ui-surface)] via-[var(--ui-surface)]/30 to-transparent" />
                  {/* Access badge inside image */}
                  {lab.hasAccess && (
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ast-mint)]/50 bg-[rgba(4,164,90,0.82)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#d0fff0] backdrop-blur-sm">
                        <span className="text-[9px]">✓</span> Acceso activo
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5 pt-3">
                  {/* Labels */}
                  {lab.labels.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {lab.labels.map((label) => (
                        <span
                          key={`${lab.id}-${label}`}
                          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            borderColor: `${accentColor}55`,
                            backgroundColor: `${accentColor}14`,
                            color: accentColor,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  <h3 className="font-[family-name:var(--font-space-grotesk)] text-[1.35rem] font-bold leading-tight text-[var(--ui-text)]">
                    {lab.title}
                  </h3>
                  <p className="mt-2 flex-1 overflow-hidden text-sm leading-relaxed text-[var(--ui-muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                    {lab.description ?? "Sin descripción"}
                  </p>

                  <p className="mt-4 text-sm font-bold" style={{ color: accentColor }}>
                    {priceSummary}
                  </p>

                  {/* Actions */}
                  <div className="mt-4 space-y-2">
                    {lab.hasAccess ? (
                      <Link
                        href={labHref}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ui-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--ast-atlantic)] active:scale-[0.99]"
                      >
                        Entrar al lab
                        <span aria-hidden="true">→</span>
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`${labHref}?day=1`}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--ui-border)] bg-[rgba(77,163,255,0.07)] px-4 py-2.5 text-sm font-semibold text-[var(--ast-sky)] transition hover:border-[var(--ui-primary)]/55 hover:bg-[rgba(77,163,255,0.13)] active:scale-[0.99]"
                        >
                          Ver Día 1 gratis
                        </Link>
                        {canUseCart && <AddToCartButton labId={lab.id} />}
                        {!isAuthenticated && (
                          <Link
                            href="/login"
                            className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--ui-accent)]/40 bg-[rgba(4,164,90,0.1)] px-4 py-2 text-sm font-semibold text-[var(--ui-accent)] transition hover:bg-[rgba(4,164,90,0.18)] active:scale-[0.99]"
                          >
                            Acceder para comprar
                          </Link>
                        )}
                      </>
                    )}
                  </div>
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

function normalizeAccentColor(color: string | null | undefined): string {
  if (!color) return "#0a56c6";
  const value = color.trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value)) return "#0a56c6";
  return value;
}
