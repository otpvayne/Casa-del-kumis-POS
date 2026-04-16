"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";
import * as XLSX from "xlsx";

type Branch = { id: string; name: string };

type StockRow = {
  branch_product_id: string;
  product_id: string;
  product_name: string;
  branch_id: string;
  branch_name: string;
  stock: number;
  price: number;
};

type MovimientoRow = {
  id: string;
  branch_id: string;
  branch_product_id: string;
  product_id: string;
  product_name: string;
  branch_name: string;
  type: string;
  quantity: number;
  reason: string | null;
  created_at: string;
};

type ReporteRow = {
  product_name: string;
  branch_name: string;
  stock_actual: number;
  vendido: number;
  entradas: number;
  retiros: number;
};

type Vista = "stock" | "historial" | "reporte";

export default function AdminInventarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([]);

  const [vista, setVista] = useState<Vista>("stock");
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Para el reporte
  const [reporteBranch, setReporteBranch] = useState<string>("");
  const [reporteFrom, setReporteFrom] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [reporteTo, setReporteTo] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [reporteRows, setReporteRows] = useState<ReporteRow[]>([]);
  const [loadingReporte, setLoadingReporte] = useState(false);

  useEffect(() => {
    const run = async () => {
      const role = await requireRole("ADMIN");
      if (!role.ok) return router.replace("/pos");

      const { data: bRows } = await supabase.from("branches").select("id, name").order("name");
      setBranches(bRows ?? []);

      await cargarStock();
      await cargarMovimientos();
      setLoading(false);
    };
    run().catch((e: any) => { setErr(e?.message ?? "Error."); setLoading(false); });
  }, [router]);

  const cargarStock = async () => {
    const { data, error } = await supabase
      .from("branch_products")
      .select("id, product_id, price, stock, branch_id, branches(name), products(name)")
      .eq("is_active", true)
      .order("stock", { ascending: true });

    if (error) throw new Error(error.message);

    setStockRows((data ?? []).map((r: any) => ({
      branch_product_id: r.id,
      product_id: r.product_id,
      product_name: r.products?.name ?? "Producto",
      branch_id: r.branch_id,
      branch_name: r.branches?.name ?? "Sucursal",
      stock: Number(r.stock ?? 0),
      price: Number(r.price ?? 0),
    })));
  };

  const cargarMovimientos = async () => {
    const { data, error } = await supabase
  .from("inventory_movements")
  .select("id, branch_id, branch_product_id, product_id, type, quantity, reason, created_at, branches(name), products(name)")
  .order("created_at", { ascending: false })
  .limit(500);

    if (error) throw new Error(error.message);

    setMovimientos((data ?? []).map((r: any) => ({
  id: r.id,
  branch_id: r.branch_id, // ✅ agregar
  branch_product_id: r.branch_product_id,
  product_id: r.product_id,
  product_name: r.products?.name ?? "Producto",
  branch_name: r.branches?.name ?? "Sucursal",
  type: r.type,
  quantity: Number(r.quantity ?? 0),
  reason: r.reason ?? null,
  created_at: r.created_at,
})));
  };

  const generarReporte = async () => {
    setLoadingReporte(true);
    setReporteRows([]);
    try {
      // Stock actual
      let stockQuery = supabase
        .from("branch_products")
        .select("id, product_id, stock, branch_id, branches(name), products(name)")
        .eq("is_active", true);
      if (reporteBranch) stockQuery = stockQuery.eq("branch_id", reporteBranch);
      const { data: stockData } = await stockQuery;

      // Movimientos en el rango
      let movQuery = supabase
        .from("inventory_movements")
        .select("branch_product_id, type, quantity")
        .gte("created_at", `${reporteFrom}T00:00:00`)
        .lte("created_at", `${reporteTo}T23:59:59`);
      const { data: movData } = await movQuery;

      // Agrupar movimientos por branch_product_id
      const movMap: Record<string, { vendido: number; entradas: number; retiros: number }> = {};
      (movData ?? []).forEach((m: any) => {
        const key = m.branch_product_id;
        if (!movMap[key]) movMap[key] = { vendido: 0, entradas: 0, retiros: 0 };
        if (m.type === "VENTA") movMap[key].vendido += Math.abs(Number(m.quantity));
        if (m.type === "ENTRADA") movMap[key].entradas += Number(m.quantity);
        if (m.type === "RETIRO") movMap[key].retiros += Math.abs(Number(m.quantity));
      });

      const rows: ReporteRow[] = (stockData ?? []).map((r: any) => {
        const mov = movMap[r.id] ?? { vendido: 0, entradas: 0, retiros: 0 };
        return {
          product_name: r.products?.name ?? "Producto",
          branch_name: r.branches?.name ?? "Sucursal",
          stock_actual: Number(r.stock ?? 0),
          vendido: mov.vendido,
          entradas: mov.entradas,
          retiros: mov.retiros,
        };
      }).sort((a: ReporteRow, b: ReporteRow) => a.branch_name.localeCompare(b.branch_name) || a.product_name.localeCompare(b.product_name));

      setReporteRows(rows);
    } catch (e: any) {
      setErr(e.message ?? "Error generando reporte.");
    } finally {
      setLoadingReporte(false);
    }
  };

  const exportarReporteExcel = () => {
    if (!reporteRows.length) return;
    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};

    const borderThin = { top: { style: "thin" as const, color: { rgb: "B0C4DE" } }, bottom: { style: "thin" as const, color: { rgb: "B0C4DE" } }, left: { style: "thin" as const, color: { rgb: "B0C4DE" } }, right: { style: "thin" as const, color: { rgb: "B0C4DE" } } };
    const headerStyle = { font: { name: "Arial", bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" as const }, alignment: { horizontal: "center" as const, vertical: "center" as const }, border: borderThin };
    const cellL = { font: { name: "Arial", sz: 10 }, alignment: { horizontal: "left" as const }, border: borderThin };
    const cellR = { font: { name: "Arial", sz: 10 }, alignment: { horizontal: "right" as const }, border: borderThin };
    const cellLAlt = { ...cellL, fill: { fgColor: { rgb: "EBF2FA" }, patternType: "solid" as const } };
    const cellRAlt = { ...cellR, fill: { fgColor: { rgb: "EBF2FA" }, patternType: "solid" as const } };

    ws["A1"] = { v: `REPORTE INVENTARIO — ${reporteFrom} a ${reporteTo}`, t: "s", s: { font: { name: "Arial", bold: true, sz: 13, color: { rgb: "1E3A5F" } } } };
    ws["A2"] = { v: `Generado: ${new Date().toLocaleString("es-CO")}`, t: "s", s: { font: { name: "Arial", italic: true, sz: 9, color: { rgb: "888888" } } } };

    const HEADER_ROW = 4;
    const headers = ["Sucursal", "Producto", "Stock actual", "Vendido (período)", "Entradas (período)", "Retiros (período)"];
    const cols = ["A", "B", "C", "D", "E", "F"];
    headers.forEach((h, i) => { ws[`${cols[i]}${HEADER_ROW}`] = { v: h, t: "s", s: headerStyle }; });

    reporteRows.forEach((r, idx) => {
      const row = HEADER_ROW + 1 + idx;
      const alt = idx % 2 === 1;
      const sL = alt ? cellLAlt : cellL;
      const sR = alt ? cellRAlt : cellR;
      ws[`A${row}`] = { v: r.branch_name, t: "s", s: sL };
      ws[`B${row}`] = { v: r.product_name, t: "s", s: sL };
      ws[`C${row}`] = { v: r.stock_actual, t: "n", s: sR };
      ws[`D${row}`] = { v: r.vendido, t: "n", s: sR };
      ws[`E${row}`] = { v: r.entradas, t: "n", s: sR };
      ws[`F${row}`] = { v: r.retiros, t: "n", s: sR };
    });

    const totalRow = HEADER_ROW + 1 + reporteRows.length;
    const totalStyle = { font: { name: "Arial", bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: { rgb: "2D6A4F" }, patternType: "solid" as const }, alignment: { horizontal: "right" as const }, border: borderThin };
    const totalStyleL = { ...totalStyle, alignment: { horizontal: "left" as const } };
    ws[`A${totalRow}`] = { v: "TOTAL", t: "s", s: totalStyleL };
    ws[`B${totalRow}`] = { v: "", t: "s", s: totalStyleL };
    ws[`C${totalRow}`] = { v: reporteRows.reduce((a, r) => a + r.stock_actual, 0), t: "n", s: totalStyle };
    ws[`D${totalRow}`] = { v: reporteRows.reduce((a, r) => a + r.vendido, 0), t: "n", s: totalStyle };
    ws[`E${totalRow}`] = { v: reporteRows.reduce((a, r) => a + r.entradas, 0), t: "n", s: totalStyle };
    ws[`F${totalRow}`] = { v: reporteRows.reduce((a, r) => a + r.retiros, 0), t: "n", s: totalStyle };

    ws["!ref"] = `A1:F${totalRow}`;
    ws["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];

    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `inventario_${reporteFrom}_a_${reporteTo}.xlsx`);
  };

  // --- Filtros
  const stockFiltrado = useMemo(() => {
    return stockRows.filter((r) => {
      if (filterBranch && r.branch_id !== filterBranch) return false;
      if (filterProduct && !r.product_name.toLowerCase().includes(filterProduct.toLowerCase())) return false;
      return true;
    });
  }, [stockRows, filterBranch, filterProduct]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (filterBranch && m.branch_id !== filterBranch) return false;
      if (filterProduct && !m.product_name.toLowerCase().includes(filterProduct.toLowerCase())) return false;
      if (filterType && m.type !== filterType) return false;
      if (filterDateFrom && m.created_at < `${filterDateFrom}T00:00:00`) return false;
      if (filterDateTo && m.created_at > `${filterDateTo}T23:59:59`) return false;
      return true;
    });
  }, [movimientos, filterBranch, filterProduct, filterType, filterDateFrom, filterDateTo, branches]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const stockColor = (stock: number) => {
    if (stock <= 0) return "text-red-600 bg-red-50 border-red-200";
    if (stock <= 5) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  };

  const typeBadge = (type: string) => {
    if (type === "ENTRADA") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (type === "RETIRO") return "border-red-200 bg-red-50 text-red-700";
    if (type === "VENTA") return "border-blue-200 bg-blue-50 text-blue-700";
    if (type === "AJUSTE") return "border-violet-200 bg-violet-50 text-violet-700";
    return "border-gray-200 bg-gray-50 text-gray-600";
  };

  const typeLabel = (type: string) => {
    if (type === "ENTRADA") return "Entrada";
    if (type === "RETIRO") return "Retiro";
    if (type === "VENTA") return "Venta";
    if (type === "AJUSTE") return "Ajuste";
    return type;
  };

  if (loading) return <LoadingCard title="Cargando inventario..." />;

  return (
    <div className="container py-8">
      <PageShell
        title="Inventario — Admin"
        subtitle="Stock, movimientos y reportes de todas las sucursales."
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={async () => { await cargarStock(); await cargarMovimientos(); }}>Refrescar</button>
            <button className="btn" onClick={() => router.push("/admin")}>Volver</button>
          </div>
        }
      >
        {err && <div className="alert-err mb-4">{err}</div>}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200 pb-0">
          {(["stock", "historial", "reporte"] as Vista[]).map((v) => {
            const labels: Record<Vista, string> = { stock: "Stock actual", historial: "Historial de movimientos", reporte: "Reporte vendido vs físico" };
            return (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-4 py-2 text-sm font-extrabold border-b-2 transition -mb-px ${vista === v ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>

        {/* ── VISTA STOCK ── */}
        {vista === "stock" && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Sin stock", count: stockRows.filter((r) => r.stock <= 0).length, color: "border-red-200 bg-red-50 text-red-700" },
                { label: "Stock bajo (≤5)", count: stockRows.filter((r) => r.stock > 0 && r.stock <= 5).length, color: "border-amber-200 bg-amber-50 text-amber-700" },
                { label: "Con stock", count: stockRows.filter((r) => r.stock > 5).length, color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.color}`}>
                  <div className="text-2xl font-black">{s.count}</div>
                  <div className="text-xs font-semibold mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filtros */}
            <div className="card">
              <div className="card-b flex flex-wrap gap-3">
                <label className="grid gap-1 min-w-[160px]">
                  <span className="label">Sucursal</span>
                  <select className="input" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                    <option value="">Todas</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 flex-1 min-w-[200px]">
                  <span className="label">Producto</span>
                  <input className="input" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} placeholder="Buscar producto..." />
                </label>
                <div className="flex items-end">
                  <button className="btn" onClick={() => { setFilterBranch(""); setFilterProduct(""); }}>Limpiar</button>
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="card">
              <div className="card-h">
                <div className="text-lg font-extrabold">Stock por sucursal</div>
                <div className="text-sm text-gray-500">{stockFiltrado.length} registros</div>
              </div>
              <div className="card-b">
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Producto</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Sucursal</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600">Stock</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockFiltrado.map((r) => (
                        <tr key={r.branch_product_id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-3 font-semibold text-gray-900">{r.product_name}</td>
                          <td className="px-3 py-3 text-gray-600">{r.branch_name}</td>
                          <td className="px-3 py-3 text-right">
                            <span className={`rounded-2xl border px-2 py-1 text-xs font-extrabold ${stockColor(r.stock)}`}>
                              {r.stock <= 0 ? "Sin stock" : `${r.stock} und.`}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-600">${r.price.toLocaleString("es-CO")}</td>
                        </tr>
                      ))}
                      {stockFiltrado.length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-4 text-sm text-gray-500 text-center">Sin resultados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VISTA HISTORIAL ── */}
        {vista === "historial" && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="card">
              <div className="card-b flex flex-wrap gap-3">
                <label className="grid gap-1 min-w-[160px]">
                  <span className="label">Sucursal</span>
                  <select className="input" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                    <option value="">Todas</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 min-w-[140px]">
                  <span className="label">Tipo</span>
                  <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="ENTRADA">Entrada</option>
                    <option value="VENTA">Venta</option>
                    <option value="RETIRO">Retiro</option>
                    <option value="AJUSTE">Ajuste</option>
                  </select>
                </label>
                <label className="grid gap-1 flex-1 min-w-[180px]">
                  <span className="label">Producto</span>
                  <input className="input" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} placeholder="Buscar producto..." />
                </label>
                <label className="grid gap-1 min-w-[140px]">
                  <span className="label">Desde</span>
                  <input type="date" className="input" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                </label>
                <label className="grid gap-1 min-w-[140px]">
                  <span className="label">Hasta</span>
                  <input type="date" className="input" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                </label>
                <div className="flex items-end">
                  <button className="btn" onClick={() => { setFilterBranch(""); setFilterProduct(""); setFilterType(""); setFilterDateFrom(""); setFilterDateTo(""); }}>Limpiar</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-h">
                <div className="text-lg font-extrabold">Movimientos</div>
                <div className="text-sm text-gray-500">{movimientosFiltrados.length} registros</div>
              </div>
              <div className="card-b">
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Fecha</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Producto</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Sucursal</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Tipo</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600">Cantidad</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosFiltrados.map((m) => (
                        <tr key={m.id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(m.created_at)}</td>
                          <td className="px-3 py-3 font-semibold text-gray-900">{m.product_name}</td>
                          <td className="px-3 py-3 text-gray-600">{m.branch_name}</td>
                          <td className="px-3 py-3">
                            <span className={`badge text-xs ${typeBadge(m.type)}`}>{typeLabel(m.type)}</span>
                          </td>
                          <td className={`px-3 py-3 text-right font-extrabold ${m.quantity > 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">{m.reason ?? "—"}</td>
                        </tr>
                      ))}
                      {movimientosFiltrados.length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-4 text-sm text-gray-500 text-center">Sin movimientos con esos filtros.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VISTA REPORTE ── */}
        {vista === "reporte" && (
          <div className="space-y-4">
            <div className="card">
              <div className="card-h">
                <div className="text-lg font-extrabold">Parámetros del reporte</div>
                <div className="text-sm text-gray-500">Vendido vs stock actual para el período seleccionado.</div>
              </div>
              <div className="card-b flex flex-wrap gap-3 items-end">
                <label className="grid gap-1 min-w-[160px]">
                  <span className="label">Sucursal</span>
                  <select className="input" value={reporteBranch} onChange={(e) => setReporteBranch(e.target.value)}>
                    <option value="">Todas</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 min-w-[150px]">
                  <span className="label">Desde</span>
                  <input type="date" className="input" value={reporteFrom} onChange={(e) => setReporteFrom(e.target.value)} />
                </label>
                <label className="grid gap-1 min-w-[150px]">
                  <span className="label">Hasta</span>
                  <input type="date" className="input" value={reporteTo} onChange={(e) => setReporteTo(e.target.value)} />
                </label>
                <button className="btn btn-primary" onClick={generarReporte} disabled={loadingReporte}>
                  {loadingReporte ? "Generando..." : "Generar reporte"}
                </button>
                {reporteRows.length > 0 && (
                  <button className="btn" onClick={exportarReporteExcel}>Exportar Excel</button>
                )}
              </div>
            </div>

            {reporteRows.length > 0 && (
              <div className="card">
                <div className="card-h flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold">Resultados</div>
                    <div className="text-sm text-gray-500">{reporteRows.length} productos</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge">Total vendido: <span className="ml-1 font-extrabold text-gray-900">{reporteRows.reduce((a, r) => a + r.vendido, 0)} und.</span></span>
                    <span className="badge">Stock total: <span className="ml-1 font-extrabold text-gray-900">{reporteRows.reduce((a, r) => a + r.stock_actual, 0)} und.</span></span>
                  </div>
                </div>
                <div className="card-b">
                  <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Sucursal</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-gray-600">Producto</th>
                          <th className="px-3 py-3 text-right text-xs font-bold text-gray-600">Stock actual</th>
                          <th className="px-3 py-3 text-right text-xs font-bold text-gray-600">Vendido</th>
                          <th className="px-3 py-3 text-right text-xs font-bold text-gray-600">Entradas</th>
                          <th className="px-3 py-3 text-right text-xs font-bold text-gray-600">Retiros</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reporteRows.map((r, i) => (
                          <tr key={i} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-3 py-3 text-gray-600">{r.branch_name}</td>
                            <td className="px-3 py-3 font-semibold text-gray-900">{r.product_name}</td>
                            <td className="px-3 py-3 text-right">
                              <span className={`rounded-2xl border px-2 py-1 text-xs font-extrabold ${stockColor(r.stock_actual)}`}>
                                {r.stock_actual <= 0 ? "Sin stock" : `${r.stock_actual} und.`}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-extrabold text-blue-700">{r.vendido}</td>
                            <td className="px-3 py-3 text-right font-semibold text-emerald-700">{r.entradas}</td>
                            <td className="px-3 py-3 text-right font-semibold text-red-600">{r.retiros}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-gray-300 bg-gray-50">
                          <td className="px-3 py-3 font-extrabold" colSpan={2}>TOTAL</td>
                          <td className="px-3 py-3 text-right font-extrabold">{reporteRows.reduce((a, r) => a + r.stock_actual, 0)}</td>
                          <td className="px-3 py-3 text-right font-extrabold text-blue-700">{reporteRows.reduce((a, r) => a + r.vendido, 0)}</td>
                          <td className="px-3 py-3 text-right font-extrabold text-emerald-700">{reporteRows.reduce((a, r) => a + r.entradas, 0)}</td>
                          <td className="px-3 py-3 text-right font-extrabold text-red-600">{reporteRows.reduce((a, r) => a + r.retiros, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!loadingReporte && reporteRows.length === 0 && (
              <div className="card"><div className="card-b text-sm text-gray-500">Selecciona los parámetros y presiona <strong>Generar reporte</strong>.</div></div>
            )}
          </div>
        )}
      </PageShell>
    </div>
  );
}