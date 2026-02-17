"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Granularity = "MONTH" | "QUARTER" | "SEMESTER" | "YEAR";

type ReportRow = {
  period_start: string; // date
  period_label: string;
  identification: string;
  branch_id: string;
  sucursal: string;
  cliente: string;
  valor_bruto: number;
  subtotal: number;
  impuesto: number;
  total: number;
};

export default function SalesByCustomerReportPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [from, setFrom] = useState<string>(() => {
    // default: primer día del mes actual
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });

  const [to, setTo] = useState<string>(() => {
    // default: hoy
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const [granularity, setGranularity] = useState<Granularity>("MONTH");
  const [rows, setRows] = useState<ReportRow[]>([]);

  // ✅ Auth guard + Admin guard (profiles.role)
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      const userId = data.session.user.id;

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (profErr) {
        setErr(profErr.message);
        setLoadingAuth(false);
        return;
      }

      const role = String(prof?.role ?? "").toLowerCase();
      const admin = role === "admin";

      setIsAdmin(admin);
      setLoadingAuth(false);

      // si no es admin, lo saco (UX)
      if (!admin) {
        router.replace("/pos");
        return;
      }
    };

    run();
  }, [router]);

  const fetchReport = async () => {
    setErr(null);
    setLoading(true);
    setRows([]);

    try {
      // 🔒 extra guard (por si alguien intenta disparar sin ser admin)
      if (!isAdmin) throw new Error("No autorizado.");

      // Validaciones rápidas
      if (!from || !to) throw new Error("Debes seleccionar fechas Desde/Hasta.");
      if (from > to) throw new Error("La fecha 'Desde' no puede ser mayor que 'Hasta'.");

      const { data, error } = await supabase.rpc("get_sales_report_by_customer", {
        p_from: from,
        p_to: to,
        p_granularity: granularity,
      });

      if (error) throw new Error(error.message);

      const mapped: ReportRow[] = (data ?? []).map((r: any) => ({
        period_start: String(r.period_start),
        period_label: String(r.period_label),
        identification: String(r.identification),
        branch_id: String(r.branch_id),
        sucursal: String(r.sucursal),
        cliente: String(r.cliente),
        valor_bruto: Number(r.valor_bruto ?? 0),
        subtotal: Number(r.subtotal ?? 0),
        impuesto: Number(r.impuesto ?? 0),
        total: Number(r.total ?? 0),
      }));

      setRows(mapped);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setErr(e.message ?? "Error cargando reporte.");
    }
  };

  // ✅ Totales para mostrar al final
  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => {
        acc.valor_bruto += r.valor_bruto;
        acc.subtotal += r.subtotal;
        acc.impuesto += r.impuesto;
        acc.total += r.total;
        return acc;
      },
      { valor_bruto: 0, subtotal: 0, impuesto: 0, total: 0 }
    );

    // redondeo 2 decimales
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      valor_bruto: round2(t.valor_bruto),
      subtotal: round2(t.subtotal),
      impuesto: round2(t.impuesto),
      total: round2(t.total),
    };
  }, [rows]);

  // ✅ Export CSV (sin librerías)
  const exportCSV = () => {
    if (!rows.length) return;

    const header = ["Periodo", "Identificacion", "Sucursal", "Cliente", "ValorBruto", "Subtotal", "Impuesto", "Total"];

    const escapeCSV = (v: any) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [r.period_label, r.identification, r.sucursal, r.cliente, r.valor_bruto, r.subtotal, r.impuesto, r.total]
          .map(escapeCSV)
          .join(",")
      ),
      ["TOTAL", "", "", "", totals.valor_bruto, totals.subtotal, totals.impuesto, totals.total].map(escapeCSV).join(","),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_ventas_cliente_${granularity}_${from}_a_${to}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  if (loadingAuth) return <div style={{ padding: 24 }}>Cargando...</div>;

  // Si por alguna razón no redireccionó aún, mostramos aviso
  if (!isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <h1>No autorizado</h1>
        <p style={{ opacity: 0.7 }}>Este reporte solo está disponible para usuarios administradores.</p>
        <button
          onClick={() => router.replace("/pos")}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            cursor: "pointer",
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 800,
          }}
        >
          Volver al POS
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Reporte de ventas por cliente</h1>
      <p style={{ opacity: 0.7 }}>
        Genera reportes mensuales, trimestrales, semestrales o anuales con totales por cliente.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto auto",
          gap: 12,
          marginTop: 14,
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>Periodo</span>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="MONTH">Mensual</option>
            <option value="QUARTER">Trimestral</option>
            <option value="SEMESTER">Semestral</option>
            <option value="YEAR">Anual</option>
          </select>
        </label>

        <button
          onClick={fetchReport}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            cursor: "pointer",
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 800,
          }}
        >
          {loading ? "Cargando..." : "Generar"}
        </button>

        <button
          onClick={exportCSV}
          disabled={!rows.length || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            cursor: rows.length ? "pointer" : "not-allowed",
            border: "1px solid #ddd",
            background: rows.length ? "black" : "#999",
            color: "white",
            fontWeight: 800,
          }}
        >
          Exportar CSV
        </button>
      </div>

      {err && <div style={{ marginTop: 14, color: "red" }}>Error: {err}</div>}

      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
          <strong>Resultados</strong>
          <span style={{ opacity: 0.7 }}>{rows.length} filas</span>
        </div>

        {!rows.length ? (
          <div style={{ padding: 14, opacity: 0.7 }}>
            No hay datos todavía. Selecciona fechas y presiona <strong>Generar</strong>.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  <Th>Periodo</Th>
                  <Th>Identificación</Th>
                  <Th>Sucursal</Th>
                  <Th>Cliente</Th>
                  <Th align="right">Valor bruto</Th>
                  <Th align="right">Subtotal</Th>
                  <Th align="right">Impuesto</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.period_label}-${r.branch_id}-${r.identification}-${i}`}
                    style={{ borderTop: "1px solid #eee" }}
                  >
                    <Td>{r.period_label}</Td>
                    <Td>{r.identification}</Td>
                    <Td>{r.sucursal}</Td>
                    <Td>{r.cliente}</Td>
                    <Td align="right">${r.valor_bruto.toLocaleString("es-CO")}</Td>
                    <Td align="right">${r.subtotal.toLocaleString("es-CO")}</Td>
                    <Td align="right">${r.impuesto.toLocaleString("es-CO")}</Td>
                    <Td align="right" style={{ fontWeight: 800 }}>
                      ${r.total.toLocaleString("es-CO")}
                    </Td>
                  </tr>
                ))}

                {/* Totales */}
                <tr style={{ borderTop: "2px solid #000", background: "#fff" }}>
                  <Td style={{ fontWeight: 800 }}>TOTAL</Td>
                  <Td />
                  <Td />
                  <Td />
                  <Td align="right" style={{ fontWeight: 800 }}>
                    ${totals.valor_bruto.toLocaleString("es-CO")}
                  </Td>
                  <Td align="right" style={{ fontWeight: 800 }}>
                    ${totals.subtotal.toLocaleString("es-CO")}
                  </Td>
                  <Td align="right" style={{ fontWeight: 800 }}>
                    ${totals.impuesto.toLocaleString("es-CO")}
                  </Td>
                  <Td align="right" style={{ fontWeight: 900 }}>
                    ${totals.total.toLocaleString("es-CO")}
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: any; align?: "left" | "right" | "center" }) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: 10,
        borderBottom: "1px solid #eee",
        fontSize: 12,
        opacity: 0.8,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  style,
}: {
  children?: any;
  align?: "left" | "right" | "center";
  style?: CSSProperties;
}) {
  return (
    <td style={{ textAlign: align ?? "left", padding: 10, fontSize: 13, ...style }}>
      {children}
    </td>
  );
}
