// ✅ PEGA ESTO EN: casa-kumis-pos\src\app\pos\page.tsx
// Reemplaza tu archivo completo por este SOLO si te queda más fácil,
// o copia/pega por bloques siguiendo los comentarios "PEGA AQUÍ".

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";
import PrintPortal from "@/components/PrintPortal";

type PosProduct = {
  branch_product_id: string;
  product_id: string;
  name: string;
  price: number;
  is_favorite: boolean;
  image_url?: string | null;
};

type CartItem = {
  branch_product_id: string;
  product_id: string;
  name: string;
  unit_price: number;
  qty: number;
  image_url?: string | null;
};

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";

type Customer = {
  id: string;
  identification: string;
  name: string;
  phone: string | null;
  email: string | null;
};

// ✅ NUEVO: Tipos para historial
type SaleHistoryRow = {
  id: string;
  receipt_number: number | null;
  total: number;
  created_at: string;
  customers: { name: string; identification: string } | null;
};

type PaymentRow = {
  method: PaymentMethod;
  amount: number;
};

export default function PosPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);

  // ✅ para UI humana
  const [branchName, setBranchName] = useState<string>("-");
  const [shiftOpenedAt, setShiftOpenedAt] = useState<string | null>(null);

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
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);

  // =========================
  // ✅ Clientes (POS)
  // =========================
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // crear cliente rápido
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const [newCustId, setNewCustId] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");

  // =========================
  // ✅ NUEVO: Historial del turno (modal)
  // =========================
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySales, setHistorySales] = useState<SaleHistoryRow[]>([]);
  const [historyPaymentsBySale, setHistoryPaymentsBySale] = useState<Record<string, PaymentRow[]>>({});

  const loadTaxRate = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "tax_rate")
        .single();

      if (error) throw new Error(error.message);

      const rate = Number(data?.value ?? "0.08");
      return Number.isNaN(rate) ? 0.08 : rate;
    } catch {
      return 0.08;
    }
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, identification, name, phone, email")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const mapped: Customer[] = (data ?? [])
      .filter((c: any) => c?.id) // ✅ blindaje
      .map((c: any) => ({
        id: String(c.id),
        identification: String(c.identification ?? ""),
        name: String(c.name ?? ""),
        phone: c.phone ? String(c.phone) : null,
        email: c.email ? String(c.email) : null,
      }));

    setCustomers(mapped);

    const cf =
      mapped.find((x) => x.identification === "CF") ||
      mapped.find((x) => x.name?.toUpperCase() === "CONSUMIDOR FINAL");

    setSelectedCustomerId(cf ? cf.id : null);
  };

  const ensureConsumidorFinal = async (): Promise<Customer> => {
    const inState =
      customers.find((x) => x.identification === "CF") ||
      customers.find((x) => x.name?.toUpperCase() === "CONSUMIDOR FINAL");
    if (inState) return inState;

    const { data: existing, error: exErr } = await supabase
      .from("customers")
      .select("id,identification,name,phone,email")
      .or("identification.eq.CF,name.ilike.%CONSUMIDOR FINAL%")
      .limit(1)
      .maybeSingle();

    if (exErr) throw new Error(exErr.message);

    if (existing?.id) {
      return {
        id: String(existing.id),
        identification: String(existing.identification ?? "CF"),
        name: String(existing.name ?? "CONSUMIDOR FINAL"),
        phone: existing.phone ? String(existing.phone) : null,
        email: existing.email ? String(existing.email) : null,
      };
    }

    const { data: created, error: cErr } = await supabase
      .from("customers")
      .insert({
        identification: "CF",
        name: "CONSUMIDOR FINAL",
        phone: null,
        email: null,
      })
      .select("id,identification,name,phone,email")
      .single();

    if (cErr || !created) throw new Error(cErr?.message ?? "No se pudo crear CONSUMIDOR FINAL.");

    return {
      id: String(created.id),
      identification: String(created.identification ?? "CF"),
      name: String(created.name ?? "CONSUMIDOR FINAL"),
      phone: created.phone ? String(created.phone) : null,
      email: created.email ? String(created.email) : null,
    };
  };

  const createCustomerQuick = async () => {
    const identification = newCustId.trim();
    const name = newCustName.trim();

    if (!identification) return setPayError("Identificación obligatoria.");
    if (!name) return setPayError("Nombre obligatorio.");

    setPayError(null);
    setCreatingCustomer(true);

    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          identification,
          name,
          phone: newCustPhone.trim() || null,
          email: newCustEmail.trim() || null,
        })
        .select("id,identification,name,phone,email")
        .single();

      if (error || !data) throw new Error(error?.message ?? "Error creando cliente.");

      const created: Customer = {
        id: String(data.id),
        identification: String(data.identification ?? ""),
        name: String(data.name ?? ""),
        phone: data.phone ? String(data.phone) : null,
        email: data.email ? String(data.email) : null,
      };

      setCustomers((prev) => [created, ...prev].slice(0, 200));
      setSelectedCustomerId(created.id);

      setNewCustId("");
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");

      setSaleOkMsg("Cliente creado ✅");
      setShowCreateCustomer(false);
      setIsCustomerDropdownOpen(false);
    } catch (e: any) {
      setPayError(e?.message ?? "No se pudo crear el cliente.");
    } finally {
      setCreatingCustomer(false);
    }
  };

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

      const { data: bRow } = await supabase.from("branches").select("name").eq("id", id).maybeSingle();
      if (bRow?.name) setBranchName(String(bRow.name));

      const { data: shift, error: shiftErr } = await supabase
        .from("shifts")
        .select("id,status,opened_at")
        .eq("branch_id", id)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shiftErr || !shift) return router.replace("/open-shift");
      setShiftId(shift.id);
      setShiftOpenedAt(shift.opened_at ? String(shift.opened_at) : null);

      const rate = await loadTaxRate();
      setTaxRate(rate);

      await loadCustomers();

      const { data: rows, error: prodErr } = await supabase
        .from("branch_products")
        .select("id, product_id, price, is_favorite, products(name,image_url)")
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
          image_url: r.products?.image_url ?? null,
        })) ?? [];

      setProducts(mapped);
      setLoading(false);
    };

    run().catch((e: any) => {
      setPageError(e?.message ?? "Error cargando POS.");
      setLoading(false);
    });
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
            image_url: p.image_url ?? null,
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
    setCart((prev) => prev.map((it) => (it.branch_product_id === branchProductId ? { ...it, qty: it.qty + 1 } : it)));
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
    let cleaned = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  const paymentsSum = useMemo(() => {
    return Math.round((toNum(cash) + toNum(card) + toNum(transfer) + toNum(qr)) * 100) / 100;
  }, [cash, card, transfer, qr]);

  const openPayModal = async () => {
    setPayError(null);
    setSaleOkMsg(null);
    setCash("0");
    setCard("0");
    setTransfer("0");
    setQr("0");
    setCustomerSearch("");
    setIsCustomerDropdownOpen(false);
    setShowCreateCustomer(false);

    try {
      const cf = await ensureConsumidorFinal();
      setSelectedCustomerId(cf.id);
      await loadCustomers();
    } catch {
      setSelectedCustomerId(null);
    }

    setShowPay(true);
  };

  const closePayModal = () => setShowPay(false);

  const formatShift = (iso: string | null) => {
    if (!iso) return "Turno activo";
    const d = new Date(iso);
    return `Turno: ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 30);

    return customers
      .filter((c) => {
        const a = (c.identification ?? "").toLowerCase();
        const b = (c.name ?? "").toLowerCase();
        const p = (c.phone ?? "").toLowerCase();
        const e = (c.email ?? "").toLowerCase();
        return a.includes(q) || b.includes(q) || p.includes(q) || e.includes(q);
      })
      .slice(0, 30);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  // =========================
  // ✅ NUEVO: cargar historial del turno
  // =========================
  const loadShiftHistory = async () => {
    if (!shiftId) return;

    setHistoryError(null);
    setHistoryLoading(true);

    try {
      // 1) Ventas del turno (blindaje por branch_id también)
      const { data: salesRows, error: salesErr } = await supabase
        .from("sales")
        .select("id, receipt_number, total, created_at, customer_id, shift_id, branch_id, customers(name,identification)")
        .eq("shift_id", shiftId)
        .eq("branch_id", branchId) // ✅ evita cruces de sucursal
        .order("created_at", { ascending: false })
        .limit(80);

      if (salesErr) throw new Error(salesErr.message);

      const mappedSales: SaleHistoryRow[] = (salesRows ?? []).map((s: any) => ({
        id: String(s.id),
        receipt_number: s.receipt_number ?? null,
        total: Number(s.total ?? 0),
        created_at: String(s.created_at),
        customers: s.customers
          ? { name: String(s.customers.name ?? ""), identification: String(s.customers.identification ?? "") }
          : null,
      }));

      setHistorySales(mappedSales);

      // 2) Pagos de esas ventas
      const saleIds = mappedSales.map((s) => s.id);
      if (saleIds.length === 0) {
        setHistoryPaymentsBySale({});
        setHistoryLoading(false);
        return;
      }

      const { data: payRows, error: payErr } = await supabase
        .from("payments")
        .select("sale_id, method, amount")
        .in("sale_id", saleIds);

      if (payErr) throw new Error(payErr.message);

      const grouped: Record<string, PaymentRow[]> = {};
      (payRows ?? []).forEach((p: any) => {
        const sid = String(p.sale_id);
        if (!grouped[sid]) grouped[sid] = [];
        grouped[sid].push({
          method: p.method as PaymentMethod,
          amount: Number(p.amount ?? 0),
        });
      });

      setHistoryPaymentsBySale(grouped);
      setHistoryLoading(false);
    } catch (e: any) {
      setHistoryLoading(false);
      setHistoryError(e?.message ?? "No se pudo cargar el historial.");
    }
  };

  const openHistoryModal = async () => {
    setShowHistory(true);
    await loadShiftHistory();
  };

  const closeHistoryModal = () => setShowHistory(false);

  const methodLabel = (m: string) => {
    if (m === "CASH") return "EFECTIVO";
    if (m === "CARD") return "TARJETA";
    if (m === "TRANSFER") return "TRANSFER";
    if (m === "QR") return "QR";
    return m;
  };

  const saveSale = async () => {
    if (!branchId || !shiftId) return;

    setPayError(null);
    setSavingSale(true);

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

    let customerId = selectedCustomerId;
    try {
      if (!customerId) {
        const cf = await ensureConsumidorFinal();
        customerId = cf.id;
      }
    } catch {
      customerId = selectedCustomerId;
    }

    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .insert({
        branch_id: branchId,
        shift_id: shiftId,
        customer_id: customerId,
        subtotal,
        tax_total: taxTotal,
        total,
      })
      .select("id,total")
      .single();

    if (saleErr || !saleRow) {
      setSavingSale(false);
      setPayError(saleErr?.message ?? "Error creando venta.");
      return;
    }

    const saleId = saleRow.id as string;

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

    // ✅ Actualizar expected_cash SOLO con lo pagado en efectivo
    const cashPaid = c;

    const { data: shiftRow, error: shGetErr } = await supabase
      .from("shifts")
      .select("expected_cash")
      .eq("id", shiftId)
      .single();

    if (shGetErr) {
      setSavingSale(false);
      setPayError(shGetErr.message);
      return;
    }

    const currentExpectedCash = Number(shiftRow.expected_cash ?? 0);
    const newExpectedCash = Math.round((currentExpectedCash + cashPaid) * 100) / 100;

    const { error: shUpdErr } = await supabase
      .from("shifts")
      .update({ expected_cash: newExpectedCash })
      .eq("id", shiftId);

    if (shUpdErr) {
      setSavingSale(false);
      setPayError(shUpdErr.message);
      return;
    }

    setSavingSale(false);
    setShowPay(false);
    setCart([]);
    setSaleOkMsg(`Venta guardada ✅ (Comprobante: ${String(saleId).slice(0, 8).toUpperCase()})`);
    setPrintingSaleId(saleId);
    sessionStorage.removeItem(`cart_${branchId}`);

    // ✅ opcional: si el historial está abierto, refrescarlo automáticamente
    if (showHistory) {
      await loadShiftHistory();
    }
  };

  if (loading) return <LoadingCard title="Cargando POS..." />;
  if (pageError) return <div className="container py-6 text-red-600">Error: {pageError}</div>;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-6 lg:px-10">
      <PageShell
        title={
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Operación</div>
              <div className="mt-1 text-3xl font-black tracking-tight text-gray-900">Punto de venta</div>
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-gray-700">Activo</span>
            </div>
          </div>
        }
        subtitle={
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white/70 px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-semibold text-gray-700">
                Sucursal: <span className="ml-1 font-extrabold">{branchName}</span>
              </span>

              <span className="text-gray-300">•</span>

              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                Turno: <span className="ml-1 font-extrabold">{formatShift(shiftOpenedAt)}</span>
              </span>

              <span className="text-gray-300">•</span>

              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                Impuesto: <span className="ml-1 font-extrabold">{(taxRate * 100).toFixed(2)}%</span>
              </span>
            </div>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {/* IZQUIERDA */}
          <div className={savingSale ? "opacity-60 pointer-events-none" : ""}>
            <Section title="Favoritos" />
            <ProductsGrid products={favorite} onClick={addToCart} disabled={savingSale} />

            <div className="h-5" />

            <Section title="Todos" />
            <ProductsGrid products={others} onClick={addToCart} disabled={savingSale} />
          </div>

          {/* DERECHA */}
          <div className="card h-fit">
            <div className="card-h flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">Carrito</div>
                <div className="text-xs text-gray-500">{cart.length ? `${cart.length} ítem(s)` : "Vacío"}</div>
              </div>

              {/* ✅ NUEVO: botones utilitarios */}
              <div className="flex gap-2">
                <button className="btn" onClick={openHistoryModal} disabled={!shiftId || savingSale}>
                  Historial
                </button>

                {shiftId && (
                  <button
                    className="btn"
                    onClick={() => {
                      if (cart.length > 0) {
                        alert("No puedes cerrar turno con productos en el carrito. Finaliza la venta o vacía el carrito.");
                        return;
                      }
                      router.push("/close-shift");
                    }}
                    disabled={savingSale}
                  >
                    Cerrar turno
                  </button>
                )}
              </div>
            </div>

            <div className="card-b">
              {saleOkMsg && <div className="alert-ok mb-4">{saleOkMsg}</div>}

              {cart.length === 0 ? (
                <p className="text-sm text-gray-500">Toca un producto para agregarlo.</p>
              ) : (
                <div className="space-y-3">
                  {cart.map((it) => (
                    <div key={it.branch_product_id} className="rounded-2xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                            {it.image_url ? (
                              <img src={it.image_url} alt={it.name} className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-[10px] text-gray-400 font-bold">IMG</div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="font-extrabold truncate">{it.name}</div>
                            <div className="text-xs text-gray-500">Unit: ${it.unit_price.toLocaleString("es-CO")}</div>
                          </div>
                        </div>

                        <div className="text-sm font-extrabold">${(it.unit_price * it.qty).toLocaleString("es-CO")}</div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <button className="btn px-3 py-1" disabled={savingSale} onClick={() => decQty(it.branch_product_id)}>
                          –
                        </button>
                        <div className="w-10 text-center font-bold">{it.qty}</div>
                        <button className="btn px-3 py-1" disabled={savingSale} onClick={() => incQty(it.branch_product_id)}>
                          +
                        </button>

                        <button
                          className="btn btn-ghost ml-auto px-3 py-1"
                          disabled={savingSale}
                          onClick={() => removeItem(it.branch_product_id)}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="my-4 border-t border-gray-200" />

              <TotalsRow label="Subtotal" value={subtotal} />
              <TotalsRow label="Impuesto" value={taxTotal} />
              <TotalsRow label="Total" value={total} bold />

              <div className="mt-4 flex gap-2">
                <button className="btn w-32" disabled={cart.length === 0 || savingSale} onClick={clearCart}>
                  Vaciar
                </button>
                <button className="btn btn-primary flex-1" disabled={cart.length === 0 || savingSale} onClick={openPayModal}>
                  Cobrar
                </button>
              </div>
            </div>
          </div>

          {/* MODAL HISTORIAL */}
          {showHistory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col">
                <div className="card-h flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold">Historial del turno</div>
                    <div className="text-sm text-gray-500">Ventas registradas en esta sucursal (informativo)</div>
                  </div>

                  <div className="flex gap-2">
                    <button className="btn" onClick={loadShiftHistory} disabled={historyLoading}>
                      {historyLoading ? "Cargando..." : "Refrescar"}
                    </button>
                    <button className="btn" onClick={closeHistoryModal}>
                      ✕
                    </button>
                  </div>
                </div>

                <div className="card-b flex-1 overflow-auto space-y-3">
                  {historyError && <div className="alert-err whitespace-pre-line">{historyError}</div>}

                  {/* Resumen */}
                  <div className="rounded-2xl border border-gray-200 p-3 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-extrabold">Ventas:</span> {historySales.length}
                      </div>
                      <div className="text-sm">
                        <span className="font-extrabold">Total vendido:</span>{" "}
                        ${historySales.reduce((acc, s) => acc + Number(s.total ?? 0), 0).toLocaleString("es-CO")}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Nota: el cierre de caja valida contra efectivo (base + ventas CASH), no contra medios electrónicos.
                    </div>
                  </div>

                  {historyLoading ? (
                    <div className="text-sm text-gray-500">Cargando historial…</div>
                  ) : historySales.length === 0 ? (
                    <div className="text-sm text-gray-500">Aún no hay ventas en este turno.</div>
                  ) : (
                    <div className="space-y-2">
                      {historySales.map((s) => {
                        const receipt = s.receipt_number
                          ? `LF-${String(s.receipt_number).padStart(6, "0")}`
                          : String(s.id).slice(0, 8).toUpperCase();

                        const dt = new Date(s.created_at);
                        const time = dt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

                        const pays = historyPaymentsBySale[s.id] ?? [];
                        const payText =
                          pays.length === 0
                            ? "Sin pagos"
                            : pays
                                .map((p) => `${methodLabel(p.method)} $${Number(p.amount).toLocaleString("es-CO")}`)
                                .join(" • ");

                        const custText = s.customers?.name
                          ? `${s.customers.name}${s.customers.identification ? ` (${s.customers.identification})` : ""}`
                          : "CONSUMIDOR FINAL";

                        return (
                          <div key={s.id} className="rounded-2xl border border-gray-200 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold truncate">
                                  {time} • {receipt}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{custText}</div>
                                <div className="mt-1 text-xs text-gray-600">{payText}</div>
                              </div>

                              <div className="text-sm font-extrabold whitespace-nowrap">
                                ${Number(s.total).toLocaleString("es-CO")}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODAL PAGO */}
          {showPay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
              <div className="card w-full max-w-md max-h-[85vh] flex flex-col">
                <div className="card-h flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold">Cobrar</div>
                    <div className="text-sm text-gray-500">
                      Total a pagar: <span className="font-bold">${total.toLocaleString("es-CO")}</span>
                    </div>
                  </div>
                  <button className="btn" onClick={closePayModal} disabled={savingSale}>
                    ✕
                  </button>
                </div>

                {/* ✅ scroll interno para que NO se corte */}
                <div className="card-b space-y-3 flex-1 overflow-auto">
                  <div className="rounded-2xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold">Cliente</div>
                      <span className="badge">{selectedCustomer ? selectedCustomer.name : "CONSUMIDOR FINAL"}</span>
                    </div>

                    <div className="mt-3 relative">
                      <button
                        type="button"
                        className="btn w-full justify-between"
                        onClick={() => setIsCustomerDropdownOpen((v) => !v)}
                        disabled={savingSale}
                      >
                        <span className="truncate">
                          {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.identification})` : "Seleccionar cliente…"}
                        </span>
                        <span className="ml-2 text-gray-500">▾</span>
                      </button>

                      {isCustomerDropdownOpen && (
                        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                          <div className="p-3 border-b border-gray-200">
                            <label className="grid gap-1">
                              <span className="label">Buscar</span>
                              <input
                                className="input"
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                placeholder="Nombre, identificación, teléfono, email…"
                                disabled={savingSale}
                              />
                            </label>
                          </div>

                          <div className="max-h-56 overflow-auto">
                            <button
                              type="button"
                              className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm ${
                                selectedCustomer?.identification === "CF" ? "bg-gray-50" : ""
                              }`}
                              onClick={async () => {
                                try {
                                  const cf = await ensureConsumidorFinal();
                                  setSelectedCustomerId(cf.id);
                                  setPayError(null);
                                  setIsCustomerDropdownOpen(false);
                                } catch (e: any) {
                                  setPayError(e?.message ?? "No se pudo seleccionar CONSUMIDOR FINAL.");
                                }
                              }}
                              disabled={savingSale}
                            >
                              <div className="font-extrabold">CONSUMIDOR FINAL</div>
                              <div className="text-xs text-gray-500">Identificación: CF</div>
                            </button>

                            <div className="border-t border-gray-200" />

                            {filteredCustomers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm ${
                                  selectedCustomerId === c.id ? "bg-gray-50" : ""
                                }`}
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setPayError(null);
                                  setIsCustomerDropdownOpen(false);
                                }}
                                disabled={savingSale}
                              >
                                <div className="font-extrabold">{c.name}</div>
                                <div className="text-xs text-gray-500">
                                  {c.identification} {c.phone ? `• ${c.phone}` : ""} {c.email ? `• ${c.email}` : ""}
                                </div>
                              </button>
                            ))}

                            {filteredCustomers.length === 0 && (
                              <div className="px-3 py-3 text-sm text-gray-500">Sin resultados.</div>
                            )}
                          </div>

                          <div className="p-3 border-t border-gray-200">
                            <button
                              type="button"
                              className="btn w-full"
                              onClick={() => setShowCreateCustomer((v) => !v)}
                              disabled={savingSale || creatingCustomer}
                            >
                              {showCreateCustomer ? "Ocultar crear cliente" : "Crear cliente rápido"}
                            </button>

                            {showCreateCustomer && (
                              <div className="mt-3 rounded-2xl border border-gray-200 p-3 space-y-2">
                                <label className="grid gap-1">
                                  <span className="label">Identificación</span>
                                  <input className="input" value={newCustId} onChange={(e) => setNewCustId(e.target.value)} disabled={savingSale} />
                                </label>

                                <label className="grid gap-1">
                                  <span className="label">Nombre</span>
                                  <input className="input" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} disabled={savingSale} />
                                </label>

                                <label className="grid gap-1">
                                  <span className="label">Teléfono (opcional)</span>
                                  <input className="input" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} disabled={savingSale} />
                                </label>

                                <label className="grid gap-1">
                                  <span className="label">Email (opcional)</span>
                                  <input className="input" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} disabled={savingSale} />
                                </label>

                                <button className="btn btn-primary w-full" onClick={createCustomerQuick} disabled={savingSale || creatingCustomer}>
                                  {creatingCustomer ? "Creando..." : "Crear cliente"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <PayInput label="Efectivo" value={cash} setValue={setCash} disabled={savingSale} />
                  <PayInput label="Tarjeta" value={card} setValue={setCard} disabled={savingSale} />
                  <PayInput label="Transferencia" value={transfer} setValue={setTransfer} disabled={savingSale} />
                  <PayInput label="QR" value={qr} setValue={setQr} disabled={savingSale} />

                  <div className="text-sm">
                    <span className="font-bold">Pagos:</span> ${paymentsSum.toLocaleString("es-CO")}
                  </div>

                  {payError && <div className="alert-err whitespace-pre-line">{payError}</div>}

                  <div className="flex gap-2 pt-2">
                    <button className="btn flex-1" onClick={closePayModal} disabled={savingSale}>
                      Cancelar
                    </button>
                    <button className="btn btn-primary flex-1" onClick={saveSale} disabled={savingSale}>
                      {savingSale ? "Guardando..." : "Confirmar pago"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRINT */}
          {printingSaleId && (
            <PrintPortal>
              <div className="print-layer">
                <TicketInline
                  saleId={printingSaleId}
                  onPrinted={() => {
                    setPrintingSaleId(null);
                  }}
                />
              </div>
            </PrintPortal>
          )}
        </div>
      </PageShell>
    </div>
  );
}

/** ===================== UI helpers ===================== */

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <span className="badge">Tap para agregar</span>
    </div>
  );
}

function ProductsGrid({
  products,
  onClick,
  disabled,
}: {
  products: PosProduct[];
  onClick: (p: PosProduct) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <button
          key={p.branch_product_id}
          disabled={disabled}
          onClick={() => onClick(p)}
          className="card p-3 text-left hover:shadow-md transition active:scale-[0.99]"
        >
          <div className="w-full aspect-square rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
            ) : (
              <div className="text-xs text-gray-400 font-semibold">Sin imagen</div>
            )}
          </div>

          <div className="mt-3">
            <div className="font-extrabold leading-tight line-clamp-2">{p.name}</div>
            <div className="text-sm text-gray-500">${p.price.toLocaleString("es-CO")}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function TotalsRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-extrabold" : "text-sm"}`}>
      <span className={bold ? "" : "text-gray-600"}>{label}</span>
      <span>${value.toLocaleString("es-CO")}</span>
    </div>
  );
}

function PayInput({
  label,
  value,
  setValue,
  disabled,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-1">
      <span className="label">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9.,]*"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        className="input"
      />
    </label>
  );
}

/** ===================== Ticket printing ===================== */

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
        .select("id, receipt_number, subtotal, tax_total, total, created_at, branch_id, branches(name)")
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

  return (
    <div className="ticket">
  <div className="center">
    <img
      src="/logo.png"
      alt="logo"
      style={{ width: "120px", marginBottom: "8px" }}
    />
  </div>

      <div className="center bold">CASA DEL KUMIS</div>
      <div className="center">NIT: 901192245-9</div>
      <div className="center">Comprobante interno - No válido DIAN</div>

      <div className="line" />

      <div>Fecha: {new Date(sale.created_at).toLocaleString("es-CO")}</div>
      <div>Sucursal: {branchName}</div>
      <div>Comprobante: {receipt}</div>

      <div className="line" />

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
      <div className="center">Gracias por su compra</div>
    </div>
  );
}