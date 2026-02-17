import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type LabCard = {
  id: string;
  title: string;
  description: string | null;
};

type SiteSettings = {
  hero_title: string | null;
  hero_subtitle: string | null;
};

const DEFAULT_HERO_TITLE = "Aprende, practica y ejecuta en días.";
const DEFAULT_HERO_SUBTITLE =
  "Explora rutas prácticas y desbloquea cada lab con tu acceso.";

export default async function Home() {
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
  const { data: showcaseLabs } = (await showcaseClient
    .from("labs")
    .select("id, title, description")
    .order("created_at", { ascending: false })) as { data: LabCard[] | null };
  const catalogLabs = showcaseLabs ?? [];

  if (!user) {
    labs = catalogLabs;
  } else if (isAdmin) {
    labs = catalogLabs;
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

    if (labIds.length > 0) {
      const { data: paidLabs } = (await supabase
        .from("labs")
        .select("id, title, description")
        .in("id", labIds)
        .order("created_at", { ascending: false })) as { data: LabCard[] | null };
      labs = paidLabs ?? [];
    }
  }
  const { data: settings } = (await supabase
    .from("app_settings")
    .select("hero_title, hero_subtitle")
    .eq("id", 1)
    .maybeSingle()) as { data: SiteSettings | null };

  const heroTitle = settings?.hero_title?.trim() || DEFAULT_HERO_TITLE;
  const heroSubtitle = settings?.hero_subtitle?.trim() || DEFAULT_HERO_SUBTITLE;

  return (
    <div className="min-h-screen bg-[var(--ast-black)] text-[var(--ast-white)] selection:bg-[var(--ast-yellow)]/35">
      <nav className="p-6 max-w-7xl mx-auto flex justify-between items-center border-b border-white/10">
        <div className="text-2xl font-black tracking-tighter">
          ASTROLAB<span className="text-[var(--ast-coral)]">.</span>
        </div>
        <div className="flex gap-4 items-center">
          {!user ? (
            <>
              <Link
                href="/login"
                className="border border-white/25 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-white/10 transition"
              >
                Ingresar
              </Link>
              <Link
                href="/login"
                className="bg-[var(--ast-yellow)] text-[var(--ast-black)] px-6 py-2 rounded-full text-sm font-bold hover:opacity-90 transition"
              >
                Crear cuenta
              </Link>
            </>
          ) : (
            <div className="flex gap-6 items-center">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-[var(--ast-sky)] hover:text-[var(--ast-white)] transition"
                >
                  Panel Admin
                </Link>
              )}
              <LogoutButton />
            </div>
          )}
        </div>
      </nav>

      <header className="py-20 px-6 text-center max-w-5xl mx-auto">
        <div className="inline-flex px-4 py-1 rounded-full bg-[var(--ast-indigo)]/60 border border-[var(--ast-atlantic)] text-xs tracking-widest uppercase mb-6">
          Escaparate de Labs
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-[0.95]">
          {heroTitle}
        </h1>
        <p className="text-[#d4d4d4] text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed">
          {heroSubtitle}
        </p>
        {!user && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="bg-[var(--ast-yellow)] text-[var(--ast-black)] px-7 py-3 rounded-full text-sm font-bold hover:opacity-90 transition"
            >
              Crear cuenta
            </Link>
            <a
              href="#catalogo"
              className="border border-white/25 text-white px-7 py-3 rounded-full text-sm font-semibold hover:bg-white/10 transition"
            >
              Explorar Labs
            </a>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-24">
        {user ? (
          <div className="space-y-6">
            {!isAdmin && labs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center bg-black/20">
                <h2 className="text-xl font-bold mb-2">Sin Labs desbloqueados</h2>
                <p className="text-gray-400">
                  Tu cuenta aún no tiene acceso activo. Cuando compres un lab, aparecerá aquí.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {labs.map((lab) => (
              <Link
                key={lab.id}
                href={`/labs/${lab.id}`}
                className="group relative"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--ast-atlantic)] to-[var(--ast-emerald)] rounded-2xl blur opacity-0 group-hover:opacity-25 transition duration-500"></div>
                <div className="relative bg-black/40 border border-white/10 p-8 rounded-2xl h-full flex flex-col justify-between hover:border-[var(--ast-sky)]/40 transition">
                  <div>
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-[var(--ast-yellow)] transition">
                      {lab.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed line-clamp-3">
                      {lab.description}
                    </p>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-500 uppercase tracking-widest text-xs">
                      Ruta completa
                    </span>
                    <span className="flex items-center gap-2">
                      Empezar{" "}
                      <span className="group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <section id="catalogo">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--ast-yellow)]">
                    Descubre los Labs
                  </h2>
                  <p className="text-gray-300 text-sm">
                    Puedes explorar gratis el Día 1 de cada lab.
                  </p>
                </div>
              </div>

              {labs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-6 text-gray-300 bg-black/20">
                  No se pudieron cargar labs públicos. Revisa permisos de lectura o configura `SUPABASE_SERVICE_ROLE_KEY`.
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                {labs.map((lab) => (
                  <Link
                    key={lab.id}
                    href={`/labs/${lab.id}?day=1`}
                    className="snap-start min-w-[280px] max-w-[320px] w-[320px] rounded-2xl border border-white/10 bg-gradient-to-b from-[var(--ast-indigo)]/60 to-black/40 p-5 hover:border-[var(--ast-sky)]/50 transition"
                  >
                    <div className="flex gap-2 flex-wrap mb-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--ast-sky)]">
                        Vista previa
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--ast-emerald)]/30 text-[var(--ast-mint)] border border-[var(--ast-emerald)]/50">
                        Día 1 gratis
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{lab.title}</h3>
                    <p className="text-sm text-gray-300 line-clamp-3 mb-6">
                      {lab.description}
                    </p>
                    <div className="text-xs text-[var(--ast-yellow)] font-semibold">
                      Ver Día 1 →
                    </div>
                  </Link>
                ))}
                </div>
              )}
            </section>

            <section className="relative">
              <div className="hidden md:block absolute left-[16.66%] right-[16.66%] top-12 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 rounded-full border border-[var(--ast-yellow)]/50 bg-[var(--ast-indigo)]/50 flex items-center justify-center text-2xl font-black text-[var(--ast-yellow)]">
                    1
                  </div>
                  <p className="font-semibold mt-3">Explora el Día 1</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Mira el enfoque y nivel de cada lab.
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 rounded-full border border-[var(--ast-yellow)]/50 bg-[var(--ast-indigo)]/50 flex items-center justify-center text-2xl font-black text-[var(--ast-yellow)]">
                    2
                  </div>
                  <p className="font-semibold mt-3">Crea tu cuenta</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Guarda tu avance y participa en la comunidad.
                  </p>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="h-24 w-24 rounded-full border border-[var(--ast-yellow)]/50 bg-[var(--ast-indigo)]/50 flex items-center justify-center text-2xl font-black text-[var(--ast-yellow)]">
                    3
                  </div>
                  <p className="font-semibold mt-3">Desbloquea el lab completo</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Accede a todos los días y retos de la ruta.
                  </p>
                </div>
              </div>
            </section>

            <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
              <p className="text-sm text-gray-300">
                Nota: ¿Te gustó el preview? Desbloquea todos los días, retos y foro.
              </p>
              <Link
                href="/login"
                className="inline-block bg-[var(--ast-yellow)] text-[var(--ast-black)] px-6 py-2 rounded-full font-bold hover:opacity-90 transition"
              >
                Crear cuenta
              </Link>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
