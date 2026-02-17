"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";

type Branch = { id: string; name: string };

// ✅ si luego agregas image_url en products, aquí puedes incluirlo
type Product = { id: string; name: string };

type BranchProduct = {
  id: string;
  branch_id: string;
  product_id: string;
  price: number;
  is_active: boolean;
  is_favorite: boolean;
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);

  // form crear producto
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // filtros
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // asignar producto a sucursal
  const [assignProductId, setAssignProductId] = useState<string>("");
  const [assignPrice, setAssignPrice] = useState<string>("0");
  const [assigning, setAssigning] = useState(false);

  // ✅ eliminar producto
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const loadAll = async () => {
    setErr(null);
    setLoading(true);

    const role = await requireRole("ADMIN");
    if (!role.ok) return router.replace("/pos");

    const { data: b, error: bErr } = await supabase.from("branches").select("id,name").order("name");
    if (bErr) throw new Error(bErr.message);

    const { data: p, error: pErr } = await supabase.from("products").select("id,name").order("name");
    if (pErr) throw new Error(pErr.message);

    const { data: bp, error: bpErr } = await supabase
      .from("branch_products")
      .select("id,branch_id,product_id,price,is_active,is_favorite");
    if (bpErr) throw new Error(bpErr.message);

    setBranches(b ?? []);
    setProducts(p ?? []);
    setBranchProducts(
      (bp ?? []).map((x: any) => ({
        id: x.id,
        branch_id: x.branch_id,
        product_id: x.product_id,
        price: Number(x.price ?? 0),
        is_active: Boolean(x.is_active),
        is_favorite: Boolean(x.is_favorite),
      }))
    );

    if (!selectedBranchId && (b?.length ?? 0) > 0) setSelectedBranchId(b![0].id);

    setLoading(false);
  };

  useEffect(() => {
    loadAll().catch((e) => {
      setErr(e.message ?? "Error cargando admin.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createProduct = async () => {
    const name = newName.trim();
    if (!name) return setErr("Nombre obligatorio.");

    setErr(null);
    setCreating(true);

    const { data, error } = await supabase.from("products").insert({ name }).select("id,name").single();

    setCreating(false);

    if (error || !data) {
      setErr(error?.message ?? "Error creando producto.");
      return;
    }

    setProducts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
  };

  const toNum = (v: string) => {
    if (!v) return 0;
    let cleaned = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  const assignToBranch = async () => {
    if (!selectedBranchId) return setErr("Selecciona sucursal.");
    if (!assignProductId) return setErr("Selecciona producto.");

    const price = toNum(assignPrice);
    if (price <= 0) return setErr("Precio debe ser mayor a 0.");

    setErr(null);
    setAssigning(true);

    const existing = branchProducts.find((x) => x.branch_id === selectedBranchId && x.product_id === assignProductId);

    if (existing) {
      const { error } = await supabase.from("branch_products").update({ price, is_active: true }).eq("id", existing.id);

      setAssigning(false);
      if (error) return setErr(error.message);

      setBranchProducts((prev) => prev.map((x) => (x.id === existing.id ? { ...x, price, is_active: true } : x)));
      return;
    }

    const { data, error } = await supabase
      .from("branch_products")
      .insert({
        branch_id: selectedBranchId,
        product_id: assignProductId,
        price,
        is_active: true,
        is_favorite: false,
      })
      .select("id,branch_id,product_id,price,is_active,is_favorite")
      .single();

    setAssigning(false);

    if (error || !data) return setErr(error?.message ?? "Error asignando producto.");

    setBranchProducts((prev) => [
      ...prev,
      {
        id: data.id,
        branch_id: data.branch_id,
        product_id: data.product_id,
        price: Number(data.price ?? 0),
        is_active: Boolean(data.is_active),
        is_favorite: Boolean(data.is_favorite),
      },
    ]);
  };

  const rowsForBranch = useMemo(() => {
    if (!selectedBranchId) return [];
    const bps = branchProducts.filter((x) => x.branch_id === selectedBranchId);

    return bps
      .map((bp) => ({
        ...bp,
        product_name: products.find((p) => p.id === bp.product_id)?.name ?? "(sin nombre)",
      }))
      .sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [branchProducts, products, selectedBranchId]);

  const updateBranchProduct = async (id: string, patch: Partial<BranchProduct>) => {
    setErr(null);

    const { error } = await supabase.from("branch_products").update(patch).eq("id", id);
    if (error) return setErr(error.message);

    setBranchProducts((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  // =============================
  // ✅ CRUD: DELETE PRODUCT (seguro)
  // =============================

  // cuenta asignaciones por producto (para mostrar en tabla)
  const assignCountByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const bp of branchProducts) {
      map.set(bp.product_id, (map.get(bp.product_id) ?? 0) + 1);
    }
    return map;
  }, [branchProducts]);

  // ✅ desactivar el producto en TODAS las sucursales (lo saca del POS)
  const deactivateEverywhere = async (productId: string) => {
    setErr(null);
    setDeactivatingId(productId);

    try {
      const { error } = await supabase
        .from("branch_products")
        .update({ is_active: false, is_favorite: false })
        .eq("product_id", productId);

      if (error) throw new Error(error.message);

      setBranchProducts((prev) =>
        prev.map((x) =>
          x.product_id === productId ? { ...x, is_active: false, is_favorite: false } : x
        )
      );
    } catch (e: any) {
      setErr(e.message ?? "No se pudo desactivar.");
    } finally {
      setDeactivatingId(null);
    }
  };

  const deleteProduct = async (productId: string) => {
  setErr(null);

  const prod = products.find((p) => p.id === productId);
  const name = prod?.name ?? "este producto";

  const ok = window.confirm(
    `¿Seguro que quieres eliminar "${name}"?\n\nSe eliminará de sucursales (branch_products) y luego el producto.\nOJO: si ya tiene ventas, NO se puede borrar.`
  );
  if (!ok) return;

  setDeletingId(productId);

  try {
    // 1) Bloqueo si ya tuvo ventas (sale_items)
    const { count, error: salesCountErr } = await supabase
      .from("sale_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    if (salesCountErr) throw new Error(salesCountErr.message);

    if ((count ?? 0) > 0) {
      throw new Error(
        `No se puede borrar porque ya tiene ventas registradas (${count}). En vez de borrar, desactívalo para que no salga en el POS.`
      );
    }

    // 2) ✅ si NO tiene ventas, eliminamos asignaciones primero
    const { error: delBpErr } = await supabase
      .from("branch_products")
      .delete()
      .eq("product_id", productId);

    if (delBpErr) throw new Error(delBpErr.message);

    // 3) borrar producto
    const { error: delProdErr } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (delProdErr) throw new Error(delProdErr.message);

    // 4) actualizar UI
    setBranchProducts((prev) => prev.filter((bp) => bp.product_id !== productId));
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  } catch (e: any) {
    setErr(e.message ?? "No se pudo borrar.");
  } finally {
    setDeletingId(null);
  }
};


  if (loading) return <div style={{ padding: 24 }}>Cargando admin...</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>Error: {err}</div>;

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Admin · Productos</h1>
        <button onClick={() => router.push("/admin")} style={{ padding: 10, borderRadius: 10 }}>
          Volver
        </button>
      </div>

      {/* Crear producto */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2>Crear producto</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del producto"
            style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <button onClick={createProduct} disabled={creating} style={{ padding: 10, borderRadius: 10, fontWeight: 700 }}>
            {creating ? "Creando..." : "Crear"}
          </button>
        </div>

        {/* ✅ LISTA + DELETE */}
        <div style={{ marginTop: 14, border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #eee", background: "#fafafa", fontWeight: 800 }}>
            Productos creados ({products.length})
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fff" }}>
                  <th style={th}>Producto</th>
                  <th style={th}>Asignado a sucursales</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const assigned = assignCountByProduct.get(p.id) ?? 0;
                  const busyDeleting = deletingId === p.id;
                  const busyDeact = deactivatingId === p.id;

                  return (
                    <tr key={p.id}>
                      <td style={td}>{p.name}</td>
                      <td style={td}>{assigned}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => deactivateEverywhere(p.id)}
                            disabled={busyDeact}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: "pointer",
                              fontWeight: 800,
                            }}
                            title="Lo saca del POS en todas las sucursales"
                          >
                            {busyDeact ? "Desactivando..." : "Desactivar en todas"}
                          </button>

                          <button
                            onClick={() => deleteProduct(p.id)}
                            disabled={busyDeleting}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: busyDeleting ? "#999" : "black",
                              color: "white",
                              cursor: "pointer",
                              fontWeight: 900,
                            }}
                            title="Solo borra si NO hay ventas y NO está asignado"
                          >
                            {busyDeleting ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                          Tip: si el producto ya tuvo ventas, no se puede borrar. Desactívalo.
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {products.length === 0 && (
                  <tr>
                    <td style={td} colSpan={3}>
                      No hay productos creados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Selección de sucursal */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2>Configurar por sucursal</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            Sucursal
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{ marginLeft: 10, padding: 10, borderRadius: 10 }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <button onClick={() => loadAll().catch(() => {})} style={{ padding: 10, borderRadius: 10 }}>
            Refrescar
          </button>
        </div>

        {/* Asignar producto */}
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={assignProductId}
            onChange={(e) => setAssignProductId(e.target.value)}
            style={{ padding: 10, borderRadius: 10, minWidth: 240 }}
          >
            <option value="">Selecciona producto…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            value={assignPrice}
            onChange={(e) => setAssignPrice(e.target.value)}
            inputMode="numeric"
            pattern="[0-9.,]*"
            placeholder="Precio"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", width: 140 }}
          />

          <button onClick={assignToBranch} disabled={assigning} style={{ padding: 10, borderRadius: 10, fontWeight: 800 }}>
            {assigning ? "Asignando..." : "Asignar / Activar"}
          </button>
        </div>

        {/* Tabla */}
        <div style={{ marginTop: 14, overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={th}>Producto</th>
                <th style={th}>Precio</th>
                <th style={th}>Activo</th>
                <th style={th}>Favorito</th>
              </tr>
            </thead>
            <tbody>
              {rowsForBranch.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{(r as any).product_name}</td>

                  <td style={td}>
                    <input
                      value={String(r.price)}
                      inputMode="numeric"
                      pattern="[0-9.,]*"
                      onChange={(e) => updateBranchProduct(r.id, { price: toNum(e.target.value) })}
                      style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd", width: 130 }}
                    />
                  </td>

                  <td style={td}>
                    <input type="checkbox" checked={r.is_active} onChange={(e) => updateBranchProduct(r.id, { is_active: e.target.checked })} />
                  </td>

                  <td style={td}>
                    <input type="checkbox" checked={r.is_favorite} onChange={(e) => updateBranchProduct(r.id, { is_favorite: e.target.checked })} />
                  </td>
                </tr>
              ))}
              {rowsForBranch.length === 0 && (
                <tr>
                  <td style={td} colSpan={4}>
                    No hay productos asignados a esta sucursal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, opacity: 0.7 }}>Tip: favoritos salen primero en el POS.</div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 10, borderBottom: "1px solid #eee", fontSize: 12 };
const td: React.CSSProperties = { padding: 10, borderBottom: "1px solid #f1f1f1", fontSize: 12 };
