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

  return (
    <section className="space-y-4">
      <div className="z-20 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-[0_10px_24px_rgba(2,7,22,0.4)]">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-[300px] xl:w-[340px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-muted)]">
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
              className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] py-1.5 pl-9 pr-8 text-[13px] text-[var(--ui-text)] placeholder:text-[var(--ui-muted)] outline-none transition focus:border-[var(--ui-primary)]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[11px] text-[var(--ui-muted)] hover:bg-[rgba(185,214,254,0.12)]"
              >
                ×
              </button>
            )}
          </div>

          {showAccessFilter && (
            <select
              value={accessFilter}
              onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}
              className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-2.5 py-1.5 text-[13px] text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-primary)] lg:w-[145px]"
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
            className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-2.5 py-1.5 text-[13px] text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-primary)] lg:w-[160px]"
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
            className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-2.5 py-1.5 text-[13px] text-[var(--ui-text)] outline-none transition focus:border-[var(--ui-primary)] lg:w-[130px]"
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
            className="rounded-md border border-[var(--ui-border)] bg-[rgba(5,14,34,0.86)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--ui-text)] hover:bg-[rgba(185,214,254,0.12)] lg:w-[82px]"
          >
            Limpiar
          </button>

          <span className="text-xs text-[var(--ui-muted)] lg:ml-auto">
            {filteredLabs.length} {filteredLabs.length === 1 ? "lab" : "labs"}
          </span>
        </div>
      </div>

      {filteredLabs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 text-sm text-[var(--ui-muted)]">
          No hay labs con esos filtros. Prueba limpiar búsqueda o etiqueta.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredLabs.map((lab) => {
            const priceSummary = formatPriceSummary(lab.prices);
            const labHref = `/labs/${lab.slug ?? lab.id}`;
            const accentColor = normalizeAccentColor(lab.accentColor);
            const previewImage = lab.backgroundImageUrl || "/labs-people.bg.png";

            return (
              <article
                key={lab.id}
                className="relative overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-[0_14px_26px_rgba(2,7,22,0.42)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_36px_rgba(2,7,22,0.52)]"
              >
                <div
                  className="mb-4 h-28 rounded-xl border border-[var(--ui-border)] bg-cover bg-center"
                  style={{ backgroundImage: `url("${previewImage}")` }}
                />

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {lab.hasAccess ? (
                    <span className="rounded-full border border-[var(--ast-mint)]/45 bg-[rgba(4,164,90,0.18)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ast-mint)]">
                      Acceso activo
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--ast-coral)]/45 bg-[rgba(136,31,0,0.24)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ast-yellow)]">
                      Bloqueado
                    </span>
                  )}
                  {lab.labels.map((label) => (
                    <span
                      key={`${lab.id}-${label}`}
                      className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
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

                <h3 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-[var(--ui-text)]">
                  {lab.title}
                </h3>
                <p className="mt-2 h-[72px] overflow-hidden text-sm leading-relaxed text-[var(--ui-muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
                  {lab.description ?? "Sin descripción"}
                </p>

                <p className="mt-4 text-sm font-semibold" style={{ color: accentColor }}>
                  {priceSummary}
                </p>

                <div className="mt-5 space-y-2">
                  {lab.hasAccess ? (
                    <Link
                      href={labHref}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--ui-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--ast-atlantic)]"
                    >
                      Entrar
                    </Link>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 text-xs">
                        <Link
                          href={`${labHref}?day=1`}
                          className="text-[var(--ui-primary)] hover:text-[#1d4ed8]"
                        >
                          Ver Día 1
                        </Link>
                        {canUseCart ? (
                          <Link href="/cart" className="text-[var(--ui-accent)] hover:underline">
                            Ir al carrito
                          </Link>
                        ) : (
                          <Link href="/login" className="text-[var(--ui-accent)] hover:underline">
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

function normalizeAccentColor(color: string | null | undefined): string {
  if (!color) return "#2563EB";
  const value = color.trim();
  if (!/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value)) return "#2563EB";
  return value;
}
