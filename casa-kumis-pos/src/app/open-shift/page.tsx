"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";

export default function OpenShiftPage() {
  const router = useRouter();

  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string>("");

  const [openingCash, setOpeningCash] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ toNum actualizado: maneja tanto "5400.64" como "5.400,64"
  const toNum = (v: string) => {
    if (!v) return 0;
    if (v.includes(",")) {
      const cleaned = v.replace(/\./g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isNaN(n) ? 0 : n;
    }
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  };

  const prettyMoney = useMemo(() => {
    const n = toNum(openingCash);
    if (!n) return "0";
    return n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }, [openingCash]);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }

      const id = localStorage.getItem("selected_branch_id");
      if (!id) { router.replace("/select-branch"); return; }

      setBranchId(id);

      const { data: br } = await supabase.from("branches").select("name").eq("id", id).maybeSingle();
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
      expected_total: cash,
    });

    setSaving(false);

    if (error) { setError(error.message); return; }

    router.replace("/pos");
  };

  if (loading) return <LoadingCard title="Cargando POS..." />;

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

            <button className="btn" onClick={() => router.replace("/pos")} disabled={saving}>
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
                  Este valor se suma a todas las ventas del turno para el cierre.
                </div>

                <div className="mt-3 grid gap-2">
                  <label className="label">Efectivo en caja</label>

                  {/* ✅ CashInput con formato de miles + decimales */}
                  <CashInput value={openingCash} setValue={setOpeningCash} disabled={saving} />

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

// ✅ Input con separador de miles (puntos) y decimales con coma
function CashInput({
  value,
  setValue,
  disabled,
  placeholder = "0",
}: {
  value: string;
  setValue: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const formatDisplay = (raw: string) => {
    if (!raw) return "";

    const withDot = raw.replace(",", ".");
    const [intPart, decPart] = withDot.split(".");

    const intFormatted = intPart
      ? Number(intPart).toLocaleString("es-CO")
      : "0";

    if (decPart !== undefined) return `${intFormatted},${decPart}`;
    return intFormatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
      .replace(/\./g, "")   // quita puntos de miles
      .replace(",", ".");   // coma → punto decimal interno

    if (!/^\d*\.?\d{0,2}$/.test(raw)) return;

    setValue(raw);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={formatDisplay(value)}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className="input"
    />
  );
}