import { createClient } from "@/utils/supabase/server"; // <--- CAMBIO A SERVER
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient(); // <--- AHORA ES ASYNC

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: labs } = await supabase.from("labs").select("*");

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-green-500/30">
      <nav className="p-6 max-w-7xl mx-auto flex justify-between items-center border-b border-white/5">
        <div className="text-2xl font-black tracking-tighter">
          LABS<span className="text-green-500">.</span>
        </div>
        <div className="flex gap-4 items-center">
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
            // El botón de Salir lo pondremos en el Admin para no complicar esta página
          )}
        </div>
      </nav>

      <header className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
          Domina nuevas habilidades en 5 días.
        </h1>
        <p className="text-gray-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
          Plataformas de aprendizaje diseñadas para la acción.
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-24">
        {user ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {labs?.map((lab) => (
              <Link
                key={lab.id}
                href={`/labs/${lab.id}`}
                className="group relative"
              >
                <div className="relative bg-[#0A0A0A] border border-white/10 p-8 rounded-2xl h-full flex flex-col justify-between hover:border-white/20 transition">
                  <div>
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-green-400 transition">
                      {lab.title}
                    </h3>
                    <p className="text-gray-500 leading-relaxed line-clamp-3">
                      {lab.description}
                    </p>
                  </div>
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-sm font-bold">
                    <span className="text-gray-600 uppercase">5 Módulos</span>
                    <span>Empezar →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-900/20 border border-dashed border-gray-800 rounded-3xl">
            <h2 className="text-xl font-bold mb-2">Contenido Exclusivo</h2>
            <Link
              href="/login"
              className="inline-block mt-4 border border-green-500 text-green-500 px-8 py-3 rounded-full font-bold"
            >
              Acceder a mis cursos
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
