import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import PaymentStatusNotice from "@/components/PaymentStatusNotice";
import CartNavLink from "@/components/CartNavLink";
import AddToCartButton from "@/components/AddToCartButton";
import LabsMarketplace, { type MarketplaceLab } from "@/components/LabsMarketplace";
import { getLabPalette } from "@/utils/labPalette";
import { resolveLabCardImage } from "@/utils/labCardImages";

type LabCard = {
  id: string;
  slug?: string | null;
  title: string;
  description: string | null;
  labels?: string[] | null;
  created_at: string | null;
  cover_image_url?: string | null;
  accent_color?: string | null;
  image_url?: string | null;
  background_image_url?: string | null;
};

type LabPrice = {
  lab_id: string;
  currency: "USD" | "MXN";
  amount_cents: number;
  is_active: boolean;
};

type SiteSettings = {
  hero_title: string | null;
  hero_subtitle: string | null;
};

const DEFAULT_HERO_TITLE = "Aprende, practica y ejecuta en días.";
const DEFAULT_HERO_SUBTITLE =
  "Explora rutas prácticas y desbloquea cada lab con tu acceso.";
const QUERY_TIMEOUT_MS = 3500;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; lab?: string; labs?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const showcaseClient = adminSupabase ?? supabase;

  const authResult = await safeQuery(supabase.auth.getUser(), "auth.getUser");
  const user = authResult?.data?.user ?? null;

  const profileResult = user
    ? await safeQuery(
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        "profiles.role",
      )
    : null;
  const profile = profileResult?.data ?? null;

  const isAdmin = profile?.role === "admin";

  const [showcaseLabsResult, activePriceRowsResult, settingsResult] = await Promise.all([
    safeQuery(
      showcaseClient
        .from("labs")
        .select("*")
        .order("created_at", { ascending: false }),
      "labs.list",
    ),
    safeQuery(
      showcaseClient
        .from("lab_prices")
        .select("lab_id, currency, amount_cents, is_active")
        .eq("is_active", true),
      "lab_prices.active",
    ),
    safeQuery(
      supabase
        .from("app_settings")
        .select("hero_title, hero_subtitle")
        .eq("id", 1)
        .maybeSingle(),
      "app_settings.hero",
    ),
  ]);

  const catalogLabs = showcaseLabsResult?.data ?? [];
  const activePriceRows = activePriceRowsResult?.data ?? [];
  const settings = settingsResult?.data ?? null;
  const pricesByLab = new Map<
    string,
    Array<{ currency: "USD" | "MXN"; amountCents: number }>
  >();

  for (const row of activePriceRows) {
    const list = pricesByLab.get(row.lab_id) ?? [];
    list.push({
      currency: row.currency,
      amountCents: row.amount_cents,
    });
    pricesByLab.set(row.lab_id, list);
  }

  let accessibleLabIds = new Set<string>();
  if (user && !isAdmin) {
    const entitlementsResult = await safeQuery(
      supabase
        .from("lab_entitlements")
        .select("lab_id")
        .eq("user_id", user.id)
        .eq("status", "active"),
      "lab_entitlements.active",
    );
    const entitlements = (entitlementsResult?.data ?? []) as Array<{
      lab_id: string | null;
    }>;

    accessibleLabIds = new Set(
      entitlements
        ?.map((row) => row.lab_id)
        .filter((id): id is string => typeof id === "string") ?? [],
    );
  }

  const marketplaceLabs: MarketplaceLab[] = catalogLabs.map((lab) => ({
    id: lab.id,
    slug: typeof lab.slug === "string" && lab.slug.trim() ? lab.slug.trim() : null,
    title: lab.title,
    description: lab.description,
    labels: normalizeLabLabels(lab.labels),
    createdAt: lab.created_at,
    backgroundImageUrl: resolveLabCardImage(lab),
    accentColor:
      typeof lab.accent_color === "string" && lab.accent_color.trim()
        ? lab.accent_color.trim()
        : null,
    hasAccess: isAdmin || (Boolean(user) && accessibleLabIds.has(lab.id)),
    prices: pricesByLab.get(lab.id) ?? [],
  }));

  const heroTitle = settings?.hero_title?.trim() || DEFAULT_HERO_TITLE;
  const heroSubtitle = settings?.hero_subtitle?.trim() || DEFAULT_HERO_SUBTITLE;
  const featuredLabs = [...marketplaceLabs]
    .sort((a, b) => getFeaturedScore(b) - getFeaturedScore(a))
    .slice(0, 3);
  const totalLabs = marketplaceLabs.length;
  const topCount = marketplaceLabs.filter((lab) => lab.labels.includes("TOP")).length;
  const newCount = marketplaceLabs.filter((lab) => lab.labels.includes("NEW")).length;

  const paymentSuccess = query.payment === "success";
  const paymentCancelled = query.payment === "cancelled";
  const paymentLabIds = parsePaymentLabIds(query.lab, query.labs);
  const clearedLabIds = paymentSuccess ? paymentLabIds : [];
  const paymentLabTitles = paymentLabIds
    .map((id) => catalogLabs.find((lab) => lab.id === id)?.title)
    .filter((title): title is string => Boolean(title));

  return (
    <div
      id="top"
      className="relative min-h-screen overflow-x-hidden bg-[var(--ui-bg)] text-[var(--ui-text)] selection:bg-[var(--ui-primary)]/25"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_4%_4%,rgba(37,99,235,0.16),transparent_26%),radial-gradient(circle_at_94%_8%,rgba(249,115,22,0.12),transparent_28%),linear-gradient(180deg,rgba(148,163,184,0.05),transparent_55%)]" />

      <nav className="sticky top-4 z-40 mx-4 mt-4 flex items-center justify-between rounded-2xl border border-[var(--ui-border)]/80 bg-[rgba(5,14,34,0.86)] px-4 py-3 shadow-[0_12px_28px_rgba(2,7,22,0.45)] backdrop-blur md:mx-auto md:max-w-7xl md:px-6">
        <Image
          src="/logo-astrolab-light.png"
          alt="Astrolab"
          width={168}
          height={31}
          className="h-6 w-auto md:h-7"
          priority
        />

        <div className="flex items-center gap-4">
          {!user ? (
            <Link
              href="/login"
              className="rounded-full bg-[var(--ui-accent)] px-5 py-2 text-sm font-semibold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)]"
            >
              Acceder
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              {!isAdmin && <CartNavLink />}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-semibold text-[var(--ui-secondary)] transition hover:text-[var(--ast-mint)]"
                >
                  Panel Admin
                </Link>
              )}
              <LogoutButton />
            </div>
          )}
        </div>
      </nav>

      <header className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-12 pt-10 md:px-6 md:pb-16 md:pt-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-secondary)]/90">
            Plataforma de aprendizaje aplicada
          </p>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[0.9] tracking-[-0.03em] text-[var(--ui-text)] md:text-7xl">
            {heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--ui-secondary)]/86 md:text-[1.05rem]">
            {heroSubtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#featured-labs"
              className="rounded-full bg-[var(--ui-primary)] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              Ver destacados
            </a>
            <a
              href="#catalogo-labs"
              className="rounded-full border border-[var(--ui-border)] px-6 py-2.5 text-sm font-semibold text-[var(--ui-text)] transition hover:bg-[rgba(185,214,254,0.12)]"
            >
              Explorar catálogo
            </a>
          </div>
          {!user && (
            <p className="mt-3 text-xs text-[var(--ui-muted)]">
              Explora previews y decide qué ruta desbloquear.
            </p>
          )}
          {user && !isAdmin && (
            <p className="mt-3 text-xs text-[var(--ui-muted)]">
              Tip: usa filtros y carrito para comprar más rápido.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:auto-rows-[108px]">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 shadow-[0_20px_40px_rgba(2,7,22,0.5)] sm:col-span-6 sm:row-span-2">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--ui-primary)]/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-[var(--ui-accent)]/10 blur-2xl" />

            <div className="relative flex h-full flex-col justify-between">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-secondary)]/82">
                  Labs activos
                </p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-black leading-none text-[var(--ui-text)]">
                    {totalLabs}
                  </p>
                  <p className="pb-1 text-sm text-[var(--ui-secondary)]/82">
                    catálogo vivo y en expansión
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-[var(--ui-border)] pt-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-secondary)]/82">
                    Día 1 gratis
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none text-[var(--ui-text)]">
                    {totalLabs}
                  </p>
                </div>
                <div className="min-w-0 border-l border-[var(--ui-border)] pl-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-secondary)]/82">
                    Rutas TOP
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none text-[var(--ui-text)]">
                    {topCount}
                  </p>
                </div>
                <div className="min-w-0 border-l border-[var(--ui-border)] pl-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ui-secondary)]/82">
                    Nuevos
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none text-[var(--ui-text)]">
                    {newCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 sm:col-span-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ui-secondary)]/82">
              Formato
            </p>
            <div className="mt-2">
              <p className="text-lg font-semibold text-[var(--ui-text)]">5 días por ruta</p>
              <p className="text-xs text-[var(--ui-secondary)]/82">micro‑bloques accionables</p>
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 sm:col-span-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ui-secondary)]/82">
              Comunidad
            </p>
            <div className="mt-2">
              <p className="text-lg font-semibold text-[var(--ui-text)]">Retos + foro</p>
              <p className="text-xs text-[var(--ui-secondary)]/82">aprendizaje colaborativo</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 sm:col-span-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ui-secondary)]/82">
              Acceso inicial
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--ui-text)]">
              Previsualización del Día 1 sin costo
            </p>
            <p className="text-xs text-[var(--ui-secondary)]/82">
              prueba el contenido antes de desbloquear la ruta completa
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-24 pt-4 md:px-6">
        {paymentCancelled && (
          <PaymentStatusNotice
            message={`Pago cancelado. Tu acceso sigue bloqueado${
              paymentLabTitles.length === 1
                ? ` para "${paymentLabTitles[0]}"`
                : paymentLabTitles.length > 1
                  ? ` para ${paymentLabTitles.length} labs`
                  : ""
            }.`}
          />
        )}

        {paymentSuccess && (
          <PaymentStatusNotice
            tone="success"
            clearCartLabIds={clearedLabIds}
            message={`Pago confirmado. ${
              paymentLabTitles.length > 0
                ? `Estamos activando acceso para: ${paymentLabTitles.join(", ")}.`
                : "Estamos activando tu acceso."
            }`}
          />
        )}

        {marketplaceLabs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface)] p-8 text-center">
            <h2 className="mb-2 text-xl font-bold text-[var(--ui-text)]">Sin Labs disponibles</h2>
            <p className="text-[var(--ui-muted)]">Aún no hay labs cargados en el sistema.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <section id="featured-labs" className="scroll-mt-24 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ast-sky)]/95">
                    Selección curada
                  </p>
                  <h2 className="mt-1 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold tracking-tight text-[var(--ui-text)]">
                    Destacados del mes
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ui-secondary)]/90">
                    Labs con mejor tracción y valor práctico inmediato.
                  </p>
                </div>
                <a
                  href="#catalogo-labs"
                  className="rounded-full border border-[var(--ui-border)] bg-[rgba(5,14,34,0.86)] px-4 py-1.5 text-xs font-semibold text-[var(--ui-text)] transition hover:border-[var(--ui-primary)] hover:bg-[rgba(185,214,254,0.12)]"
                >
                  Ver catálogo completo
                </a>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {featuredLabs.map((lab, index) => {
                  const priceSummary = formatPriceSummary(lab.prices);
                  const palette = getLabPalette(lab.id, lab.backgroundImageUrl, lab.accentColor);
                  const labHref = `/labs/${lab.slug ?? lab.id}`;
                  return (
                    <article
                      key={lab.id}
                      className="group relative overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 shadow-[0_14px_28px_rgba(2,7,22,0.45)] transition duration-300 hover:-translate-y-1"
                      style={{
                        borderColor: palette.borderColor,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60 blur-2xl"
                        style={{ background: palette.glowColor }}
                      />
                      <div className="relative">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="rounded-full border border-[var(--ui-accent)]/30 bg-[var(--ui-accent)]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ui-accent)]">
                            #{index + 1}
                          </span>
                          {lab.labels.map((label) => (
                            <span
                              key={`${lab.id}-featured-${label}`}
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

                        <h3 className="font-[family-name:var(--font-space-grotesk)] text-[1.8rem] font-bold leading-tight text-[var(--ui-text)]">
                          {lab.title}
                        </h3>
                        <p className="mt-3 h-[86px] overflow-hidden text-sm leading-relaxed text-[var(--ui-secondary)]/88 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
                          {lab.description ?? "Sin descripción"}
                        </p>
                        <p className="mt-4 text-sm font-bold" style={{ color: palette.accentColor }}>
                          {priceSummary}
                        </p>

                        <div className="mt-5 space-y-2">
                          {lab.hasAccess ? (
                            <Link
                              href={labHref}
                              className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--ui-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
                            >
                              Entrar al lab
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
                                {user && !isAdmin ? (
                                  <Link
                                    href="/cart"
                                    className="text-[var(--ui-accent)] hover:underline"
                                  >
                                    Ir al carrito
                                  </Link>
                                ) : (
                                  <Link
                                    href="/login"
                                    className="text-[var(--ui-accent)] hover:underline"
                                  >
                                    Acceder
                                  </Link>
                                )}
                              </div>
                              {user && !isAdmin && <AddToCartButton labId={lab.id} />}
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section id="catalogo-labs">
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ast-sky)]/95">
                  Biblioteca completa
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-tight text-[var(--ui-text)]">
                  Explora todos los labs
                </h2>
              </div>
              <LabsMarketplace
                labs={marketplaceLabs}
                isAuthenticated={Boolean(user)}
                isAdmin={isAdmin}
              />
            </section>
          </div>
        )}
      </main>

    </div>
  );
}

function parsePaymentLabIds(lab: string | undefined, labs: string | undefined): string[] {
  const ids = [
    ...(typeof lab === "string" && lab ? [lab] : []),
    ...((typeof labs === "string" && labs
      ? labs
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : []) as string[]),
  ];
  return Array.from(new Set(ids));
}

function normalizeLabLabels(labels: string[] | null | undefined): string[] {
  if (!Array.isArray(labels)) return [];
  return labels
    .map((label) => (typeof label === "string" ? label.trim().toUpperCase() : ""))
    .filter(Boolean)
    .slice(0, 4);
}

function getFeaturedScore(lab: MarketplaceLab): number {
  const labels = new Set(lab.labels);
  let score = 0;
  if (labels.has("TOP")) score += 12;
  if (labels.has("BEST SELLER")) score += 10;
  if (labels.has("NEW")) score += 8;
  if (lab.hasAccess) score += 1;
  return score;
}

function formatPriceSummary(
  prices: Array<{ currency: "USD" | "MXN"; amountCents: number }>,
): string {
  if (prices.length === 0) return "Precio no disponible";
  return [...prices]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((price) => formatMoney(price.amountCents, price.currency))
    .join(" · ");
}

function formatMoney(amountCents: number, currency: "USD" | "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

async function safeQuery<T>(operation: PromiseLike<T>, label: string): Promise<T | null> {
  try {
    return await withTimeout(Promise.resolve(operation), QUERY_TIMEOUT_MS);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[home] Query failed (${label})`, error);
    }
    return null;
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    Promise.resolve(promise)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
