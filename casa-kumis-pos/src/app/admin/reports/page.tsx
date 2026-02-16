"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";

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

    // branches
    const { data: b, error: bErr } = await supabase
      .from("branches")
      .select("id,name,is_active")
      .order("name");

    if (bErr) throw new Error(bErr.message);
    setBranches((b ?? []).map((x: any) => ({ id: x.id, name: x.name, is_active: Boolean(x.is_active) })));

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
      setErr(e.message ?? "Error cargando reportes");
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

  if (loading) return <div style={{ padding: 24 }}>Cargando reportes admin…</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>Error: {err}</div>;

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Admin · Reportes</h1>

        <button onClick={() => router.push("/admin")} style={{ padding: 10, borderRadius: 10 }}>
          Volver
        </button>

        <button onClick={() => load().catch(()=>{})} style={{ padding: 10, borderRadius: 10 }}>
          Consultar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Filtros</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Desde{" "}
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <label>
            Hasta{" "}
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <label>
            Sucursal{" "}
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", minWidth: 220 }}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {!b.is_active ? "(inactiva)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 10, opacity: 0.7 }}>
          Tip: para “mes”, usa Desde = primer día del mes y Hasta = último día del mes.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
        <Kpi title="Total ventas" value={`$${kpis.totalSales.toLocaleString("es-CO")}`} />
        <Kpi title="Efectivo" value={`$${kpis.cash.toLocaleString("es-CO")}`} />
        <Kpi title="Tarjeta" value={`$${kpis.card.toLocaleString("es-CO")}`} />
        <Kpi title="Transfer" value={`$${kpis.transfer.toLocaleString("es-CO")}`} />
        <Kpi title="QR" value={`$${kpis.qr.toLocaleString("es-CO")}`} />
        <Kpi title="# Facturas" value={`${kpis.count}`} />
      </div>

      {/* Tabla ventas */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Facturas</h2>

        <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={th}>Fecha</th>
                <th style={th}>Sucursal</th>
                <th style={th}>Comprobante</th>
                <th style={th}>Total</th>
                <th style={th}>Efectivo</th>
                <th style={th}>Tarjeta</th>
                <th style={th}>Transfer</th>
                <th style={th}>QR</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.sale_id}>
                  <td style={td}>{new Date(s.created_at).toLocaleString("es-CO")}</td>
                  <td style={td}>{s.branch_name}</td>
                  <td style={td}>{s.receipt_number ?? "-"}</td>
                  <td style={td}>${s.total.toLocaleString("es-CO")}</td>
                  <td style={td}>${s.pay_cash.toLocaleString("es-CO")}</td>
                  <td style={td}>${s.pay_card.toLocaleString("es-CO")}</td>
                  <td style={td}>${s.pay_transfer.toLocaleString("es-CO")}</td>
                  <td style={td}>${s.pay_qr.toLocaleString("es-CO")}</td>
                </tr>
              ))}

              {sales.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>
                    No hay ventas en ese rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Productos vendidos */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Productos vendidos</h2>

        <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={th}>Sucursal</th>
                <th style={th}>Producto</th>
                <th style={th}>Cantidad</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {productsSold.map((p) => (
                <tr key={`${p.branch_id}_${p.product_id}`}>
                  <td style={td}>{p.branch_name}</td>
                  <td style={td}>{p.product_name}</td>
                  <td style={td}>{p.qty_sold}</td>
                  <td style={td}>${p.total_sold.toLocaleString("es-CO")}</td>
                </tr>
              ))}

              {productsSold.length === 0 && (
                <tr>
                  <td style={td} colSpan={4}>
                    No hay productos vendidos en ese rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, opacity: 0.7 }}>
          Ordenado por cantidad vendida (desc).
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ opacity: 0.7, fontSize: 12 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const th: React.CSSProperties = { textAlign: "left", padding: 10, borderBottom: "1px solid #eee", fontSize: 12 };
const td: React.CSSProperties = { padding: 10, borderBottom: "1px solid #f1f1f1", fontSize: 12 };
