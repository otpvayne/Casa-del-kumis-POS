"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Totals = {
  shift_id: string;
  expected_total: number;
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

  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const [confirmValue, setConfirmValue] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const toNum = (v: string) => {
    if (!v) return 0;
    let cleaned = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  const refreshTotals = async (sid: string) => {
    const { data, error } = await supabase.rpc("get_shift_totals", { p_shift_id: sid });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    setTotals({
      shift_id: row.shift_id,
      expected_total: Number(row.expected_total ?? 0),
      cash_total: Number(row.cash_total ?? 0),
      card_total: Number(row.card_total ?? 0),
      transfer_total: Number(row.transfer_total ?? 0),
      qr_total: Number(row.qr_total ?? 0),
      sales_count: Number(row.sales_count ?? 0),
    });
  };

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");

      const id = localStorage.getItem("selected_branch_id");
      if (!id) return router.replace("/select-branch");
      setBranchId(id);

      const { data: shift, error: shiftErr } = await supabase
        .from("shifts")
        .select("id,status")
        .eq("branch_id", id)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shiftErr || !shift) return router.replace("/open-shift");
      setShiftId(shift.id);

      await refreshTotals(shift.id);

      setLoading(false);
    };

    run().catch((e) => {
      setErr(e.message ?? "Error cargando turno.");
      setLoading(false);
    });
  }, [router]);

  const expected = useMemo(() => totals?.expected_total ?? 0, [totals]);

  // ✅ NUEVO: diferencia en vivo (confirmado - esperado)
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
      // refrescar antes de cerrar (por si hubo ventas recientes)
      await refreshTotals(shiftId);

      const value = toNum(confirmValue);

      const { error } = await supabase.rpc("close_shift", {
        p_shift_id: shiftId,
        p_confirmed_total: value,
      });

      if (error) throw new Error(error.message);

      setOkMsg("Turno cerrado ✅");
      setClosing(false);

      // volver al POS (o a una pantalla de apertura si prefieres)
      setTimeout(() => router.replace("/pos"), 800);
    } catch (e: any) {
      setClosing(false);
      setErr(e.message ?? "No se pudo cerrar.");
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando cierre de turno...</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>Error: {err}</div>;
  if (!totals) return <div style={{ padding: 24 }}>Sin datos de turno.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Cerrar turno</h1>

        {/* ✅ NUEVO: volver sin cerrar */}
        <button
          onClick={() => router.push("/pos")}
          disabled={closing}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            cursor: "pointer",
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 800,
          }}
        >
          Volver al POS
        </button>
      </div>

      <p style={{ opacity: 0.7 }}>Sucursal: {branchId}</p>
      <p style={{ opacity: 0.7 }}>Turno: {shiftId}</p>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, marginTop: 12 }}>
        <h3>Total esperado según ventas</h3>
        <div style={{ fontSize: 28, fontWeight: 800 }}>
          ${expected.toLocaleString("es-CO")}
        </div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>Ventas registradas: {totals.sales_count}</div>

        <hr style={{ margin: "12px 0" }} />

        <div style={{ display: "grid", gap: 6 }}>
          <Row label="Efectivo" value={totals.cash_total} />
          <Row label="Tarjeta" value={totals.card_total} />
          <Row label="Transferencia" value={totals.transfer_total} />
          <Row label="QR" value={totals.qr_total} />
        </div>

        <hr style={{ margin: "12px 0" }} />

        <label style={{ display: "block" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Confirma el total esperado (debe ser igual)
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9.,]*"
            value={confirmValue}
            onChange={(e) => setConfirmValue(e.target.value)}
            placeholder={`Ej: ${expected.toLocaleString("es-CO")}`}
            disabled={closing}
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        {/* ✅ NUEVO: diferencia en vivo (tipo Siigo) */}
        <div style={{ marginTop: 10, opacity: 0.9 }}>
          Diferencia:{" "}
          <strong style={{ color: diffOk ? "green" : "red" }}>
            {diff.toLocaleString("es-CO")}
          </strong>
        </div>

        {okMsg && <div style={{ marginTop: 10, color: "green" }}>{okMsg}</div>}
        {err && <div style={{ marginTop: 10, color: "red" }}>{err}</div>}

        <button
          onClick={closeShift}
          disabled={closing || !diffOk}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 12,
            borderRadius: 12,
            cursor: closing || !diffOk ? "not-allowed" : "pointer",
            fontWeight: 800,
            opacity: closing || !diffOk ? 0.6 : 1,
          }}
        >
          {closing ? "Cerrando..." : !diffOk ? "El valor no cuadra" : "Cerrar turno"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <strong>${Number(value ?? 0).toLocaleString("es-CO")}</strong>
    </div>
  );
}
