"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";

export default function OpenShiftPage() {
  const router = useRouter();

  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string>("");

  const [openingCash, setOpeningCash] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toNum = (v: string) => {
    if (!v) return 0;
    let cleaned = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  const prettyMoney = useMemo(() => {
    const n = toNum(openingCash);
    return n.toLocaleString("es-CO");
  }, [openingCash]);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      const id = localStorage.getItem("selected_branch_id");
      if (!id) {
        router.replace("/select-branch");
        return;
      }

      setBranchId(id);

      // traer nombre de sucursal (para no mostrar el UUID)
      const { data: br } = await supabase
        .from("branches")
        .select("name")
        .eq("id", id)
        .maybeSingle();

      setBranchName(br?.name ?? "");

      setLoading(false);
    };

    run().catch((e) => {
      setError(e.message ?? "Error cargando sucursal.");
      setLoading(false);
    });
  }, [router]);

  const openShift = async () => {
    if (!branchId) return;

    setSaving(true);
    setError(null);

    const cash = toNum(openingCash);
    if (Number.isNaN(cash) || cash < 0) {
      setSaving(false);
      setError("El monto inicial debe ser un número válido (0 o mayor).");
      return;
    }

    const { error } = await supabase.from("shifts").insert({
      branch_id: branchId,
      opening_cash: cash,
      status: "OPEN",
      expected_total: 0,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/pos");
  };

  if (loading) return <div className="container py-6">Cargando...</div>;

  return (
    <div className="container py-6">
      <PageShell
        title={
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">Abrir turno</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="badge">{branchName || "Sucursal"}</span>
                <span className="text-gray-300">•</span>
                <span className="badge">Inicio de caja</span>
              </div>
            </div>

            <button
              className="btn"
              onClick={() => router.replace("/pos")}
              disabled={saving}
              title="Volver al punto de venta"
            >
              Volver
            </button>
          </div>
        }
      >
        <div className="mx-auto max-w-md">
          <div className="card">
            <div className="card-h">
              <div className="text-sm text-gray-500">Antes de vender, registra el efectivo inicial de la caja.</div>
            </div>

            <div className="card-b space-y-4">
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-2 text-sm font-extrabold">Monto inicial</div>
                <div className="text-xs text-gray-500">
                  Este valor sirve como base para el arqueo al cerrar el turno.
                </div>

                <div className="mt-3 grid gap-2">
                  <label className="label">Efectivo en caja</label>
                  <input
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9.,]*"
                    placeholder="0"
                    disabled={saving}
                    className="input"
                  />
                  <div className="text-xs text-gray-500">
                    Vista previa: <span className="font-extrabold text-gray-900">${prettyMoney}</span>
                  </div>
                </div>

                {error && <div className="mt-3 alert-err">{error}</div>}
              </div>

              <div className="flex gap-2">
                <button className="btn flex-1" onClick={() => router.replace("/pos")} disabled={saving}>
                  Cancelar
                </button>
                <button className="btn btn-primary flex-1" onClick={openShift} disabled={saving}>
                  {saving ? "Abriendo..." : "Abrir turno"}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                Recomendación: cuenta el efectivo dos veces antes de abrir para evitar diferencias al cierre.
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </div>
  );
}
