import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/LogoutButton";
import PurchasePlaceholder from "@/components/PurchasePlaceholder";
import PaymentStatusNotice from "@/components/PaymentStatusNotice";

type LabCard = {
  id: string;
  title: string;
  description: string | null;
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
  searchParams: Promise<{ payment?: string; lab?: string }>;
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
  let labs: LabCard[] = [];
  let accessibleLabIds = new Set<string>();
  const { data: showcaseLabs } = (await showcaseClient
    .from("labs")
    .select("id, title, description")
    .order("created_at", { ascending: false })) as { data: LabCard[] | null };
  const { data: activePriceRows } = (await showcaseClient
    .from("lab_prices")
    .select("lab_id, currency, amount_cents, is_active")
    .eq("is_active", true)) as { data: LabPrice[] | null };
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

  if (!user) {
    labs = catalogLabs;
  } else if (isAdmin) {
    labs = catalogLabs;
    accessibleLabIds = new Set(catalogLabs.map((lab) => lab.id));
  } else {
    const { data: entitlements } = await supabase
      .from("lab_entitlements")
      .select("lab_id")
      .eq("user_id", user.id)
      .eq("status", "active");
    const labIds =
      entitlements
        ?.map((row) => row.lab_id)
        .filter((id): id is string => typeof id === "string") ?? [];
    accessibleLabIds = new Set(labIds);
    labs = catalogLabs;
  }
  const { data: settings } = (await supabase
    .from("app_settings")
    .select("hero_title, hero_subtitle")
    .eq("id", 1)
    .maybeSingle()) as { data: SiteSettings | null };

  const heroTitle = settings?.hero_title?.trim() || DEFAULT_HERO_TITLE;
  const heroSubtitle = settings?.hero_subtitle?.trim() || DEFAULT_HERO_SUBTITLE;
  const paymentCancelled = query.payment === "cancelled";
  const cancelledLabTitle =
    paymentCancelled && query.lab
      ? catalogLabs.find((lab) => lab.id === query.lab)?.title
      : null;

  return (
    <div className="relative min-h-screen bg-[var(--ast-black)] text-[var(--ast-white)] selection:bg-[var(--ast-mint)]/35 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(10,86,198,0.35),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(4,164,90,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(1,25,99,0.55),transparent_55%)]" />

      <nav className="relative p-6 max-w-7xl mx-auto flex justify-between items-center border-b border-[var(--ast-cobalt)]/35">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-astrolab-light.png"
            alt="Astrolab"
            width={168}
            height={31}
            className="h-8 md:h-9 w-auto"
            priority
          />
        </div>
        <div className="flex gap-4 items-center">
          {!user ? (
            <Link
              href="/login"
              className="bg-[var(--ast-mint)] text-[var(--ast-black)] px-6 py-2 rounded-full text-sm font-bold hover:bg-[var(--ast-forest)] transition"
            >
              Acceder
            </Link>
          ) : (
            <div className="flex gap-6 items-center">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-[var(--ast-sky)] hover:text-[var(--ast-mint)] transition"
                >
                  Panel Admin
                </Link>
              )}
              <LogoutButton />
            </div>
          )}
        </div>
      </nav>

      <header className="relative py-20 px-6 text-center max-w-5xl mx-auto">
        <div className="inline-flex px-4 py-1 rounded-full bg-[var(--ast-cobalt)]/35 border border-[var(--ast-sky)]/40 text-[var(--ast-sky)] text-xs tracking-widest uppercase mb-6">
          Escaparate de Labs
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[0.95] bg-gradient-to-r from-[var(--ast-sky)] via-[var(--ast-white)] to-[var(--ast-mint)] bg-clip-text text-transparent">
          {heroTitle}
        </h1>
        <p className="text-[var(--ast-bone)] text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed">
          {heroSubtitle}
        </p>
        {!user && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="bg-[var(--ast-mint)] text-[var(--ast-black)] px-7 py-3 rounded-full text-sm font-bold hover:bg-[var(--ast-forest)] transition"
            >
              Acceder
            </Link>
            <a
              href="#catalogo"
              className="border border-[var(--ast-sky)]/45 text-[var(--ast-sky)] px-7 py-3 rounded-full text-sm font-semibold hover:bg-[var(--ast-sky)]/10 transition"
            >
              Explorar Labs
            </a>
          </div>
        )}
      </header>

      <main className="relative max-w-7xl mx-auto px-6 pb-24">
        {paymentCancelled && (
          <PaymentStatusNotice
            message={`Pago cancelado. Tu acceso sigue bloqueado${cancelledLabTitle ? ` para "${cancelledLabTitle}"` : ""}.`}
          />
        )}
        {user ? (
          <div className="space-y-6">
            {!isAdmin && (
              <div className="rounded-xl border border-[var(--ast-sky)]/30 bg-[var(--ast-indigo)]/25 px-4 py-3 text-sm text-[var(--ast-bone)]/85">
                Tienes acceso completo a los labs marcados como activos. Los demás
                aparecen bloqueados con opción de pago.
              </div>
            )}
            {labs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--ast-sky)]/40 p-8 text-center bg-[var(--ast-indigo)]/30">
                <h2 className="text-xl font-bold mb-2">Sin Labs disponibles</h2>
                <p className="text-[var(--ast-bone)]/80">
                  Aún no hay labs cargados en el sistema.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {labs.map((lab) => {
                  const hasAccess = isAdmin || accessibleLabIds.has(lab.id);
                  if (hasAccess) {
                    return (
                      <Link key={lab.id} href={`/labs/${lab.id}`} className="group relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--ast-cobalt)] via-[var(--ast-sky)] to-[var(--ast-mint)] rounded-2xl blur opacity-0 group-hover:opacity-35 transition duration-500"></div>
                        <div className="relative bg-[linear-gradient(180deg,rgba(10,86,198,0.2),rgba(1,25,99,0.28))] border border-[var(--ast-sky)]/20 p-8 rounded-2xl h-full flex flex-col justify-between hover:border-[var(--ast-mint)]/55 transition">
                          <div>
                            <h3 className="text-2xl font-bold mb-3 group-hover:text-[var(--ast-mint)] transition">
                              {lab.title}
                            </h3>
                            <p className="text-[var(--ast-bone)]/80 leading-relaxed line-clamp-3">
                              {lab.description}
                            </p>
                          </div>
                          <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-sm font-bold">
                            <span className="text-[var(--ast-sky)]/70 uppercase tracking-widest text-xs">
                              Acceso activo
                            </span>
                            <span className="flex items-center gap-2">
                              Entrar{" "}
                              <span className="group-hover:translate-x-1 transition-transform">
                                →
                              </span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={lab.id}
                      className="relative bg-[linear-gradient(180deg,rgba(10,86,198,0.15),rgba(1,25,99,0.22))] border border-[var(--ast-sky)]/20 p-8 rounded-2xl h-full"
                    >
                      <div className="mb-3 inline-flex text-[10px] uppercase tracking-wider text-[var(--ast-yellow)] bg-[var(--ast-rust)]/50 border border-[var(--ast-coral)]/45 rounded-full px-2 py-1">
                        Bloqueado
                      </div>
                      <h3 className="text-2xl font-bold mb-3 text-[var(--ast-bone)]">
                        {lab.title}
                      </h3>
                      <p className="text-[var(--ast-bone)]/75 leading-relaxed line-clamp-3">
                        {lab.description}
                      </p>
                      <div className="mt-4">
                        <Link
                          href={`/labs/${lab.id}?day=1`}
                          className="text-xs text-[var(--ast-sky)] hover:text-[var(--ast-mint)]"
                        >
                          Ver preview del Día 1 →
                        </Link>
                      </div>
                      <PurchasePlaceholder
                        labId={lab.id}
                        labTitle={lab.title}
                        prices={pricesByLab.get(lab.id) ?? []}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <section id="catalogo">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--ast-mint)]">
                    Descubre los Labs
                  </h2>
                  <p className="text-[var(--ast-bone)]/85 text-sm">
                    Puedes explorar gratis el Día 1 de cada lab.
                  </p>
                </div>
              </div>

              {labs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--ast-sky)]/40 p-6 text-[var(--ast-bone)]/85 bg-[var(--ast-indigo)]/35">
                  No se pudieron cargar labs públicos. Revisa permisos de lectura o configura `SUPABASE_SERVICE_ROLE_KEY`.
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                {labs.map((lab) => (
                  <Link
                    key={lab.id}
                    href={`/labs/${lab.id}?day=1`}
                    className="snap-start min-w-[280px] max-w-[320px] w-[320px] rounded-2xl border border-[var(--ast-sky)]/20 bg-gradient-to-b from-[var(--ast-cobalt)]/40 to-[var(--ast-indigo)]/45 p-5 hover:border-[var(--ast-mint)]/60 transition"
                  >
                    <div className="flex gap-2 flex-wrap mb-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--ast-sky)]">
                        Vista previa
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--ast-mint)]/30 text-[var(--ast-bone)] border border-[var(--ast-mint)]/60">
                        Día 1 gratis
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{lab.title}</h3>
                    <p className="text-sm text-[var(--ast-bone)]/85 line-clamp-3 mb-6">
                      {lab.description}
                    </p>
                    <div className="text-xs text-[var(--ast-mint)] font-semibold">
                      Ver Día 1 →
                    </div>
                  </Link>
                ))}
                </div>
              )}
            </section>

            <section className="relative">
              <div className="hidden md:block absolute left-[16.66%] right-[16.66%] top-12 h-px bg-gradient-to-r from-transparent via-[var(--ast-sky)]/40 to-transparent" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 rounded-full border border-[var(--ast-sky)]/60 ring-4 ring-[var(--ast-black)] bg-[var(--ast-mint)] flex items-center justify-center text-2xl font-black text-[var(--ast-black)]">
                    1
                  </div>
                  <p className="font-semibold mt-3">Explora el Día 1</p>
                  <p className="text-sm text-[var(--ast-bone)]/80 mt-1">
                    Mira el enfoque y nivel de cada lab.
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 rounded-full border border-[var(--ast-sky)]/60 ring-4 ring-[var(--ast-black)] bg-[var(--ast-cobalt)] flex items-center justify-center text-2xl font-black text-[var(--ast-bone)]">
                    2
                  </div>
                  <p className="font-semibold mt-3">Crea tu cuenta</p>
                  <p className="text-sm text-[var(--ast-bone)]/80 mt-1">
                    Guarda tu avance y participa en la comunidad.
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 rounded-full border border-[var(--ast-sky)]/60 ring-4 ring-[var(--ast-black)] bg-[var(--ast-mint)] flex items-center justify-center text-2xl font-black text-[var(--ast-black)]">
                    3
                  </div>
                  <p className="font-semibold mt-3">Desbloquea el lab completo</p>
                  <p className="text-sm text-[var(--ast-bone)]/80 mt-1">
                    Accede a todos los días y retos de la ruta.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
