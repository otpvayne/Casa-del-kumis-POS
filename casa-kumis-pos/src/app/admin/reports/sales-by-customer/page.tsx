"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";

type Granularity = "MONTH" | "QUARTER" | "SEMESTER" | "YEAR";

type ReportRow = {
  period_start: string;
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

  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });

  const [to, setTo] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  const [granularity, setGranularity] = useState<Granularity>("MONTH");
  const [rows, setRows] = useState<ReportRow[]>([]);

  // ✅ Admin guard consistente
  useEffect(() => {
    const run = async () => {
      const res = await requireRole("ADMIN");
      if (!res.ok) {
        router.replace("/pos");
        return;
      }
      setLoadingAuth(false);
    };
    run().catch((e: any) => {
      setErr(e?.message ?? "No autorizado.");
      setLoadingAuth(false);
    });
  }, [router]);

  const fetchReport = async () => {
    setErr(null);
    setLoading(true);
    setRows([]);

    try {
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

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      valor_bruto: round2(t.valor_bruto),
      subtotal: round2(t.subtotal),
      impuesto: round2(t.impuesto),
      total: round2(t.total),
    };
  }, [rows]);

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

  if (loadingAuth) return <div className="container py-6">Cargando...</div>;

  return (
    <div className="container py-6">
      <PageShell
        title="Ventas por cliente"
        subtitle="Totales por cliente por periodo (mensual, trimestral, semestral o anual)."
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={() => router.push("/admin/reports")}>
              Volver
            </button>
            <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
              {loading ? "Cargando..." : "Generar"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4">
          {/* Filtros */}
          <div className="card">
            <div className="card-h">
              <div className="text-lg font-extrabold">Filtros</div>
              <div className="text-sm text-gray-600">Selecciona rango y periodo.</div>
            </div>

            <div className="card-b">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto] items-end">
                <label className="grid gap-1">
                  <span className="label">Desde</span>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
                </label>

                <label className="grid gap-1">
                  <span className="label">Hasta</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
                </label>

                <label className="grid gap-1">
                  <span className="label">Periodo</span>
                  <select value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)} className="input">
                    <option value="MONTH">Mensual</option>
                    <option value="QUARTER">Trimestral</option>
                    <option value="SEMESTER">Semestral</option>
                    <option value="YEAR">Anual</option>
                  </select>
                </label>

                <button className="btn" onClick={exportCSV} disabled={!rows.length || loading}>
                  Exportar CSV
                </button>
              </div>

              {err && <div className="alert-err mt-3">Error: {err}</div>}
            </div>
          </div>

          {/* Resultados */}
          <div className="card">
            <div className="card-h flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">Resultados</div>
                <div className="text-sm text-gray-600">{rows.length} fila(s)</div>
              </div>

              {rows.length > 0 && (
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="badge">
                    Total: <span className="ml-1 font-extrabold text-gray-900">${totals.total.toLocaleString("es-CO")}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="card-b">
              {!rows.length ? (
                <div className="text-sm text-gray-600">
                  No hay datos todavía. Ajusta los filtros y presiona <strong>Generar</strong>.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
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
                        <tr key={`${r.period_label}-${r.branch_id}-${r.identification}-${i}`} className="border-t border-gray-200">
                          <Td>{r.period_label}</Td>
                          <Td>{r.identification}</Td>
                          <Td>{r.sucursal}</Td>
                          <Td>{r.cliente}</Td>
                          <Td align="right">${r.valor_bruto.toLocaleString("es-CO")}</Td>
                          <Td align="right">${r.subtotal.toLocaleString("es-CO")}</Td>
                          <Td align="right">${r.impuesto.toLocaleString("es-CO")}</Td>
                          <Td align="right" style={{ fontWeight: 900 }}>
                            ${r.total.toLocaleString("es-CO")}
                          </Td>
                        </tr>
                      ))}

                      <tr className="border-t-2 border-black bg-white">
                        <Td style={{ fontWeight: 900 }}>TOTAL</Td>
                        <Td />
                        <Td />
                        <Td />
                        <Td align="right" style={{ fontWeight: 900 }}>
                          ${totals.valor_bruto.toLocaleString("es-CO")}
                        </Td>
                        <Td align="right" style={{ fontWeight: 900 }}>
                          ${totals.subtotal.toLocaleString("es-CO")}
                        </Td>
                        <Td align="right" style={{ fontWeight: 900 }}>
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
        </div>
      </PageShell>
    </div>
  );
}

function Th({ children, align }: { children: any; align?: "left" | "right" | "center" }) {
  return (
    <th
      className="border-b border-gray-200 px-3 py-3 text-xs font-semibold text-gray-600"
      style={{ textAlign: align ?? "left" }}
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
    <td className="px-3 py-3 text-sm text-gray-800" style={{ textAlign: align ?? "left", ...style }}>
      {children}
    </td>
  );
}