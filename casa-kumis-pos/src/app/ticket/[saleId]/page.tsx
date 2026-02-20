"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingCard from "@/components/LoadingCard";

export default function TicketPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params?.saleId;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!saleId) return;

    const run = async () => {
      setLoading(true);
      setErr(null);

      // 1) Sale
      const { data: saleRow, error: saleErr } = await supabase
        .from("sales")
        .select("id, receipt_number, subtotal, tax_total, total, created_at, branch_id")
        .eq("id", saleId)
        .single();

      if (saleErr) {
        setErr(saleErr.message);
        setLoading(false);
        return;
      }

      // 2) Items
      const { data: itemsRows, error: itemsErr } = await supabase
        .from("sale_items")
        .select("qty, unit_price, line_total, products(name)")
        .eq("sale_id", saleId);

      if (itemsErr) {
        setErr(itemsErr.message);
        setLoading(false);
        return;
      }

      // 3) Payments
      const { data: payRows, error: payErr } = await supabase
        .from("payments")
        .select("method, amount")
        .eq("sale_id", saleId);

      if (payErr) {
        setErr(payErr.message);
        setLoading(false);
        return;
      }

      setSale(saleRow);
      setItems(itemsRows ?? []);
      setPayments(payRows ?? []);
      setLoading(false);

      // Auto print (con diálogo)
      setTimeout(() => window.print(), 300);
    };

    run();
  }, [saleId]);

  const methodLabel = (m: string) => {
    if (m === "CASH") return "EFECTIVO";
    if (m === "CARD") return "TARJETA";
    if (m === "TRANSFER") return "TRANSFERENCIA";
    if (m === "QR") return "QR";
    return m;
  };

  const totalPayments = useMemo(
    () => payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0),
    [payments]
  );

  if (!saleId) return <div style={{ padding: 24 }}>Cargando ticket...</div>;
  if (loading) return <LoadingCard title="Cargando POS..." />;
  if (err) return <div style={{ padding: 24, color: "red" }}>Error: {err}</div>;

  return (
    <div className="ticket">
      <div className="center bold">CASA DEL KUMIS</div>
      <div className="center">NIT: 000000000-0</div>
      <div className="center">Comprobante interno - No válido DIAN</div>

      <div className="line" />

      <div>Fecha: {new Date(sale.created_at).toLocaleString("es-CO")}</div>
      <div>Comprobante: {sale.receipt_number ?? sale.id}</div>

      <div className="line" />

      {items.map((it, idx) => (
        <div key={idx} className="row">
          <div className="left">
            {it.qty} x {it.products?.name ?? "Producto"}
          </div>
          <div className="right">${Number(it.line_total).toLocaleString("es-CO")}</div>
        </div>
      ))}

      <div className="line" />

      <div className="row">
        <div className="left">Subtotal</div>
        <div className="right">${Number(sale.subtotal).toLocaleString("es-CO")}</div>
      </div>
      <div className="row">
        <div className="left">Impuesto</div>
        <div className="right">${Number(sale.tax_total).toLocaleString("es-CO")}</div>
      </div>
      <div className="row bold">
        <div className="left">TOTAL</div>
        <div className="right">${Number(sale.total).toLocaleString("es-CO")}</div>
      </div>

      <div className="line" />

      <div className="bold">Pagos</div>
      {payments.map((p, idx) => (
        <div key={idx} className="row">
          <div className="left">{methodLabel(p.method)}</div>
          <div className="right">${Number(p.amount).toLocaleString("es-CO")}</div>
        </div>
      ))}
      <div className="row">
        <div className="left">Total pagos</div>
        <div className="right">${Number(totalPayments).toLocaleString("es-CO")}</div>
      </div>

      <div className="line" />

      <div className="center">Gracias por su compra</div>

      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 4mm;
        }
        .ticket {
          font-family: Arial, sans-serif;
          font-size: 12px;
          width: 76mm;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 2px 0;
        }
        .left {
          flex: 1;
        }
        .right {
          min-width: 60px;
          text-align: right;
        }
        .center {
          text-align: center;
        }
        .bold {
          font-weight: 700;
        }
        .line {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        @media screen {
          body {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
}
