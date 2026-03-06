"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";

type Totals = {
  shift_id: string;
  cash_total: number;
  card_total: number;
  transfer_total: number;
  qr_total: number;
  sales_count: number;
};

export default function CloseShiftPage() {
  const router = useRouter();

  const [branchId, setBranchId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);

  const [branchName, setBranchName] = useState<string>("");
  const [shiftOpenedAt, setShiftOpenedAt] = useState<string | null>(null);

  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const [confirmValue, setConfirmValue] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [openingCash, setOpeningCash] = useState<number>(0);
  const [expectedTotal, setExpectedTotal] = useState<number>(0);

  // ✅ toNum: maneja "5400.64" (interno) y "5.400,64" (colombiano)
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

  const formatShiftOpenedAt = (openedAt: string | null) => {
    if (!openedAt) return "Abierto -";
    const t = new Date(openedAt).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Abierto ${t}`;
  };

  const refreshTotals = async (sid: string) => {
    const { data, error } = await supabase.rpc("get_shift_totals", { p_shift_id: sid });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;

    setTotals({
      shift_id: row.shift_id,
      cash_total: Number(row.cash_total ?? 0),
      card_total: Number(row.card_total ?? 0),
      transfer_total: Number(row.transfer_total ?? 0),
      qr_total: Number(row.qr_total ?? 0),
      sales_count: Number(row.sales_count ?? 0),
    });

    const { data: sh, error: shErr } = await supabase
      .from("shifts")
      .select("opening_cash")
      .eq("id", sid)
      .single();

    if (shErr) throw new Error(shErr.message);

    setOpeningCash(Number(sh.opening_cash ?? 0));
    setExpectedTotal(Number(row.expected_total ?? 0));
  };

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");

      const id = localStorage.getItem("selected_branch_id");
      if (!id) return router.replace("/select-branch");
      setBranchId(id);

      const { data: branchRow } = await supabase
        .from("branches")
        .select("name")
        .eq("id", id)
        .maybeSingle();

      setBranchName(branchRow?.name ?? "");

      const { data: shift, error: shiftErr } = await supabase
        .from("shifts")
        .select("id,status,opened_at")
        .eq("branch_id", id)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shiftErr || !shift) return router.replace("/open-shift");
      setShiftId(shift.id);
      setShiftOpenedAt(shift.opened_at ?? null);

      await refreshTotals(shift.id);
      setLoading(false);
    };

    run().catch((e) => {
      setErr(e.message ?? "Error cargando turno.");
      setLoading(false);
    });
  }, [router]);

  const expected = useMemo(() => {
    return Math.round(Number(expectedTotal ?? 0) * 100) / 100;
  }, [expectedTotal]);

  const salesOnly = useMemo(() => {
    const v = Number(expectedTotal ?? 0) - Number(openingCash ?? 0);
    return Math.round(v * 100) / 100;
  }, [expectedTotal, openingCash]);

  const diff = useMemo(() => {
    const v = toNum(confirmValue);
    return Math.round((v - expected) * 100) / 100;
  }, [confirmValue, expected]);

  const diffOk = useMemo(() => diff === 0, [diff]);

  const closeShift = async () => {
    if (!shiftId) return;
    setErr(null);
    setOkMsg(null);
    setClosing(true);

    try {
      await refreshTotals(shiftId);

      const value = toNum(confirmValue);

      const { error } = await supabase.rpc("close_shift", {
        p_shift_id: shiftId,
        p_confirmed_total: value,
      });

      if (error) throw new Error(error.message);

      setOkMsg("Turno cerrado correctamente.");
      setClosing(false);

      setTimeout(() => router.replace("/pos"), 700);
    } catch (e: any) {
      setClosing(false);
      setErr(e.message ?? "No se pudo cerrar.");
    }
  };

  if (loading) return <LoadingCard title="Cargando POS..." />;
  if (err && !totals) return <div className="container py-6 text-red-600">Error: {err}</div>;
  if (!totals) return <div className="container py-6">Sin datos de turno.</div>;

  const diffLabel = diffOk ? "Cuadra" : diff > 0 ? "Sobra" : "Falta";

  return (
    <div className="container py-6">
      <PageShell
        title={
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">Cierre de turno</h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="badge">{branchName || "Sucursal"}</span>
                <span className="text-gray-300">•</span>
                <span className="badge">{formatShiftOpenedAt(shiftOpenedAt)}</span>
              </div>
            </div>

            <button className="btn" onClick={() => router.push("/pos")} disabled={closing}>
              Volver al POS
            </button>
          </div>
        }
      >
        <div className="mx-auto max-w-xl">
          <div className="card">
            <div className="card-h">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Total esperado (base + ventas del turno)</div>
                  <div className="mt-1 text-3xl font-extrabold tracking-tight">
                    ${expected.toLocaleString("es-CO")}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Base: <span className="font-bold text-gray-800">${openingCash.toLocaleString("es-CO")}</span>
                    {"  "}•{"  "}
                    Ventas turno:{" "}
                    <span className="font-bold text-gray-800">${salesOnly.toLocaleString("es-CO")}</span>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Ventas registradas:{" "}
                    <span className="font-bold text-gray-800">{totals.sales_count}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="text-xs font-semibold text-gray-500">Diferencia</div>
                  <div className={`mt-1 text-xl font-extrabold ${diffOk ? "text-emerald-600" : "text-red-600"}`}>
                    {diff.toLocaleString("es-CO")}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-gray-600">{diffLabel}</div>
                </div>
              </div>
            </div>

            <div className="card-b space-y-4">
              {/* Desglose (informativo) */}
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-extrabold">Ventas por método (informativo)</div>
                  <span className="badge">Auto</span>
                </div>

                <div className="space-y-2">
                  <Row label="Efectivo (CASH)" value={totals.cash_total} />
                  <Row label="Tarjeta" value={totals.card_total} />
                  <Row label="Transferencia" value={totals.transfer_total} />
                  <Row label="QR" value={totals.qr_total} />
                </div>
              </div>

              {/* Confirmación */}
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="text-sm font-extrabold">Confirmación</div>
                <div className="mt-1 text-xs text-gray-500">
                  Ingresa el <strong>total contado/registrado</strong> (base + ventas). Debe ser igual al esperado para cerrar.
                </div>

                <div className="mt-3 grid gap-2">
                  <label className="label">Total contado</label>
                  {/* ✅ CashInput con formato de miles + decimales */}
                  <CashInput
                    value={confirmValue}
                    setValue={setConfirmValue}
                    disabled={closing}
                    placeholder={expected.toLocaleString("es-CO")}
                  />
                </div>

                <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Esperado</span>
                    <span className="font-extrabold text-gray-900">${expected.toLocaleString("es-CO")}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">Contado</span>
                    <span className="font-extrabold text-gray-900">
                      ${toNum(confirmValue).toLocaleString("es-CO")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600">Diferencia</span>
                    <span className={`font-extrabold ${diffOk ? "text-emerald-600" : "text-red-600"}`}>
                      {diff.toLocaleString("es-CO")}
                    </span>
                  </div>
                </div>

                {!diffOk && (
                  <div className="mt-3 alert-err">
                    El valor contado no cuadra. Ajusta el valor para poder cerrar el turno.
                  </div>
                )}
              </div>

              {okMsg && <div className="alert-ok">{okMsg}</div>}
              {err && <div className="alert-err">{err}</div>}

              <div className="flex gap-2">
                <button className="btn flex-1" onClick={() => router.push("/pos")} disabled={closing}>
                  Cancelar
                </button>

                <button className="btn btn-primary flex-1" onClick={closeShift} disabled={closing || !diffOk}>
                  {closing ? "Cerrando..." : "Cerrar turno"}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                Recomendación: si no cuadra, revisa el conteo y las ventas del turno antes de cerrar.
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-extrabold text-gray-900">
        ${Number(value ?? 0).toLocaleString("es-CO")}
      </span>
    </div>
  );
}

// ✅ Input con separador de miles (puntos) y decimales con coma — formato colombiano
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
    const intFormatted = intPart ? Number(intPart).toLocaleString("es-CO") : "0";
    if (decPart !== undefined) return `${intFormatted},${decPart}`;
    return intFormatted;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
      .replace(/\./g, "")  // quita puntos de miles
      .replace(",", ".");  // coma → punto decimal interno
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