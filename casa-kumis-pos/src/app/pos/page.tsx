"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type PosProduct = {
  branch_product_id: string;
  product_id: string;
  name: string;
  price: number; // base sin impuesto
  is_favorite: boolean;
};

type CartItem = {
  branch_product_id: string;
  product_id: string;
  name: string;
  unit_price: number;
  qty: number;
};

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";

export default function PosPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [taxRate, setTaxRate] = useState<number>(0.08);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Cobro
  const [showPay, setShowPay] = useState(false);
  const [cash, setCash] = useState<string>("0");
  const [card, setCard] = useState<string>("0");
  const [transfer, setTransfer] = useState<string>("0");
  const [qr, setQr] = useState<string>("0");
  const [savingSale, setSavingSale] = useState(false);
  const [saleOkMsg, setSaleOkMsg] = useState<string | null>(null);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);

  // ✅ NUEVO: Cliente opcional
  const [registerCustomer, setRegisterCustomer] = useState(false);
  const [custIdentification, setCustIdentification] = useState<string>("");
  const [custName, setCustName] = useState<string>("");
  const [custPhone, setCustPhone] = useState<string>("");
  const [custEmail, setCustEmail] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");

      const id = localStorage.getItem("selected_branch_id");
      if (!id) return router.replace("/select-branch");

      const saved = sessionStorage.getItem(`cart_${id}`);
      if (saved) {
        try {
          setCart(JSON.parse(saved));
        } catch {}
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

      if (shiftErr || !shift) return router.replace("/open-shift");
      setShiftId(shift.id);

      const { data: settingsRow } = await supabase
        .from("settings")
        .select("tax_rate")
        .limit(1)
        .maybeSingle();

      if (settingsRow?.tax_rate != null) setTaxRate(Number(settingsRow.tax_rate));

      const { data: rows, error: prodErr } = await supabase
        .from("branch_products")
        .select("id, product_id, price, is_favorite, products(name)")
        .eq("branch_id", id)
        .eq("is_active", true)
        .order("is_favorite", { ascending: false });

      if (prodErr) {
        setPageError(prodErr.message);
        setLoading(false);
        return;
      }

      const mapped: PosProduct[] =
        (rows ?? []).map((r: any) => ({
          branch_product_id: r.id,
          product_id: r.product_id,
          name: r.products?.name ?? "Producto",
          price: Number(r.price ?? 0),
          is_favorite: Boolean(r.is_favorite),
        })) ?? [];

      setProducts(mapped);
      setLoading(false);
    };

    run();
  }, [router]);

  // --- Carrito
  const addToCart = (p: PosProduct) => {
    setSaleOkMsg(null);
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.branch_product_id === p.branch_product_id);
      if (idx === -1) {
        return [
          ...prev,
          {
            branch_product_id: p.branch_product_id,
            product_id: p.product_id,
            name: p.name,
            unit_price: p.price,
            qty: 1,
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
      return copy;
    });
  };

  const incQty = (branchProductId: string) => {
    setSaleOkMsg(null);
    setCart((prev) =>
      prev.map((it) => (it.branch_product_id === branchProductId ? { ...it, qty: it.qty + 1 } : it))
    );
  };

  const decQty = (branchProductId: string) => {
    setSaleOkMsg(null);
    setCart((prev) =>
      prev
        .map((it) => (it.branch_product_id === branchProductId ? { ...it, qty: it.qty - 1 } : it))
        .filter((it) => it.qty > 0)
    );
  };

  const removeItem = (branchProductId: string) => {
    setSaleOkMsg(null);
    setCart((prev) => prev.filter((it) => it.branch_product_id !== branchProductId));
  };

  const clearCart = () => {
    setSaleOkMsg(null);
    setCart([]);
    sessionStorage.removeItem(`cart_${branchId}`);
  };

  // --- Totales
  const subtotal = useMemo(() => cart.reduce((acc, it) => acc + it.unit_price * it.qty, 0), [cart]);
  const taxTotal = useMemo(() => Math.round(subtotal * taxRate * 100) / 100, [subtotal, taxRate]);
  const total = useMemo(() => Math.round((subtotal + taxTotal) * 100) / 100, [subtotal, taxTotal]);

  const favorite = useMemo(() => products.filter((p) => p.is_favorite), [products]);
  const others = useMemo(() => products.filter((p) => !p.is_favorite), [products]);

  useEffect(() => {
    if (!branchId) return;
    sessionStorage.setItem(`cart_${branchId}`, JSON.stringify(cart));
  }, [cart, branchId]);

  // --- Cobro helpers
  const toNum = (v: string) => {
    if (!v) return 0;

    let cleaned = v.trim();
    cleaned = cleaned.replace(/\./g, "");
    cleaned = cleaned.replace(",", ".");

    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  const paymentsSum = useMemo(() => {
    return Math.round((toNum(cash) + toNum(card) + toNum(transfer) + toNum(qr)) * 100) / 100;
  }, [cash, card, transfer, qr]);

  const openPayModal = () => {
    setPayError(null);
    setSaleOkMsg(null);

    setCash("0");
    setCard("0");
    setTransfer("0");
    setQr("0");

    // ✅ reset cliente
    setRegisterCustomer(false);
    setCustIdentification("");
    setCustName("");
    setCustPhone("");
    setCustEmail("");

    setShowPay(true);
  };

  const closePayModal = () => setShowPay(false);

  const saveSale = async () => {
    if (!branchId || !shiftId) return;

    setPayError(null);
    setSavingSale(true);

    // Validación carrito
    if (cart.length === 0) {
      setSavingSale(false);
      setPayError("El carrito está vacío.");
      return;
    }

    const sum = paymentsSum;
    if (Math.round((sum - total) * 100) / 100 !== 0) {
      setSavingSale(false);
      setPayError(`Los pagos no cuadran. Pagos: ${sum} / Total: ${total}`);
      return;
    }

    // Construir pagos (solo los > 0)
    const payRows: { method: PaymentMethod; amount: number }[] = [];
    const c = toNum(cash);
    const ca = toNum(card);
    const tr = toNum(transfer);
    const q = toNum(qr);

    if (c > 0) payRows.push({ method: "CASH", amount: c });
    if (ca > 0) payRows.push({ method: "CARD", amount: ca });
    if (tr > 0) payRows.push({ method: "TRANSFER", amount: tr });
    if (q > 0) payRows.push({ method: "QR", amount: q });

    if (payRows.length === 0) {
      setSavingSale(false);
      setPayError("Debes ingresar al menos un método de pago.");
      return;
    }

    // ✅ NUEVO: customer_id opcional
    let customerId: string | null = null;

    if (registerCustomer) {
      if (!custIdentification.trim() || !custName.trim()) {
        setSavingSale(false);
        setPayError("Para registrar cliente debes ingresar Identificación y Nombre.");
        return;
      }

      const { data: custId, error: custErr } = await supabase.rpc("upsert_customer", {
        p_identification: custIdentification.trim(),
        p_name: custName.trim(),
        p_phone: custPhone.trim() || null,
        p_email: custEmail.trim() || null,
      });

      if (custErr || !custId) {
        setSavingSale(false);
        setPayError(custErr?.message ?? "Error creando cliente.");
        return;
      }

      customerId = String(custId);
    }

    // 1) Insert sale
    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert({
        branch_id: branchId,
        shift_id: shiftId,
        subtotal,
        tax_total: taxTotal,
        total,
        customer_id: customerId, // ✅ NUEVO
      })
      .select("id,total")
      .single();

    if (saleErr || !saleRow) {
      setSavingSale(false);
      setPayError(saleErr?.message ?? "Error creando venta.");
      return;
    }

    const saleId = saleRow.id as string;

    // 2) Insert sale_items
    const itemsToInsert = cart.map((it) => ({
      sale_id: saleId,
      product_id: it.product_id,
      qty: it.qty,
      unit_price: it.unit_price,
      line_total: Math.round(it.unit_price * it.qty * 100) / 100,
    }));

    const { error: itemsErr } = await supabase.from("sale_items").insert(itemsToInsert);
    if (itemsErr) {
      setSavingSale(false);
      setPayError(itemsErr.message);
      return;
    }

    // 3) Insert payments
    const paymentsToInsert = payRows.map((p) => ({
      sale_id: saleId,
      method: p.method,
      amount: p.amount,
    }));

    const { error: payErr } = await supabase.from("payments").insert(paymentsToInsert);
    if (payErr) {
      setSavingSale(false);
      setPayError(payErr.message);
      return;
    }

    // 4) Update shift expected_total += total
    const { data: shiftRow, error: shGetErr } = await supabase
      .from("shifts")
      .select("expected_total")
      .eq("id", shiftId)
      .single();

    if (shGetErr) {
      setSavingSale(false);
      setPayError(shGetErr.message);
      return;
    }

    const currentExpected = Number(shiftRow.expected_total ?? 0);
    const newExpected = Math.round((currentExpected + total) * 100) / 100;

    const { error: shUpdErr } = await supabase
      .from("shifts")
      .update({ expected_total: newExpected })
      .eq("id", shiftId);

    if (shUpdErr) {
      setSavingSale(false);
      setPayError(shUpdErr.message);
      return;
    }

    // OK
    setSavingSale(false);
    setShowPay(false);
    setCart([]);
    setSaleOkMsg(`Venta guardada ✅ (ID: ${saleId})`);
    setLastSaleId(saleId);
    setPrintingSaleId(saleId);
    sessionStorage.removeItem(`cart_${branchId}`);
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando POS...</div>;
  if (pageError) return <div style={{ padding: 24, color: "red" }}>Error: {pageError}</div>;

  return (
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
      {/* IZQUIERDA */}
      <div>
        <h1>POS</h1>
        <p style={{ opacity: 0.7 }}>Sucursal: {branchId}</p>
        <p style={{ opacity: 0.7 }}>Turno: {shiftId}</p>
        <p style={{ opacity: 0.7 }}>Impuesto: {(taxRate * 100).toFixed(2)}%</p>

        <h2 style={{ marginTop: 16 }}>Favoritos</h2>
        <div
          style={{
            opacity: savingSale ? 0.5 : 1,
            pointerEvents: savingSale ? "none" : "auto",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {favorite.map((p) => (
            <button
              key={p.branch_product_id}
              disabled={savingSale}
              onClick={() => addToCart(p)}
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid #ddd",
                cursor: "pointer",
                fontSize: 16,
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ opacity: 0.7 }}>${p.price.toLocaleString("es-CO")}</div>
            </button>
          ))}
        </div>

        <h2 style={{ marginTop: 16 }}>Todos</h2>
        <div
          style={{
            opacity: savingSale ? 0.5 : 1,
            pointerEvents: savingSale ? "none" : "auto",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {others.map((p) => (
            <button
              key={p.branch_product_id}
              disabled={savingSale}
              onClick={() => addToCart(p)}
              style={{
                padding: 16,
                borderRadius: 14,
                border: "1px solid #ddd",
                cursor: "pointer",
                fontSize: 16,
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ opacity: 0.7 }}>${p.price.toLocaleString("es-CO")}</div>
            </button>
          ))}
        </div>
      </div>

      {/* DERECHA */}
      <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Carrito</h2>

          {shiftId && (
            <button
              onClick={() => {
                if (cart.length > 0) {
                  alert("No puedes cerrar turno con productos en el carrito. Finaliza la venta o vacía el carrito.");
                  return;
                }
                router.push("/close-shift");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                cursor: "pointer",
                border: "1px solid #ddd",
                background: "white",
                fontWeight: 700,
              }}
            >
              Cerrar turno
            </button>
          )}
        </div>

        {saleOkMsg && (
          <div style={{ background: "#eaffea", padding: 10, borderRadius: 10, marginTop: 10 }}>{saleOkMsg}</div>
        )}

        {cart.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Toca un producto para agregarlo.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {cart.map((it) => (
              <div
                key={it.branch_product_id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700 }}>{it.name}</div>
                <div style={{ opacity: 0.7 }}>Unit: ${it.unit_price.toLocaleString("es-CO")}</div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button disabled={savingSale} onClick={() => decQty(it.branch_product_id)} style={{ padding: "6px 10px" }}>
                    –
                  </button>
                  <div style={{ minWidth: 24, textAlign: "center" }}>{it.qty}</div>
                  <button disabled={savingSale} onClick={() => incQty(it.branch_product_id)} style={{ padding: "6px 10px" }}>
                    +
                  </button>

                  <button
                    disabled={savingSale}
                    onClick={() => removeItem(it.branch_product_id)}
                    style={{ marginLeft: "auto", padding: "6px 10px" }}
                  >
                    Quitar
                  </button>
                </div>

                <div style={{ fontWeight: 700 }}>Línea: ${(it.unit_price * it.qty).toLocaleString("es-CO")}</div>
              </div>
            ))}
          </div>
        )}

        <hr style={{ margin: "16px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span>
          <strong>${subtotal.toLocaleString("es-CO")}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span>Impuesto</span>
          <strong>${taxTotal.toLocaleString("es-CO")}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 18 }}>
          <span>Total</span>
          <strong>${total.toLocaleString("es-CO")}</strong>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button disabled={cart.length === 0 || savingSale} onClick={clearCart} style={{ padding: 10, borderRadius: 10, cursor: "pointer" }}>
            Vaciar
          </button>

          <button
            onClick={openPayModal}
            disabled={cart.length === 0 || savingSale}
            style={{ padding: 10, borderRadius: 10, cursor: "pointer", flex: 1 }}
          >
            Cobrar
          </button>
        </div>
      </div>

      {/* MODAL PAGO */}
      {showPay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div style={{ width: 460, background: "white", borderRadius: 16, padding: 16 }}>
            <h2>Cobrar</h2>
            <p style={{ opacity: 0.7 }}>Total a pagar: ${total.toLocaleString("es-CO")}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <label>
                Efectivo
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9.,]*"
                  value={cash}
                  disabled={savingSale}
                  onChange={(e) => setCash(e.target.value)}
                  style={{ width: "80%", padding: 8 }}
                />
              </label>

              <label>
                Tarjeta
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9.,]*"
                  value={card}
                  disabled={savingSale}
                  onChange={(e) => setCard(e.target.value)}
                  style={{ width: "80%", padding: 8 }}
                />
              </label>

              <label>
                Transferencia
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9.,]*"
                  value={transfer}
                  disabled={savingSale}
                  onChange={(e) => setTransfer(e.target.value)}
                  style={{ width: "80%", padding: 8 }}
                />
              </label>

              <label>
                QR
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9.,]*"
                  value={qr}
                  disabled={savingSale}
                  onChange={(e) => setQr(e.target.value)}
                  style={{ width: "80%", padding: 8 }}
                />
              </label>

              <div style={{ marginTop: 6 }}>
                <strong>Pagos:</strong> ${paymentsSum.toLocaleString("es-CO")}
              </div>

              {/* ✅ NUEVO: Cliente opcional */}
              <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 6 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={registerCustomer}
                    disabled={savingSale}
                    onChange={(e) => setRegisterCustomer(e.target.checked)}
                  />
                  <strong>Registrar cliente</strong>
                </label>

                {!registerCustomer && (
                  <div style={{ marginTop: 6, opacity: 0.75 }}>
                    Cliente: <strong>CONSUMIDOR FINAL</strong>
                  </div>
                )}

                {registerCustomer && (
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <input
                      value={custIdentification}
                      disabled={savingSale}
                      onChange={(e) => setCustIdentification(e.target.value)}
                      placeholder="Identificación (cédula/NIT)"
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                    <input
                      value={custName}
                      disabled={savingSale}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="Nombre / Razón social"
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                    <input
                      value={custPhone}
                      disabled={savingSale}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="Teléfono (opcional)"
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                    <input
                      value={custEmail}
                      disabled={savingSale}
                      onChange={(e) => setCustEmail(e.target.value)}
                      placeholder="Email (opcional)"
                      style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                    />
                  </div>
                )}
              </div>

              {payError && <div style={{ color: "red" }}>{payError}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={closePayModal} disabled={savingSale} style={{ padding: 10, borderRadius: 10 }}>
                  Cancelar
                </button>

                <button onClick={saveSale} disabled={savingSale} style={{ padding: 10, borderRadius: 10, flex: 1 }}>
                  {savingSale ? "Guardando..." : "Confirmar pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printingSaleId && (
        <div className="print-layer">
          <TicketInline
            saleId={printingSaleId}
            onPrinted={() => {
              setPrintingSaleId(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function TicketInline({
  saleId,
  onPrinted,
}: {
  saleId: string;
  onPrinted: () => void;
}) {
  const [sale, setSale] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const methodLabel = (m: string) => {
    if (m === "CASH") return "EFECTIVO";
    if (m === "CARD") return "TARJETA";
    if (m === "TRANSFER") return "TRANSFERENCIA";
    if (m === "QR") return "QR";
    return m;
  };

  useEffect(() => {
    const run = async () => {
      const { data: saleRow } = await supabase
        .from("sales")
        .select("id, receipt_number, subtotal, tax_total, total, created_at, branch_id, branches(name), customers(identification,name)")
        .eq("id", saleId)
        .single();

      const { data: itemsRows } = await supabase
        .from("sale_items")
        .select("qty, unit_price, line_total, products(name)")
        .eq("sale_id", saleId);

      const { data: payRows } = await supabase
        .from("payments")
        .select("method, amount")
        .eq("sale_id", saleId);

      setSale(saleRow);
      setItems(itemsRows ?? []);
      setPayments(payRows ?? []);

      setTimeout(() => {
        window.print();
        setTimeout(() => onPrinted(), 500);
      }, 300);
    };

    run();
  }, [saleId, onPrinted]);

  if (!sale) return null;

  const totalQty = items.reduce((acc, it) => acc + Number(it.qty ?? 0), 0);
  const totalPayments = payments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  const receipt = sale.receipt_number
    ? `LF-${String(sale.receipt_number).padStart(6, "0")}`
    : String(sale.id).slice(0, 8).toUpperCase();

  const branchName = sale.branches?.name ?? "Sucursal";

  const customerName = sale.customers?.name ?? "CONSUMIDOR FINAL";
  const customerId = sale.customers?.identification ?? null;

  return (
    <div className="ticket">
      <img src="/logo.png" style={{ width: 120, margin: "0 auto", display: "block" }} />

      {/* ENCABEZADO */}
      <div className="center bold">CASA DEL KUMIS</div>
      <div className="center">NIT: 000000000-0</div>
      <div className="center">Comprobante interno - No válido DIAN</div>

      <div className="line" />

      {/* META */}
      <div>Fecha: {new Date(sale.created_at).toLocaleString("es-CO")}</div>
      <div>Sucursal: {branchName}</div>
      <div>Comprobante: {receipt}</div>

      <div className="line" />

      {/* ✅ NUEVO: CLIENTE */}
      <div>Cliente: {customerName}</div>
      {customerId && <div>Identificación: {customerId}</div>}

      <div className="line" />

      {/* ITEMS */}
      {items.map((it, i) => (
        <div key={i} className="item">
          <div className="row">
            <div className="left">
              {it.qty} x {it.products?.name ?? "Producto"}
            </div>
            <div className="right">${Number(it.line_total).toLocaleString("es-CO")}</div>
          </div>
          <div className="muted">Unit: ${Number(it.unit_price).toLocaleString("es-CO")}</div>
        </div>
      ))}

      <div className="line" />

      {/* TOTALES */}
      <div className="row">
        <div className="left">Subtotal</div>
        <div className="right">${Number(sale.subtotal).toLocaleString("es-CO")}</div>
      </div>
      <div className="row">
        <div className="left">Impoconsumo</div>
        <div className="right">${Number(sale.tax_total).toLocaleString("es-CO")}</div>
      </div>

      <div className="row bold">
        <div className="left">TOTAL</div>
        <div className="right">${Number(sale.total).toLocaleString("es-CO")}</div>
      </div>

      <div className="row">
        <div className="left">Total artículos</div>
        <div className="right">{totalQty}</div>
      </div>

      <div className="line" />

      {/* PAGOS */}
      <div className="bold">Pagos</div>
      {payments.map((p, i) => (
        <div key={i} className="row">
          <div className="left">{methodLabel(p.method)}</div>
          <div className="right">${Number(p.amount).toLocaleString("es-CO")}</div>
        </div>
      ))}
      <div className="row bold">
        <div className="left">TOTAL PAGOS</div>
        <div className="right">${Number(totalPayments).toLocaleString("es-CO")}</div>
      </div>

      <div className="line" />

      {/* FOOTER */}
      <div className="center">Gracias por su compra</div>

      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 2mm;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          .print-layer,
          .print-layer * {
            visibility: visible !important;
          }

          .print-layer {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 0;
            margin: 0;
            background: #fff;
          }
        }

        .ticket {
          font-family: Arial, sans-serif;
          font-size: 11px;
          width: 76mm;
          line-height: 1.2;
        }

        .center {
          text-align: center;
        }

        .bold {
          font-weight: 700;
        }

        .line {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 2px 0;
        }

        .left {
          flex: 1;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .right {
          min-width: 62px;
          text-align: right;
          white-space: nowrap;
        }

        .muted {
          opacity: 0.75;
          font-size: 10px;
          margin-top: 1px;
        }

        .item {
          margin-bottom: 4px;
        }

        .logo {
          display: block;
          margin: 0 auto 4px auto;
          max-width: 120px;
          height: auto;
        }
      `}</style>
    </div>
  );
}
