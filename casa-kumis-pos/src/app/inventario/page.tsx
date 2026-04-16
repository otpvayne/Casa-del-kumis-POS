"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";

type ProductoStock = {
  branch_product_id: string;
  product_id: string;
  name: string;
  image_url: string | null;
  stock: number;
  price: number;
};

type MovimientoType = "ENTRADA" | "AJUSTE" | "RETIRO";

const RAZONES_RETIRO = [
  "Merma",
  "Daño",
  "Vencimiento",
  "Robo",
  "Otro",
];

export default function InventarioPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string>("-");
  const [productos, setProductos] = useState<ProductoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Modal movimiento
  const [modalProducto, setModalProducto] = useState<ProductoStock | null>(null);
  const [tipoMovimiento, setTipoMovimiento] = useState<MovimientoType>("ENTRADA");
  const [cantidad, setCantidad] = useState<string>("");
  const [razon, setRazon] = useState<string>("");
  const [razonCustom, setRazonCustom] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Búsqueda
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return router.replace("/login");

      const id = localStorage.getItem("selected_branch_id");
      if (!id) return router.replace("/select-branch");
      setBranchId(id);

      const { data: bRow } = await supabase.from("branches").select("name").eq("id", id).maybeSingle();
      if (bRow?.name) setBranchName(String(bRow.name));

      await cargarProductos(id);
      setLoading(false);
    };
    run().catch((e: any) => { setErr(e?.message ?? "Error cargando inventario."); setLoading(false); });
  }, [router]);

  const cargarProductos = async (id: string) => {
    const { data, error } = await supabase
      .from("branch_products")
      .select("id, product_id, price, stock, products(name, image_url)")
      .eq("branch_id", id)
      .eq("is_active", true)
      .order("stock", { ascending: true });

    if (error) throw new Error(error.message);

    const mapped: ProductoStock[] = (data ?? []).map((r: any) => ({
      branch_product_id: r.id,
      product_id: r.product_id,
      name: r.products?.name ?? "Producto",
      image_url: r.products?.image_url ?? null,
      stock: Number(r.stock ?? 0),
      price: Number(r.price ?? 0),
    }));

    setProductos(mapped);
  };

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.name.toLowerCase().includes(q));
  }, [productos, search]);

  const abrirModal = (p: ProductoStock) => {
    setModalProducto(p);
    setTipoMovimiento("ENTRADA");
    setCantidad("");
    setRazon("");
    setRazonCustom("");
    setModalErr(null);
    setOkMsg(null);
  };

  const cerrarModal = () => {
    setModalProducto(null);
    setModalErr(null);
  };

  const guardarMovimiento = async () => {
    if (!modalProducto || !branchId) return;
    const qty = parseInt(cantidad.trim(), 10);
    if (!cantidad.trim() || isNaN(qty) || qty <= 0) {
      setModalErr("Ingresa una cantidad válida mayor a 0.");
      return;
    }

    const razonFinal = razon === "Otro" ? razonCustom.trim() : razon.trim();

    if (tipoMovimiento === "RETIRO" && !razonFinal) {
      setModalErr("Debes indicar el motivo del retiro.");
      return;
    }

    // Validar que RETIRO no deje stock negativo
    if (tipoMovimiento === "RETIRO" && qty > modalProducto.stock) {
      setModalErr(`No puedes retirar ${qty} unidades. Stock actual: ${modalProducto.stock}.`);
      return;
    }

    setModalErr(null);
    setGuardando(true);

    try {
      // Cantidad: positiva para ENTRADA y AJUSTE, negativa para RETIRO
      const cantidadFinal = tipoMovimiento === "RETIRO" ? -qty : qty;

      const { error } = await supabase.rpc("registrar_movimiento_inventario", {
        p_branch_id: branchId,
        p_branch_product_id: modalProducto.branch_product_id,
        p_product_id: modalProducto.product_id,
        p_type: tipoMovimiento,
        p_quantity: cantidadFinal,
        p_reason: razonFinal || null,
      });

      if (error) throw new Error(error.message);

      // Actualizar stock local
      const nuevoStock = modalProducto.stock + cantidadFinal;
      setProductos((prev) =>
        prev.map((p) =>
          p.branch_product_id === modalProducto.branch_product_id
            ? { ...p, stock: nuevoStock }
            : p
        ).sort((a, b) => a.stock - b.stock)
      );

      const label = tipoMovimiento === "ENTRADA" ? "agregadas" : tipoMovimiento === "RETIRO" ? "retiradas" : "ajustadas";
      setOkMsg(`✅ ${qty} unidades ${label}. Nuevo stock: ${nuevoStock}`);
      setCantidad("");
      setRazon("");
      setRazonCustom("");
      setModalProducto((prev) => prev ? { ...prev, stock: nuevoStock } : null);
    } catch (e: any) {
      setModalErr(e.message ?? "Error registrando movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  const stockColor = (stock: number) => {
    if (stock <= 0) return "text-red-600 bg-red-50 border-red-200";
    if (stock <= 5) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  };

  if (loading) return <LoadingCard title="Cargando inventario..." />;

  return (
    <div className="container py-8">
      <PageShell
        title="Inventario"
        subtitle={`Gestiona el stock de productos en ${branchName}.`}
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={() => branchId && cargarProductos(branchId).catch(() => {})}>
              Refrescar
            </button>
            <button className="btn" onClick={() => router.push("/pos")}>
              Volver al POS
            </button>
          </div>
        }
      >
        {err && <div className="alert-err mb-4">{err}</div>}

        {/* Buscador */}
        <div className="card mb-4">
          <div className="card-b">
            <input
              className="input w-full"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Sin stock", count: productos.filter((p) => p.stock <= 0).length, color: "border-red-200 bg-red-50 text-red-700" },
            { label: "Stock bajo (≤5)", count: productos.filter((p) => p.stock > 0 && p.stock <= 5).length, color: "border-amber-200 bg-amber-50 text-amber-700" },
            { label: "Con stock", count: productos.filter((p) => p.stock > 5).length, color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-3 text-center ${s.color}`}>
              <div className="text-2xl font-black">{s.count}</div>
              <div className="text-xs font-semibold mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Lista de productos */}
        <div className="card">
          <div className="card-h">
            <div className="text-lg font-extrabold">Productos</div>
            <div className="text-sm text-gray-500">{filtrados.length} producto(s)</div>
          </div>
          <div className="card-b space-y-2">
            {filtrados.length === 0 ? (
              <div className="text-sm text-gray-500">No hay productos.</div>
            ) : (
              filtrados.map((p) => (
                <div key={p.branch_product_id} className="rounded-2xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
                        ) : (
                          <div className="text-[10px] text-gray-400 font-bold">IMG</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">{p.name}</div>
                        <div className="text-xs text-gray-500">${p.price.toLocaleString("es-CO")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`rounded-2xl border px-3 py-1 text-sm font-extrabold ${stockColor(p.stock)}`}>
                        {p.stock <= 0 ? "Sin stock" : `${p.stock} und.`}
                      </span>
                      <button
                        className="btn btn-primary"
                        onClick={() => abrirModal(p)}
                      >
                        Gestionar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PageShell>

      {/* MODAL MOVIMIENTO */}
      {modalProducto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-xl">
            <div className="card-h flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold">{modalProducto.name}</div>
                <div className="text-sm text-gray-500">
                  Stock actual: <span className="font-extrabold text-gray-900">{modalProducto.stock} unidades</span>
                </div>
              </div>
              <button className="btn" onClick={cerrarModal}>✕</button>
            </div>

            <div className="card-b space-y-4">
              {okMsg && <div className="alert-ok">{okMsg}</div>}

              {/* Tipo de movimiento */}
              <div className="grid gap-2">
                <span className="label">Tipo de movimiento</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["ENTRADA", "AJUSTE", "RETIRO"] as MovimientoType[]).map((tipo) => {
                    const labels: Record<MovimientoType, { label: string; color: string }> = {
                      ENTRADA: { label: "Entrada", color: "border-emerald-500 bg-emerald-50 text-emerald-700" },
                      AJUSTE:  { label: "Ajuste",  color: "border-blue-500 bg-blue-50 text-blue-700" },
                      RETIRO:  { label: "Retiro",  color: "border-red-500 bg-red-50 text-red-700" },
                    };
                    const isActive = tipoMovimiento === tipo;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => { setTipoMovimiento(tipo); setModalErr(null); setOkMsg(null); }}
                        className={`rounded-2xl border px-3 py-2 text-sm font-extrabold transition ${isActive ? labels[tipo].color : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"}`}
                      >
                        {labels[tipo].label}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {tipoMovimiento === "ENTRADA" && "Agrega unidades al stock (recepción de mercancía)."}
                  {tipoMovimiento === "AJUSTE" && "Corrige el stock según el conteo físico real."}
                  {tipoMovimiento === "RETIRO" && "Saca unidades por merma, daño o vencimiento."}
                </div>
              </div>

              {/* Cantidad */}
              <label className="grid gap-1">
                <span className="label">Cantidad</span>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={cantidad}
                  onChange={(e) => { setCantidad(e.target.value); setModalErr(null); setOkMsg(null); }}
                  placeholder="Ej: 10"
                  disabled={guardando}
                />
                {/* Preview del nuevo stock */}
                {cantidad && !isNaN(parseInt(cantidad)) && parseInt(cantidad) > 0 && (
                  <div className="text-xs text-gray-500">
                    Nuevo stock:{" "}
                    <span className="font-extrabold text-gray-900">
                      {tipoMovimiento === "RETIRO"
                        ? modalProducto.stock - parseInt(cantidad)
                        : modalProducto.stock + parseInt(cantidad)}{" "}
                      unidades
                    </span>
                  </div>
                )}
              </label>

              {/* Razón — solo para RETIRO */}
              {tipoMovimiento === "RETIRO" && (
                <div className="grid gap-2">
                  <span className="label">Motivo del retiro</span>
                  <div className="flex flex-wrap gap-2">
                    {RAZONES_RETIRO.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => { setRazon(r); setModalErr(null); }}
                        disabled={guardando}
                        className={`rounded-2xl border px-3 py-1 text-sm font-semibold transition ${razon === r ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {razon === "Otro" && (
                    <input
                      className="input"
                      value={razonCustom}
                      onChange={(e) => setRazonCustom(e.target.value)}
                      placeholder="Describe el motivo..."
                      disabled={guardando}
                    />
                  )}
                </div>
              )}

              {/* Razón opcional para ENTRADA/AJUSTE */}
              {tipoMovimiento !== "RETIRO" && (
                <label className="grid gap-1">
                  <span className="label">Nota (opcional)</span>
                  <input
                    className="input"
                    value={razon}
                    onChange={(e) => setRazon(e.target.value)}
                    placeholder="Ej: Pedido semanal, conteo físico..."
                    disabled={guardando}
                  />
                </label>
              )}

              {modalErr && <div className="alert-err">{modalErr}</div>}

              <div className="flex gap-2">
                <button className="btn flex-1" onClick={cerrarModal} disabled={guardando}>
                  Cancelar
                </button>
                <button
                  className={`btn flex-1 ${tipoMovimiento === "RETIRO" ? "bg-red-600 text-white border-red-600 hover:bg-red-700" : "btn-primary"}`}
                  onClick={guardarMovimiento}
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : tipoMovimiento === "ENTRADA" ? "Agregar stock" : tipoMovimiento === "RETIRO" ? "Retirar stock" : "Ajustar stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}