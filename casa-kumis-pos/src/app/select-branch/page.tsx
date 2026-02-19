"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Branch = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function SelectBranchPage() {
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("branches")
        .select("id,name,is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setBranches(data ?? []);
      }

      setLoading(false);
    };

    run();
  }, [router]);

  const chooseBranch = (branchId: string) => {
    localStorage.setItem("selected_branch_id", branchId);
    router.replace("/pos");
  };

  const logout = async () => {
    setSigningOut(true);
    setError(null);

    const { error } = await supabase.auth.signOut();
    setSigningOut(false);

    if (error) {
      setError(error.message);
      return;
    }

    localStorage.removeItem("selected_branch_id");
    router.replace("/login");
  };

  if (loading) return <div className="container py-6">Cargando...</div>;
  if (error) return <div className="container py-6 text-red-600">Error: {error}</div>;

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-xl">
        <div className="card">
          <div className="card-h flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">
                Selecciona una sucursal
              </h1>
              <div className="mt-1 text-sm text-gray-500">
                Elige la sucursal donde vas a registrar las ventas.
              </div>
            </div>

            <button className="btn" onClick={logout} disabled={signingOut}>
              {signingOut ? "Saliendo..." : "Cerrar sesión"}
            </button>
          </div>

          <div className="card-b">
            {branches.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-extrabold">No hay sucursales disponibles</div>
                <div className="mt-1 text-sm text-gray-600">
                  No se encontraron sucursales activas. Pídele al administrador que active una sucursal.
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => chooseBranch(b.id)}
                    className="group card p-4 text-left hover:shadow-md transition active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-extrabold truncate">{b.name}</div>
                        <div className="mt-1 text-sm text-gray-500">
                          Presiona para continuar al punto de venta
                        </div>
                      </div>

                      <div className="badge group-hover:bg-gray-100 transition">
                        Continuar
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              Nota: la sucursal se guarda en este dispositivo hasta que cierres sesión.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
