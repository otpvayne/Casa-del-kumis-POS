"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";
import * as XLSX from "xlsx";

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

  useEffect(() => {
    const run = async () => {
      const res = await requireRole("ADMIN");
      if (!res.ok) { router.replace("/pos"); return; }
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

  // ✅ Exportar Excel con formato profesional usando SheetJS
  const exportExcel = () => {
    if (!rows.length) return;

    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};

    // — Paleta de colores —
    const COLOR_HEADER_BG = "1E3A5F";   // azul oscuro
    const COLOR_HEADER_FG = "FFFFFF";   // blanco
    const COLOR_TOTAL_BG  = "2D6A4F";   // verde oscuro
    const COLOR_TOTAL_FG  = "FFFFFF";
    const COLOR_ALT_BG    = "EBF2FA";   // azul muy claro para filas alternas
    const COLOR_BORDER    = "B0C4DE";

    // Estilos reutilizables
    const borderThin = {
      top:    { style: "thin" as const, color: { rgb: COLOR_BORDER } },
      bottom: { style: "thin" as const, color: { rgb: COLOR_BORDER } },
      left:   { style: "thin" as const, color: { rgb: COLOR_BORDER } },
      right:  { style: "thin" as const, color: { rgb: COLOR_BORDER } },
    };

    const headerStyle = {
      font:      { name: "Arial", bold: true, color: { rgb: COLOR_HEADER_FG }, sz: 11 },
      fill:      { fgColor: { rgb: COLOR_HEADER_BG }, patternType: "solid" as const },
      alignment: { horizontal: "center" as const, vertical: "center" as const, wrapText: true },
      border:    borderThin,
    };

    const cellStyleLeft = {
      font:      { name: "Arial", sz: 10 },
      alignment: { horizontal: "left" as const, vertical: "center" as const },
      border:    borderThin,
    };

    const cellStyleRight = {
      font:      { name: "Arial", sz: 10 },
      alignment: { horizontal: "right" as const, vertical: "center" as const },
      border:    borderThin,
      numFmt:    '$#,##0.00',
    };

    const cellStyleRightAlt = {
      ...cellStyleRight,
      fill: { fgColor: { rgb: COLOR_ALT_BG }, patternType: "solid" as const },
    };

    const cellStyleLeftAlt = {
      ...cellStyleLeft,
      fill: { fgColor: { rgb: COLOR_ALT_BG }, patternType: "solid" as const },
    };

    const totalStyle = {
      font:      { name: "Arial", bold: true, color: { rgb: COLOR_TOTAL_FG }, sz: 11 },
      fill:      { fgColor: { rgb: COLOR_TOTAL_BG }, patternType: "solid" as const },
      alignment: { horizontal: "right" as const, vertical: "center" as const },
      border:    borderThin,
      numFmt:    '$#,##0.00',
    };

    const totalStyleLeft = {
      ...totalStyle,
      alignment: { horizontal: "left" as const, vertical: "center" as const },
    };

    // — Fila 1: Título del reporte —
    const granularityLabel: Record<Granularity, string> = {
      MONTH: "Mensual", QUARTER: "Trimestral",
      SEMESTER: "Semestral", YEAR: "Anual",
    };

    ws["A1"] = {
      v: `REPORTE VENTAS POR CLIENTE — ${granularityLabel[granularity].toUpperCase()} — ${from} a ${to}`,
      t: "s",
      s: {
        font:      { name: "Arial", bold: true, sz: 13, color: { rgb: COLOR_HEADER_BG } },
        alignment: { horizontal: "left" as const, vertical: "center" as const },
      },
    };

    // Fila 2: Subtítulo generado
    ws["A2"] = {
      v: `Generado: ${new Date().toLocaleString("es-CO")}`,
      t: "s",
      s: {
        font: { name: "Arial", italic: true, sz: 9, color: { rgb: "888888" } },
        alignment: { horizontal: "left" as const },
      },
    };

    // — Fila 4: Encabezados —
    const HEADER_ROW = 4;
    const headers = [
      "Periodo", "Identificación", "Sucursal", "Cliente",
      "Valor Bruto ($)", "Subtotal ($)", "Impuesto ($)", "Total ($)",
    ];
    const cols = ["A","B","C","D","E","F","G","H"];

    headers.forEach((h, i) => {
      ws[`${cols[i]}${HEADER_ROW}`] = { v: h, t: "s", s: headerStyle };
    });

    // — Filas de datos —
    rows.forEach((r, idx) => {
      const excelRow = HEADER_ROW + 1 + idx;
      const isAlt = idx % 2 === 1;
      const sL = isAlt ? cellStyleLeftAlt  : cellStyleLeft;
      const sR = isAlt ? cellStyleRightAlt : cellStyleRight;

      ws[`A${excelRow}`] = { v: r.period_label,    t: "s", s: sL };
      ws[`B${excelRow}`] = { v: r.identification,  t: "s", s: sL };
      ws[`C${excelRow}`] = { v: r.sucursal,         t: "s", s: sL };
      ws[`D${excelRow}`] = { v: r.cliente,          t: "s", s: sL };
      ws[`E${excelRow}`] = { v: r.valor_bruto,      t: "n", s: sR };
      ws[`F${excelRow}`] = { v: r.subtotal,         t: "n", s: sR };
      ws[`G${excelRow}`] = { v: r.impuesto,         t: "n", s: sR };
      ws[`H${excelRow}`] = { v: r.total,            t: "n", s: sR };
    });

    // — Fila de TOTAL —
    const totalRow = HEADER_ROW + 1 + rows.length;
    ws[`A${totalRow}`] = { v: "TOTAL",              t: "s", s: totalStyleLeft };
    ws[`B${totalRow}`] = { v: "",                   t: "s", s: totalStyleLeft };
    ws[`C${totalRow}`] = { v: "",                   t: "s", s: totalStyleLeft };
    ws[`D${totalRow}`] = { v: "",                   t: "s", s: totalStyleLeft };
    ws[`E${totalRow}`] = { v: totals.valor_bruto,   t: "n", s: totalStyle };
    ws[`F${totalRow}`] = { v: totals.subtotal,      t: "n", s: totalStyle };
    ws[`G${totalRow}`] = { v: totals.impuesto,      t: "n", s: totalStyle };
    ws[`H${totalRow}`] = { v: totals.total,         t: "n", s: totalStyle };

    // — Anchos de columna —
    ws["!cols"] = [
      { wch: 18 }, // Periodo
      { wch: 18 }, // Identificación
      { wch: 28 }, // Sucursal
      { wch: 32 }, // Cliente
      { wch: 18 }, // Valor Bruto
      { wch: 16 }, // Subtotal
      { wch: 16 }, // Impuesto
      { wch: 16 }, // Total
    ];

    // — Alto de filas —
    const rowHeights: XLSX.RowInfo[] = [];
    rowHeights[0] = { hpt: 28 }; // Título
    rowHeights[1] = { hpt: 16 }; // Subtítulo
    rowHeights[HEADER_ROW - 1] = { hpt: 28 }; // Encabezados
    for (let i = HEADER_ROW; i <= totalRow; i++) {
      rowHeights[i] = { hpt: 20 };
    }
    ws["!rows"] = rowHeights;

    // — Rango de la hoja —
    ws["!ref"] = `A1:H${totalRow}`;

    // — Merge título y subtítulo —
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Título
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Subtítulo
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Ventas por Cliente");

    const filename = `reporte_ventas_cliente_${granularity}_${from}_a_${to}.xlsx`;
    XLSX.writeFile(wb, filename);
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

                {/* ✅ Botón Excel */}
                <button className="btn" onClick={exportExcel} disabled={!rows.length || loading}>
                  Exportar Excel
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
                        <Td /><Td /><Td />
                        <Td align="right" style={{ fontWeight: 900 }}>${totals.valor_bruto.toLocaleString("es-CO")}</Td>
                        <Td align="right" style={{ fontWeight: 900 }}>${totals.subtotal.toLocaleString("es-CO")}</Td>
                        <Td align="right" style={{ fontWeight: 900 }}>${totals.impuesto.toLocaleString("es-CO")}</Td>
                        <Td align="right" style={{ fontWeight: 900 }}>${totals.total.toLocaleString("es-CO")}</Td>
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
    <th className="border-b border-gray-200 px-3 py-3 text-xs font-semibold text-gray-600" style={{ textAlign: align ?? "left" }}>
      {children}
    </th>
  );
}

function Td({ children, align, style }: { children?: any; align?: "left" | "right" | "center"; style?: CSSProperties }) {
  return (
    <td className="px-3 py-3 text-sm text-gray-800" style={{ textAlign: align ?? "left", ...style }}>
      {children}
    </td>
  );
}