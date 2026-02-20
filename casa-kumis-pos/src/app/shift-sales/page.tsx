"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LoadingCard from "@/components/LoadingCard";

type SaleRow = {
  id: string;
  receipt_number: number | null;
  subtotal: number;
  tax_total: number;
  total: number;
  created_at: string;
};

type SaleDetail = {
  items: Array<{
    id: string;
    qty: number;
    unit_price: number;
    line_total: number;
    name: string;
  }>;
  payments: Array<{
    method: string;
    amount: number;
  }>;
};

export default function ShiftSalesPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SaleDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const methodLabel = (m: string) => {
    if (m === "CASH") return "EFECTIVO";
    if (m === "CARD") return "TARJETA";
    if (m === "TRANSFER") return "TRANSFERENCIA";
    if (m === "QR") return "QR";
    return m;
  };

  const receiptLabel = (sale: SaleRow) => {
    if (sale.receipt_number != null) {
      return `LF-${String(sale.receipt_number).padStart(6, "0")}`;
    }
    return String(sale.id).slice(0, 8).toUpperCase();
  };

  // ✅ Guard: logueado + role CASHIER/ADMIN
  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        router.replace("/login");
        return;
      }

      const userId = sess.session.user.id;

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (profErr) {
        router.replace("/pos");
        return;
      }

      const role = String(prof?.role ?? "");
      if (role !== "ADMIN" && role !== "CASHIER") {
        router.replace("/pos");
        return;
      }

      setLoadingAuth(false);
    };

    run();
  }, [router]);

  const loadShiftAndSales = async () => {
    setErr(null);
    setLoading(true);

    try {
      const id = localStorage.getItem("selected_branch_id");
      if (!id) {
        router.replace("/select-branch");
        return;
      }
      setBranchId(id);

      const { data: shift, error: shiftErr } = await supabase
        .from("shifts")
        .select("id,status")
        .eq("branch_id", id)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shiftErr || !shift) {
        router.replace("/open-shift");
        return;
      }

      setShiftId(shift.id);

      const { data: sRows, error: sErr } = await supabase
        .from("sales")
        .select("id,receipt_number,subtotal,tax_total,total,created_at")
        .eq("shift_id", shift.id)
        .order("created_at", { ascending: false });

      if (sErr) throw new Error(sErr.message);

      setSales(
        (sRows ?? []).map((r: any) => ({
          id: String(r.id),
          receipt_number: r.receipt_number == null ? null : Number(r.receipt_number),
          subtotal: Number(r.subtotal ?? 0),
          tax_total: Number(r.tax_total ?? 0),
          total: Number(r.total ?? 0),
          created_at: String(r.created_at),
        }))
      );

      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setErr(e.message ?? "Error cargando historial del turno.");
    }
  };

  useEffect(() => {
    if (loadingAuth) return;
    loadShiftAndSales().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAuth]);

  const totals = useMemo(() => {
    const sum = sales.reduce(
      (acc, s) => {
        acc.subtotal += s.subtotal;
        acc.tax += s.tax_total;
        acc.total += s.total;
        return acc;
      },
      { subtotal: 0, tax: 0, total: 0 }
    );

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      count: sales.length,
      subtotal: round2(sum.subtotal),
      tax: round2(sum.tax),
      total: round2(sum.total),
    };
  }, [sales]);

  const toggleSale = async (saleId: string) => {
    // cerrar si ya está abierto
    if (openSaleId === saleId) {
      setOpenSaleId(null);
      return;
    }

    setOpenSaleId(saleId);

    // si ya está cacheado, no vuelvas a pedir
    if (details[saleId]) return;

    setLoadingDetailId(saleId);
    setErr(null);

    try {
      const { data: itemsRows, error: itemsErr } = await supabase
        .from("sale_items")
        .select("id,qty,unit_price,line_total,products(name)")
        .eq("sale_id", saleId);

      if (itemsErr) throw new Error(itemsErr.message);

      const { data: payRows, error: payErr } = await supabase
        .from("payments")
        .select("method,amount")
        .eq("sale_id", saleId);

      if (payErr) throw new Error(payErr.message);

      const mapped: SaleDetail = {
        items: (itemsRows ?? []).map((it: any) => ({
          id: String(it.id),
          qty: Number(it.qty ?? 0),
          unit_price: Number(it.unit_price ?? 0),
          line_total: Number(it.line_total ?? 0),
          name: it.products?.name ?? "Producto",
        })),
        payments: (payRows ?? []).map((p: any) => ({
          method: String(p.method),
          amount: Number(p.amount ?? 0),
        })),
      };

      setDetails((prev) => ({ ...prev, [saleId]: mapped }));
      setLoadingDetailId(null);
    } catch (e: any) {
      setLoadingDetailId(null);
      setErr(e.message ?? "Error cargando detalle.");
    }
  };

  if (loadingAuth) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (loading) return <LoadingCard title="Cargando POS..." />;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Historial del turno</h1>

        <button onClick={() => router.push("/pos")} style={{ padding: 10, borderRadius: 10 }}>
          Volver al POS
        </button>

        <button onClick={() => loadShiftAndSales().catch(() => {})} style={{ padding: 10, borderRadius: 10 }}>
          Refrescar
        </button>
      </div>

      <div style={{ opacity: 0.7, marginTop: 6 }}>
        Sucursal: <strong>{branchId}</strong> · Turno: <strong>{shiftId}</strong>
      </div>

      {err && <div style={{ marginTop: 14, color: "red" }}>Error: {err}</div>}

      {/* Resumen */}
      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Ventas</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{totals.count}</div>
          </div>

          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Subtotal</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>${totals.subtotal.toLocaleString("es-CO")}</div>
          </div>

          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Impuesto</div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>${totals.tax.toLocaleString("es-CO")}</div>
          </div>

          <div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>Total</div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>${totals.total.toLocaleString("es-CO")}</div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", background: "#fafafa" }}>
          <strong>Ventas del turno</strong>
        </div>

        {sales.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>Todavía no hay ventas en este turno.</div>
        ) : (
          <div>
            {sales.map((s) => {
              const isOpen = openSaleId === s.id;
              const det = details[s.id];

              const totalPayments = det
                ? det.payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0)
                : 0;

              return (
                <div key={s.id} style={{ borderTop: "1px solid #eee" }}>
                  {/* cabecera venta */}
                  <button
                    onClick={() => toggleSale(s.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      border: "none",
                      background: "white",
                      cursor: "pointer",
                      display: "grid",
                      gridTemplateColumns: "160px 1fr 160px",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{receiptLabel(s)}</div>
                    <div style={{ opacity: 0.8 }}>
                      {new Date(s.created_at).toLocaleString("es-CO")}
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 900 }}>
                      ${s.total.toLocaleString("es-CO")}
                    </div>
                  </button>

                  {/* detalle */}
                  {isOpen && (
                    <div style={{ padding: 12, background: "#fcfcfc" }}>
                      {loadingDetailId === s.id && (
                        <div style={{ opacity: 0.7 }}>Cargando detalle…</div>
                      )}

                      {det && (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {/* Items */}
                            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
                              <div style={{ fontWeight: 900, marginBottom: 8 }}>Productos</div>

                              {det.items.length === 0 ? (
                                <div style={{ opacity: 0.7 }}>Sin items.</div>
                              ) : (
                                <div style={{ display: "grid", gap: 8 }}>
                                  {det.items.map((it) => (
                                    <div key={it.id} style={{ borderBottom: "1px dashed #eee", paddingBottom: 8 }}>
                                      <div style={{ fontWeight: 800 }}>{it.name}</div>
                                      <div style={{ opacity: 0.8, fontSize: 13 }}>
                                        {it.qty} x ${it.unit_price.toLocaleString("es-CO")} ·{" "}
                                        <strong>${it.line_total.toLocaleString("es-CO")}</strong>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Pagos + totales */}
                            <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "white" }}>
                              <div style={{ fontWeight: 900, marginBottom: 8 }}>Pagos</div>

                              {det.payments.length === 0 ? (
                                <div style={{ opacity: 0.7 }}>Sin pagos.</div>
                              ) : (
                                <div style={{ display: "grid", gap: 6 }}>
                                  {det.payments.map((p, idx) => (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span>{methodLabel(p.method)}</span>
                                      <strong>${Number(p.amount).toLocaleString("es-CO")}</strong>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <hr style={{ margin: "10px 0" }} />

                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span>Subtotal</span>
                                  <strong>${s.subtotal.toLocaleString("es-CO")}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span>Impuesto</span>
                                  <strong>${s.tax_total.toLocaleString("es-CO")}</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
                                  <span style={{ fontWeight: 900 }}>TOTAL</span>
                                  <span style={{ fontWeight: 900 }}>${s.total.toLocaleString("es-CO")}</span>
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, opacity: 0.85 }}>
                                  <span>Total pagos</span>
                                  <strong>${Number(totalPayments).toLocaleString("es-CO")}</strong>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
