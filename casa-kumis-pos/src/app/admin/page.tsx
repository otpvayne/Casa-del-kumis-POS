"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";

type AdminItem = {
  title: string;
  desc: string;
  href: string;
  badge: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const res = await requireRole("ADMIN");
      if (!res.ok) {
        router.replace("/pos"); // o /login si prefieres
        return;
      }
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return <div className="container py-6">Cargando...</div>;

  const items: AdminItem[] = [
    {
      title: "Productos y precios",
      desc: "Crea productos, asigna precios por sucursal, activa/desactiva y favoritos.",
      href: "/admin/products",
      badge: "Catálogo",
    },
    {
      title: "Sucursales",
      desc: "Crea sucursales, edita nombre y activa/desactiva las sedes.",
      href: "/admin/branches",
      badge: "Operación",
    },
    {
      title: "Reportes",
      desc: "Ventas por cliente por mes, trimestre, semestre o año. Exportación a CSV.",
      href: "/admin/reports",
      badge: "Análisis",
    },
  ];

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">Panel de administración</h1>
            <div className="mt-1 text-sm text-gray-500">
              Gestiona el catálogo, las sucursales y revisa reportes.
            </div>
          </div>

          <button className="btn" onClick={() => router.push("/pos")}>
            Ir al POS
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {items.map((it) => (
            <button
              key={it.href}
              onClick={() => router.push(it.href)}
              className="card p-5 text-left hover:shadow-md transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-extrabold truncate">{it.title}</div>
                  <div className="mt-2 text-sm text-gray-600">{it.desc}</div>
                </div>

                <span className="badge">{it.badge}</span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-500">Abrir módulo</span>
                <span className="badge bg-gray-50">Continuar</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-extrabold">Recomendación</div>
          <div className="mt-1 text-sm text-gray-600">
            Para mantener el histórico, prioriza <span className="font-semibold">desactivar</span> (is_active)
            sobre eliminar registros.
          </div>
        </div>
      </div>
    </div>
  );
}
