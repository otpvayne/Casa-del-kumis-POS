"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";

export default function AdminSettingsPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // guardamos como porcentaje para UX (8.00)
  const [taxPct, setTaxPct] = useState<string>("8.00");

  const toNum = (v: string) => {
    if (!v) return 0;
    const cleaned = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  const pctValid = useMemo(() => {
    const n = toNum(taxPct);
    return n >= 0 && n <= 100;
  }, [taxPct]);

  useEffect(() => {
    const run = async () => {
      const res = await requireRole("ADMIN");
      if (!res.ok) {
        router.replace("/pos");
        return;
      }
      setLoadingAuth(false);

      // cargar valor actual
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "tax_rate")
        .single();

      if (error) throw new Error(error.message);

      const rate = Number(data?.value ?? "0"); // 0.08
      const pct = (rate * 100).toFixed(2);     // 8.00
      setTaxPct(pct);

      setLoading(false);
    };

    run().catch((e: any) => {
      setErr(e?.message ?? "Error cargando configuración.");
      setLoadingAuth(false);
      setLoading(false);
    });
  }, [router]);

  const save = async () => {
    setErr(null);
    setOk(null);

    const pct = toNum(taxPct);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setErr("El impuesto debe estar entre 0 y 100.");
      return;
    }

    const rate = Math.round((pct / 100) * 100000) / 100000; // 0.08 con redondeo
    setSaving(true);

    try {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: String(rate), updated_at: new Date().toISOString() })
        .eq("key", "tax_rate");

      if (error) throw new Error(error.message);

      setOk("Impuesto actualizado.");
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingAuth) return <div className="container py-6">Cargando...</div>;
  if (loading) return <div className="container py-6">Cargando configuración...</div>;
  if (err && !pctValid) return <div className="container py-6 text-red-600">Error: {err}</div>;

  return (
    <div className="container py-6">
      <PageShell
        title="Configuración"
        subtitle="Ajustes globales del sistema."
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={() => router.push("/admin")} disabled={saving}>
              Volver
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving || !pctValid}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        }
      >
        <div className="mx-auto max-w-xl">
          <div className="card">
            <div className="card-h">
              <div className="text-lg font-extrabold">Impuesto global</div>
              <div className="text-sm text-gray-600">
                Este porcentaje se aplica a todas las ventas del POS.
              </div>
            </div>

            <div className="card-b space-y-3">
              <label className="grid gap-1">
                <span className="label">Impuesto (%)</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={taxPct}
                  onChange={(e) => setTaxPct(e.target.value)}
                  placeholder="Ej: 8.00"
                  disabled={saving}
                />
              </label>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                Valor actual aplicado:{" "}
                <span className="font-extrabold text-gray-900">{toNum(taxPct).toFixed(2)}%</span>
              </div>

              {!pctValid && (
                <div className="alert-err">El impuesto debe estar entre 0 y 100.</div>
              )}

              {ok && <div className="alert-ok">{ok}</div>}
              {err && <div className="alert-err">{err}</div>}

              <div className="text-xs text-gray-500">
                Recomendación: si cambias el impuesto, aplica para ventas futuras (no modifica ventas ya registradas).
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </div>
  );
}