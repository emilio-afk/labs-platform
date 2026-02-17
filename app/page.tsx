import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export default async function Home() {
  const supabase = createClient();
  const { data: labs } = await supabase.from("labs").select("*");

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-green-500/30">
      {/* Navbar Minimalista */}
      <nav className="p-6 max-w-7xl mx-auto flex justify-between items-center border-b border-white/5">
        <div className="text-2xl font-black tracking-tighter">
          LABS<span className="text-green-500">.</span>
        </div>
        <div className="flex gap-6 items-center">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-400 hover:text-white transition"
          >
            Ingresar
          </Link>
          <Link
            href="/admin"
            className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-200 transition"
          >
            Panel
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="py-24 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
          Domina nuevas habilidades en 5 días.
        </h1>
        <p className="text-gray-400 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
          Plataformas de aprendizaje diseñadas para la acción. Sin rodeos,
          directo al grano.
        </p>
      </header>

      {/* Grid de Labs */}
      <main className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {labs?.map((lab) => (
            <Link
              key={lab.id}
              href={`/labs/${lab.id}`}
              className="group relative"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition duration-500"></div>
              <div className="relative bg-[#0A0A0A] border border-white/10 p-8 rounded-2xl h-full flex flex-col justify-between hover:border-white/20 transition">
                <div>
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-green-400 transition">
                    {lab.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed line-clamp-3">
                    {lab.description}
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                  <span className="text-xs uppercase tracking-widest font-bold text-gray-600">
                    5 Módulos
                  </span>
                  <div className="text-sm font-bold flex items-center gap-2">
                    Empezar{" "}
                    <span className="group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
