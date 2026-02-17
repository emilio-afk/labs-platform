import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export default async function Home() {
  const supabase = createClient();

  // 1. Verificamos si hay usuario, pero NO redirigimos aquí
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: labs } = await supabase.from("labs").select("*");

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-green-500/30">
      {/* Navbar - Siempre visible */}
      <nav className="p-6 max-w-7xl mx-auto flex justify-between items-center border-b border-white/5">
        <div className="text-2xl font-black tracking-tighter">
          LABS<span className="text-green-500">.</span>
        </div>
        <div className="flex gap-6 items-center">
          {!user ? (
            <Link
              href="/login"
              className="bg-white text-black px-6 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition"
            >
              Ingresar
            </Link>
          ) : (
            <Link
              href="/admin"
              className="text-sm font-medium text-gray-400 hover:text-white transition"
            >
              Panel Admin
            </Link>
          )}
        </div>
      </nav>

      {/* Hero Section - Siempre visible (La "portada" que querías) */}
      <header className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
          Domina nuevas habilidades en 5 días.
        </h1>
        <p className="text-gray-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
          Plataformas de aprendizaje diseñadas para la acción. Sin rodeos,
          directo al grano.
        </p>
      </header>

      {/* SECCIÓN DINÁMICA: Solo se ven los labs si estás logueado */}
      <main className="max-w-7xl mx-auto px-6 pb-24">
        {user ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {labs?.map((lab) => (
              <Link
                key={lab.id}
                href={`/labs/${lab.id}`}
                className="group relative"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500"></div>
                <div className="relative bg-[#0A0A0A] border border-white/10 p-8 rounded-2xl h-full flex flex-col justify-between hover:border-white/20 transition">
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-green-400 transition">
                    {lab.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed line-clamp-3">
                    {lab.description}
                  </p>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-sm font-bold">
                    <span>5 MÓDULOS</span>
                    <span>Empezar →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Mensaje para los que no han iniciado sesión */
          <div className="text-center py-12 bg-gray-900/50 border border-dashed border-gray-800 rounded-3xl">
            <p className="text-gray-500 mb-6 text-lg">
              Inicia sesión para ver tus cursos disponibles y empezar el reto.
            </p>
            <Link
              href="/login"
              className="text-green-500 border border-green-500/30 px-8 py-3 rounded-full hover:bg-green-500/10 transition font-bold"
            >
              Crear cuenta gratuita
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
