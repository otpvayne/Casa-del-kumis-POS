"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";

type Branch = { id: string; name: string; is_active: boolean };

type SaleRow = {
  branch_id: string;
  branch_name: string;
  sale_id: string;
  created_at: string;
  receipt_number: number | null;
  total: number;
  pay_cash: number;
  pay_card: number;
  pay_transfer: number;
  pay_qr: number;
};

type ProductSoldRow = {
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_name: string;
  qty_sold: number;
  total_sold: number;
};

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function money(n: number) {
  return `$${Number(n ?? 0).toLocaleString("es-CO")}`;
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(""); // "" => todas

  // Por defecto: mes actual
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return ymd(first);
  });
  const [toDate, setToDate] = useState<string>(() => {
    const now = new Date();
    return ymd(now);
  });

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [productsSold, setProductsSold] = useState<ProductSoldRow[]>([]);

  const load = async () => {
    setErr(null);
    setLoading(true);

    const role = await requireRole("ADMIN");
    if (!role.ok) return router.replace("/pos");

    // Branches
    const { data: b, error: bErr } = await supabase
      .from("branches")
      .select("id,name,is_active")
      .order("name");

    if (bErr) throw new Error(bErr.message);

    setBranches(
      (b ?? []).map((x: any) => ({
        id: x.id,
        name: x.name,
        is_active: Boolean(x.is_active),
      }))
    );

    // Sales report
    const { data: sData, error: sErr } = await supabase.rpc("admin_sales_report", {
      p_from: fromDate,
      p_to: toDate,
      p_branch_id: selectedBranchId ? selectedBranchId : null,
    });

    if (sErr) throw new Error(sErr.message);

    const mappedSales: SaleRow[] = (sData ?? []).map((r: any) => ({
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      sale_id: r.sale_id,
      created_at: r.created_at,
      receipt_number: r.receipt_number,
      total: Number(r.total ?? 0),
      pay_cash: Number(r.pay_cash ?? 0),
      pay_card: Number(r.pay_card ?? 0),
      pay_transfer: Number(r.pay_transfer ?? 0),
      pay_qr: Number(r.pay_qr ?? 0),
    }));

    setSales(mappedSales);

    // Products sold
    const { data: pData, error: pErr } = await supabase.rpc("admin_products_sold", {
      p_from: fromDate,
      p_to: toDate,
      p_branch_id: selectedBranchId ? selectedBranchId : null,
    });

    if (pErr) throw new Error(pErr.message);

    const mappedProd: ProductSoldRow[] = (pData ?? []).map((r: any) => ({
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      product_id: r.product_id,
      product_name: r.product_name,
      qty_sold: Number(r.qty_sold ?? 0),
      total_sold: Number(r.total_sold ?? 0),
    }));

    setProductsSold(mappedProd);

    setLoading(false);
  };

  useEffect(() => {
    load().catch((e) => {
      setErr(e.message ?? "Error cargando reportes.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = useMemo(() => {
    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const cash = sales.reduce((acc, s) => acc + s.pay_cash, 0);
    const card = sales.reduce((acc, s) => acc + s.pay_card, 0);
    const transfer = sales.reduce((acc, s) => acc + s.pay_transfer, 0);
    const qr = sales.reduce((acc, s) => acc + s.pay_qr, 0);

    return {
      totalSales: round2(totalSales),
      cash: round2(cash),
      card: round2(card),
      transfer: round2(transfer),
      qr: round2(qr),
      count: sales.length,
    };
  }, [sales]);

  if (loading) return <LoadingCard title="Cargando POS..." />;

  return (
    <div className="container py-8">
      <PageShell
  title={
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Reportes</h1>
          <span className="badge">Admin</span>
        </div>

        <div className="mt-2 text-sm text-gray-600">
          Consulta ventas y productos vendidos por rango de fechas y sucursal.
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-semibold text-gray-700">
            Desde: <span className="ml-1 font-extrabold text-gray-900">{fromDate}</span>
          </span>

          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-semibold text-gray-700">
            Hasta: <span className="ml-1 font-extrabold text-gray-900">{toDate}</span>
          </span>

          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-semibold text-gray-700">
            Sucursal:{" "}
            <span className="ml-1 font-extrabold text-gray-900">
              {selectedBranchId
                ? branches.find((b) => b.id === selectedBranchId)?.name ?? "Seleccionada"
                : "Todas"}
            </span>
          </span>
        </div>
      </div>
    </div>
  }
  right={
    <div className="flex gap-2">
      <button className="btn" onClick={() => load().catch(() => {})}>
        Consultar
      </button>
      <button className="btn" onClick={() => router.push("/admin")}>
        Volver
      </button>
      <button className="btn" onClick={() => router.push("/admin/reports/sales-by-customer")}>
  Ventas por cliente
</button>
    </div>
  }
>
        {err && (
          <div className="alert-err mb-4" style={{ whiteSpace: "pre-line" }}>
            {err}
          </div>
        )}

        {/* Filtros */}
        <div className="card mb-4">
          <div className="card-h flex items-center justify-between">
            <div>
              <div className="text-lg font-extrabold">Filtros</div>
              <div className="text-sm text-gray-500">Ajusta el rango y la sucursal, luego presiona Consultar.</div>
            </div>
            <span className="badge">Admin</span>
          </div>

          <div className="card-b">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1">
                <span className="label">Desde</span>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
              </label>

              <label className="grid gap-1">
                <span className="label">Hasta</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
              </label>

              <label className="grid gap-1">
                <span className="label">Sucursal</span>
                <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} className="input">
                  <option value="">Todas</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {!b.is_active ? "(inactiva)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Tip: para “mes”, usa Desde = primer día del mes y Hasta = último día del mes.
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 mb-4">
          <Kpi title="Total ventas" value={money(kpis.totalSales)} />
          <Kpi title="Efectivo" value={money(kpis.cash)} />
          <Kpi title="Tarjeta" value={money(kpis.card)} />
          <Kpi title="Transferencia" value={money(kpis.transfer)} />
          <Kpi title="QR" value={money(kpis.qr)} />
          <Kpi title="Facturas" value={`${kpis.count}`} />
        </div>

        {/* Tabla ventas */}
        <div className="card mb-4">
          <div className="card-h flex items-center justify-between">
            <div>
              <div className="text-lg font-extrabold">Facturas</div>
              <div className="text-sm text-gray-500">Detalle por venta y método de pago.</div>
            </div>
            <span className="badge">{sales.length} registro(s)</span>
          </div>

          <div className="card-b">
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Fecha</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Sucursal</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Comprobante</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Total</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Efectivo</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Tarjeta</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Transfer</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">QR</th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map((s) => (
                    <tr key={s.sale_id} className="border-t border-gray-200">
                      <td className="p-3 text-sm text-gray-700">{new Date(s.created_at).toLocaleString("es-CO")}</td>
                      <td className="p-3 text-sm font-semibold text-gray-800">{s.branch_name}</td>
                      <td className="p-3 text-sm text-gray-700">{s.receipt_number ?? "-"}</td>
                      <td className="p-3 text-sm font-extrabold text-gray-900">{money(s.total)}</td>
                      <td className="p-3 text-sm text-gray-700">{money(s.pay_cash)}</td>
                      <td className="p-3 text-sm text-gray-700">{money(s.pay_card)}</td>
                      <td className="p-3 text-sm text-gray-700">{money(s.pay_transfer)}</td>
                      <td className="p-3 text-sm text-gray-700">{money(s.pay_qr)}</td>
                    </tr>
                  ))}

                  {sales.length === 0 && (
                    <tr>
                      <td className="p-4 text-sm text-gray-500" colSpan={8}>
                        No hay ventas en ese rango.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Productos vendidos */}
        <div className="card">
          <div className="card-h flex items-center justify-between">
            <div>
              <div className="text-lg font-extrabold">Productos vendidos</div>
              <div className="text-sm text-gray-500">Acumulado por producto en el rango seleccionado.</div>
            </div>
            <span className="badge">{productsSold.length} producto(s)</span>
          </div>

          <div className="card-b">
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Sucursal</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Producto</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Cantidad</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {productsSold.map((p) => (
                    <tr key={`${p.branch_id}_${p.product_id}`} className="border-t border-gray-200">
                      <td className="p-3 text-sm font-semibold text-gray-800">{p.branch_name}</td>
                      <td className="p-3 text-sm text-gray-700">{p.product_name}</td>
                      <td className="p-3 text-sm font-extrabold text-gray-900">{p.qty_sold}</td>
                      <td className="p-3 text-sm font-extrabold text-gray-900">{money(p.total_sold)}</td>
                    </tr>
                  ))}

                  {productsSold.length === 0 && (
                    <tr>
                      <td className="p-4 text-sm text-gray-500" colSpan={4}>
                        No hay productos vendidos en ese rango.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-500">Ordenado por cantidad vendida (desc).</div>
          </div>
        </div>
      </PageShell>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="card">
      <div className="card-b">
        <div className="text-xs font-semibold text-gray-500">{title}</div>
        <div className="mt-1 text-lg font-extrabold text-gray-900">{value}</div>
      </div>
    </div>
  );
}