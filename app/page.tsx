import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import PaymentStatusNotice from "@/components/PaymentStatusNotice";
import CartNavLink from "@/components/CartNavLink";
import AddToCartButton from "@/components/AddToCartButton";
import LabsMarketplace, { type MarketplaceLab } from "@/components/LabsMarketplace";

type LabCard = {
  id: string;
  title: string;
  description: string | null;
  labels?: string[] | null;
  created_at: string | null;
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; lab?: string; labs?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const showcaseClient = adminSupabase ?? supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const isAdmin = profile?.role === "admin";

  const { data: showcaseLabs } = (await showcaseClient
    .from("labs")
    .select("*")
    .order("created_at", { ascending: false })) as { data: LabCard[] | null };

  const { data: activePriceRows } = (await showcaseClient
    .from("lab_prices")
    .select("lab_id, currency, amount_cents, is_active")
    .eq("is_active", true)) as { data: LabPrice[] | null };

  const { data: settings } = (await supabase
    .from("app_settings")
    .select("hero_title, hero_subtitle")
    .eq("id", 1)
    .maybeSingle()) as { data: SiteSettings | null };

  const catalogLabs = showcaseLabs ?? [];
  const pricesByLab = new Map<
    string,
    Array<{ currency: "USD" | "MXN"; amountCents: number }>
  >();

  for (const row of activePriceRows ?? []) {
    const list = pricesByLab.get(row.lab_id) ?? [];
    list.push({
      currency: row.currency,
      amountCents: row.amount_cents,
    });
    pricesByLab.set(row.lab_id, list);
  }

  let accessibleLabIds = new Set<string>();
  if (user && !isAdmin) {
    const { data: entitlements } = await supabase
      .from("lab_entitlements")
      .select("lab_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    accessibleLabIds = new Set(
      entitlements
        ?.map((row) => row.lab_id)
        .filter((id): id is string => typeof id === "string") ?? [],
    );
  }

  const marketplaceLabs: MarketplaceLab[] = catalogLabs.map((lab) => ({
    id: lab.id,
    title: lab.title,
    description: lab.description,
    labels: normalizeLabLabels(lab.labels),
    createdAt: lab.created_at,
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
    <div className="relative min-h-screen overflow-hidden bg-[var(--ast-black)] text-[var(--ast-white)] selection:bg-[var(--ast-mint)]/35">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,86,198,0.35),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(4,164,90,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(1,25,99,0.55),transparent_55%)]" />

      <nav className="relative mx-auto flex max-w-7xl items-center justify-between border-b border-[var(--ast-cobalt)]/35 px-6 py-3">
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
              className="rounded-full bg-[var(--ast-mint)] px-5 py-1.5 text-sm font-bold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)]"
            >
              Acceder
            </Link>
          ) : (
            <div className="flex items-center gap-4">
              {!isAdmin && <CartNavLink />}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-[var(--ast-sky)] transition hover:text-[var(--ast-mint)]"
                >
                  Panel Admin
                </Link>
              )}
              <LogoutButton />
            </div>
          )}
        </div>
      </nav>

      <header className="relative mx-auto grid max-w-7xl gap-7 px-6 pb-8 pt-6 md:grid-cols-[1.04fr_0.96fr] md:items-center">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-[var(--ast-sky)]/40 bg-[var(--ast-cobalt)]/28 px-4 py-1 text-[11px] uppercase tracking-[0.15em] text-[var(--ast-sky)]/90">
            Escaparate de Labs
          </div>
          <h1 className="mb-4 max-w-4xl bg-gradient-to-r from-[var(--ast-sky)] via-[var(--ast-white)] to-[var(--ast-mint)] bg-clip-text text-5xl font-black leading-[0.95] tracking-tight text-transparent md:text-7xl">
            {heroTitle}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--ast-bone)] md:text-[1.05rem]">
            {heroSubtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="#featured-labs"
              className="rounded-full bg-[var(--ast-mint)] px-6 py-2.5 text-sm font-bold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)]"
            >
              Ver destacados
            </a>
            <a
              href="#catalogo-labs"
              className="rounded-full border border-[var(--ast-sky)]/45 px-6 py-2.5 text-sm font-semibold text-[var(--ast-sky)] transition hover:bg-[var(--ast-sky)]/10"
            >
              Explorar catálogo
            </a>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--ast-sky)]/35 bg-[var(--ast-cobalt)]/20 px-3 py-1 text-xs text-[var(--ast-bone)]/85">
              Día 1 gratis
            </span>
            <span className="rounded-full border border-[var(--ast-sky)]/30 bg-black/20 px-3 py-1 text-xs text-[var(--ast-bone)]/75">
              {totalLabs} labs activos
            </span>
            <span className="rounded-full border border-[var(--ast-sky)]/30 bg-black/20 px-3 py-1 text-xs text-[var(--ast-bone)]/75">
              {topCount} top curados
            </span>
          </div>
          {!user && (
            <p className="mt-3 text-xs text-[var(--ast-bone)]/60">
              Explora previews y decide qué ruta desbloquear.
            </p>
          )}
          {user && !isAdmin && (
            <p className="mt-3 text-xs text-[var(--ast-bone)]/65">
              Tip: usa filtros y carrito para comprar más rápido.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 sm:auto-rows-[108px]">
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(10,86,198,0.34),rgba(1,25,99,0.30),rgba(38,38,38,0.34))] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:col-span-6 sm:row-span-2">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--ast-mint)]/12 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-[var(--ast-sky)]/12 blur-2xl" />

            <div className="relative flex h-full flex-col justify-between">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ast-sky)]/80">
                  Labs activos
                </p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-black leading-none">{totalLabs}</p>
                  <p className="pb-1 text-sm text-[var(--ast-bone)]/75">
                    catálogo vivo y en expansión
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ast-sky)]/70">
                    Día 1 gratis
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none text-[var(--ast-bone)]">
                    {totalLabs}
                  </p>
                </div>
                <div className="min-w-0 border-l border-white/10 pl-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ast-sky)]/70">
                    Rutas TOP
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none text-[var(--ast-bone)]">
                    {topCount}
                  </p>
                </div>
                <div className="min-w-0 border-l border-white/10 pl-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ast-sky)]/70">
                    Nuevos
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none text-[var(--ast-bone)]">
                    {newCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(160deg,rgba(10,86,198,0.24),rgba(1,25,99,0.18))] px-4 py-3 sm:col-span-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ast-sky)]/75">
              Formato
            </p>
            <div className="mt-2">
              <p className="text-lg font-semibold text-[var(--ast-bone)]/95">5 días por ruta</p>
              <p className="text-xs text-[var(--ast-bone)]/72">micro‑bloques accionables</p>
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(160deg,rgba(4,164,90,0.18),rgba(1,25,99,0.14))] px-4 py-3 sm:col-span-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ast-sky)]/75">
              Comunidad
            </p>
            <div className="mt-2">
              <p className="text-lg font-semibold text-[var(--ast-bone)]/95">Retos + foro</p>
              <p className="text-xs text-[var(--ast-bone)]/72">aprendizaje colaborativo</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-[linear-gradient(155deg,rgba(10,86,198,0.18),rgba(38,38,38,0.20))] px-4 py-3 sm:col-span-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ast-sky)]/75">
              Acceso inicial
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--ast-bone)]/95">
              Previsualización del Día 1 sin costo
            </p>
            <p className="text-xs text-[var(--ast-bone)]/70">
              prueba el contenido antes de desbloquear la ruta completa
            </p>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-6 pb-24">
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
          <div className="rounded-2xl border border-dashed border-[var(--ast-sky)]/40 bg-[var(--ast-indigo)]/30 p-8 text-center">
            <h2 className="mb-2 text-xl font-bold">Sin Labs disponibles</h2>
            <p className="text-[var(--ast-bone)]/80">Aún no hay labs cargados en el sistema.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <section id="featured-labs" className="scroll-mt-24 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ast-sky)]/75">
                    Selección curada
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-[var(--ast-mint)]">
                    Destacados del mes
                  </h2>
                  <p className="mt-1 text-sm text-[var(--ast-bone)]/65">
                    Labs con mejor tracción y valor práctico inmediato.
                  </p>
                </div>
                <a
                  href="#catalogo-labs"
                  className="rounded-full border border-[var(--ast-sky)]/35 px-4 py-1.5 text-xs font-semibold text-[var(--ast-sky)] transition hover:bg-[var(--ast-sky)]/10"
                >
                  Ver catálogo completo
                </a>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {featuredLabs.map((lab, index) => {
                  const priceSummary = formatPriceSummary(lab.prices);
                  return (
                    <article
                      key={lab.id}
                      className="group relative overflow-hidden rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(180deg,rgba(10,86,198,0.28),rgba(1,25,99,0.30))] p-6 transition duration-300 hover:-translate-y-1 hover:border-[var(--ast-sky)]/45"
                    >
                      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--ast-mint)]/10 blur-2xl" />
                      <div className="relative">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="rounded-full border border-[var(--ast-yellow)]/45 bg-[var(--ast-rust)]/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ast-yellow)]">
                            #{index + 1}
                          </span>
                          {lab.labels.map((label) => (
                            <span
                              key={`${lab.id}-featured-${label}`}
                              className="rounded-full border border-[var(--ast-sky)]/40 bg-[var(--ast-cobalt)]/35 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ast-sky)]"
                            >
                              {label}
                            </span>
                          ))}
                        </div>

                        <h3 className="text-[2rem] font-black leading-tight text-[var(--ast-bone)]">
                          {lab.title}
                        </h3>
                        <p className="mt-3 min-h-[48px] text-sm leading-relaxed text-[var(--ast-bone)]/78">
                          {lab.description ?? "Sin descripción"}
                        </p>
                        <p className="mt-4 text-sm font-bold text-[var(--ast-sky)]">
                          {priceSummary}
                        </p>

                        <div className="mt-5 space-y-2">
                          {lab.hasAccess ? (
                            <Link
                              href={`/labs/${lab.id}`}
                              className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--ast-mint)] px-4 py-2 text-sm font-bold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)]"
                            >
                              Entrar al lab
                            </Link>
                          ) : (
                            <>
                              <div className="flex items-center gap-3 text-xs">
                                <Link
                                  href={`/labs/${lab.id}?day=1`}
                                  className="text-[var(--ast-sky)] hover:text-[var(--ast-mint)]"
                                >
                                  Ver Día 1
                                </Link>
                                {user && !isAdmin ? (
                                  <Link
                                    href="/cart"
                                    className="text-[var(--ast-mint)] hover:underline"
                                  >
                                    Ir al carrito
                                  </Link>
                                ) : (
                                  <Link
                                    href="/login"
                                    className="text-[var(--ast-mint)] hover:underline"
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
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ast-sky)]/75">
                  Biblioteca completa
                </p>
                <h2 className="mt-1 text-xl font-black">Explora todos los labs</h2>
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
