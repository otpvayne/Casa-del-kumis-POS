"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";

type Branch = { id: string; name: string };
type Product = { id: string; name: string; image_url?: string | null };

type BranchProduct = {
  id: string;
  branch_id: string;
  product_id: string;
  price: number;
  is_active: boolean;
  is_favorite: boolean;
};

const BUCKET = "product-images";

export default function AdminProductsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);

  // crear producto
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<string>(""); // ✅ precio al crear
  const [creating, setCreating] = useState(false);

  // imagen (crear)
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // editar producto
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  // seleccionar sucursal
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // asignar producto a sucursal
  const [assignProductId, setAssignProductId] = useState<string>("");
  const [assignPrice, setAssignPrice] = useState<string>("0");
  const [assigning, setAssigning] = useState(false);

  // eliminar/desactivar
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const loadAll = async () => {
    setErr(null);
    setLoading(true);

    const role = await requireRole("ADMIN");
    if (!role.ok) return router.replace("/pos");

    const { data: b, error: bErr } = await supabase
      .from("branches")
      .select("id,name")
      .order("name");
    if (bErr) throw new Error(bErr.message);

    const { data: p, error: pErr } = await supabase
      .from("products")
      .select("id,name,image_url")
      .order("name");
    if (pErr) throw new Error(pErr.message);

    const { data: bp, error: bpErr } = await supabase
      .from("branch_products")
      .select("id,branch_id,product_id,price,is_active,is_favorite");
    if (bpErr) throw new Error(bpErr.message);

    setBranches(b ?? []);
    setProducts(
      (p ?? []).map((x: any) => ({
        id: x.id,
        name: x.name,
        image_url: x.image_url ?? null,
      }))
    );
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

  // preview imagen nueva (crear)
  useEffect(() => {
    if (!newImageFile) { setNewImagePreview(null); return; }
    const url = URL.createObjectURL(newImageFile);
    setNewImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [newImageFile]);

  // preview imagen edición
  useEffect(() => {
    if (!editImageFile) { setEditImagePreview(null); return; }
    const url = URL.createObjectURL(editImageFile);
    setEditImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editImageFile]);

  const resetCreateForm = () => {
    setNewName("");
    setNewPrice(""); // ✅
    setNewImageFile(null);
    setNewImagePreview(null);
  };

  const resetEditForm = () => {
    setEditingProduct(null);
    setEditName("");
    setEditImageFile(null);
    setEditImagePreview(null);
  };

  const safeExt = (file: File) => {
    const n = (file.name || "").toLowerCase();
    const ext = n.split(".").pop() || "";
    if (ext && ext.length <= 6) return ext;
    if (file.type === "image/png") return "png";
    if (file.type === "image/webp") return "webp";
    return "jpg";
  };

  const uploadProductImage = async (file: File, setUploading: (v: boolean) => void) => {
    if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
    const maxMB = 6;
    if (file.size > maxMB * 1024 * 1024) throw new Error(`La imagen supera ${maxMB}MB.`);

    setUploading(true);
    try {
      const ext = safeExt(file);
      const filename = `${crypto.randomUUID()}.${ext}`;
      const path = `products/${filename}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (upErr) throw new Error(upErr.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("No se pudo obtener la URL pública de la imagen.");
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const toNum = (v: string) => {
    if (!v) return 0;
    let cleaned = v.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  };

  // ✅ Crear producto y asignar automáticamente a todas las sucursales
  const createProduct = async () => {
    const name = newName.trim();
    if (!name) return setErr("Nombre obligatorio.");

    const price = toNum(newPrice);
    if (price <= 0) return setErr("El precio debe ser mayor a 0.");

    setErr(null);
    setCreating(true);

    try {
      let image_url: string | null = null;
      if (newImageFile) {
        image_url = await uploadProductImage(newImageFile, setUploadingImage);
      }

      // 1. Crear el producto
      const { data, error } = await supabase
        .from("products")
        .insert({ name, image_url })
        .select("id,name,image_url")
        .single();

      if (error || !data) throw new Error(error?.message ?? "Error creando producto.");

      // 2. ✅ Asignar a TODAS las sucursales automáticamente
      if (branches.length > 0) {
        const assignments = branches.map((b) => ({
          branch_id: b.id,
          product_id: data.id,
          price,
          is_active: true,
          is_favorite: false,
        }));

        const { error: assignErr } = await supabase
          .from("branch_products")
          .insert(assignments);

        if (assignErr) throw new Error(assignErr.message);

        // Actualizar estado local con los registros recién creados
        const { data: newBps } = await supabase
          .from("branch_products")
          .select("id,branch_id,product_id,price,is_active,is_favorite")
          .eq("product_id", data.id);

        if (newBps) {
          setBranchProducts((prev) => [
            ...prev,
            ...newBps.map((x: any) => ({
              id: x.id,
              branch_id: x.branch_id,
              product_id: x.product_id,
              price: Number(x.price ?? 0),
              is_active: Boolean(x.is_active),
              is_favorite: Boolean(x.is_favorite),
            })),
          ]);
        }
      }

      setProducts((prev) =>
        [...prev, { id: data.id, name: data.name, image_url: data.image_url ?? null }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      resetCreateForm();
    } catch (e: any) {
      setErr(e.message ?? "Error creando producto.");
    } finally {
      setCreating(false);
    }
  };

  // abrir modal de edición
  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditImageFile(null);
    setEditImagePreview(null);
    setErr(null);
  };

  // guardar cambios del producto
  const updateProduct = async () => {
    if (!editingProduct) return;
    const name = editName.trim();
    if (!name) return setErr("Nombre obligatorio.");

    setErr(null);
    setUpdating(true);

    try {
      let image_url = editingProduct.image_url ?? null;

      if (editImageFile) {
        image_url = await uploadProductImage(editImageFile, setUploadingEditImage);
      }

      const { error } = await supabase
        .from("products")
        .update({ name, image_url })
        .eq("id", editingProduct.id);

      if (error) throw new Error(error.message);

      setProducts((prev) =>
        prev
          .map((p) => (p.id === editingProduct.id ? { ...p, name, image_url } : p))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      resetEditForm();
    } catch (e: any) {
      setErr(e.message ?? "Error actualizando producto.");
    } finally {
      setUpdating(false);
    }
  };

  const assignToBranch = async () => {
    if (!selectedBranchId) return setErr("Selecciona sucursal.");
    if (!assignProductId) return setErr("Selecciona producto.");

    const price = toNum(assignPrice);
    if (price <= 0) return setErr("Precio debe ser mayor a 0.");

    setErr(null);
    setAssigning(true);

    const existing = branchProducts.find(
      (x) => x.branch_id === selectedBranchId && x.product_id === assignProductId
    );

    try {
      if (existing) {
        const { error } = await supabase
          .from("branch_products")
          .update({ price, is_active: true })
          .eq("id", existing.id);

        if (error) throw new Error(error.message);

        setBranchProducts((prev) =>
          prev.map((x) => (x.id === existing.id ? { ...x, price, is_active: true } : x))
        );
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

      if (error || !data) throw new Error(error?.message ?? "Error asignando producto.");

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
    } catch (e: any) {
      setErr(e.message ?? "Error asignando producto.");
    } finally {
      setAssigning(false);
    }
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

  const assignCountByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const bp of branchProducts) map.set(bp.product_id, (map.get(bp.product_id) ?? 0) + 1);
    return map;
  }, [branchProducts]);

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
      `¿Seguro que quieres eliminar "${name}"?\n\nSe eliminará de sucursales (branch_products) y luego el producto.\nSi ya tiene ventas, NO se puede borrar.`
    );
    if (!ok) return;

    setDeletingId(productId);
    try {
      const { count, error: salesCountErr } = await supabase
        .from("sale_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);
      if (salesCountErr) throw new Error(salesCountErr.message);
      if ((count ?? 0) > 0) {
        throw new Error(
          `No se puede borrar porque ya tiene ventas registradas (${count}). En vez de borrar, desactívalo.`
        );
      }

      const { error: delBpErr } = await supabase
        .from("branch_products")
        .delete()
        .eq("product_id", productId);
      if (delBpErr) throw new Error(delBpErr.message);

      const { error: delProdErr } = await supabase.from("products").delete().eq("id", productId);
      if (delProdErr) throw new Error(delProdErr.message);

      setBranchProducts((prev) => prev.filter((bp) => bp.product_id !== productId));
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    } catch (e: any) {
      setErr(e.message ?? "No se pudo borrar.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingCard title="Cargando POS..." />;

  return (
    <div className="container py-8">
      <PageShell
        title="Productos y precios"
        subtitle="Crea productos, gestiónalos y configura su precio por sucursal."
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={() => loadAll().catch(() => {})}>
              Refrescar
            </button>
            <button className="btn" onClick={() => router.push("/admin")}>
              Volver
            </button>
          </div>
        }
      >
        {err && <div className="alert-err mb-4">{err}</div>}

        {/* MODAL DE EDICIÓN */}
        {editingProduct && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) resetEditForm(); }}
          >
            <div className="w-full max-w-md rounded-3xl bg-white shadow-xl">
              <div className="card-h flex items-center justify-between">
                <div>
                  <div className="text-lg font-extrabold">Editar producto</div>
                  <div className="text-sm text-gray-500">Modifica nombre e imagen.</div>
                </div>
                <button className="btn" onClick={resetEditForm}>Cancelar</button>
              </div>

              <div className="card-b space-y-4">
                <label className="grid gap-1">
                  <span className="label">Nombre</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre del producto"
                    className="input"
                    disabled={updating}
                  />
                </label>

                <div className="grid gap-2">
                  <span className="label">Imagen</span>
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr] items-start">
                    <div className="w-full aspect-square rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                      {editImagePreview ? (
                        <img src={editImagePreview} alt="Preview nueva" className="w-full h-full object-contain" />
                      ) : editingProduct.image_url ? (
                        <img src={editingProduct.image_url} alt="Imagen actual" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-xs text-gray-400 font-semibold">Sin imagen</div>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="input"
                        onChange={(e) => setEditImageFile(e.target.files?.[0] ?? null)}
                        disabled={updating || uploadingEditImage}
                      />
                      {editingProduct.image_url && !editImageFile && (
                        <div className="text-xs text-gray-500">Elige una nueva imagen para reemplazar la actual.</div>
                      )}
                      {!editingProduct.image_url && !editImageFile && (
                        <div className="text-xs text-gray-500">Este producto no tiene imagen. Puedes agregar una ahora.</div>
                      )}
                      {editImageFile && (
                        <button type="button" className="btn btn-ghost" onClick={() => setEditImageFile(null)} disabled={updating}>
                          Quitar nueva imagen
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {err && <div className="alert-err">{err}</div>}

                <button className="btn btn-primary w-full" onClick={updateProduct} disabled={updating || uploadingEditImage}>
                  {uploadingEditImage ? "Subiendo imagen..." : updating ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
          {/* IZQUIERDA */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-h flex items-center justify-between">
                <div>
                  <div className="text-lg font-extrabold">Crear producto</div>
                  <div className="text-sm text-gray-500">
                    Se asigna automáticamente a todas las sucursales con el precio indicado.
                  </div>
                </div>
                <span className="badge">Catálogo</span>
              </div>

              <div className="card-b space-y-4">
                <label className="grid gap-1">
                  <span className="label">Nombre</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej: Kumis natural 250ml"
                    className="input"
                    disabled={creating || uploadingImage}
                  />
                </label>

                {/* ✅ Campo precio */}
                <label className="grid gap-1">
                  <span className="label">Precio (todas las sucursales)</span>
                  <input
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9.,]*"
                    placeholder="Ej: 5.000"
                    className="input"
                    disabled={creating || uploadingImage}
                  />
                  <div className="text-xs text-gray-500">
                    Vista previa: <span className="font-extrabold text-gray-900">
                      ${toNum(newPrice).toLocaleString("es-CO")}
                    </span>
                  </div>
                </label>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="label">Imagen (opcional)</span>
                    {newImageFile && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => { setNewImageFile(null); setNewImagePreview(null); }}
                        disabled={creating || uploadingImage}
                      >
                        Quitar imagen
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr] items-start">
                    <div className="w-full aspect-square rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                      {newImagePreview ? (
                        <img src={newImagePreview} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-xs text-gray-400 font-semibold">Sin imagen</div>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="input"
                        onChange={(e) => { const f = e.target.files?.[0] ?? null; setNewImageFile(f); }}
                        disabled={creating || uploadingImage}
                      />
                      <div className="text-xs text-gray-500">Recomendado: PNG/JPG/WebP. Máx 6MB.</div>
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary w-full"
                  onClick={createProduct}
                  disabled={creating || uploadingImage}
                >
                  {uploadingImage ? "Subiendo imagen..." : creating ? "Creando y asignando..." : "Crear producto"}
                </button>

                <div className="text-xs text-gray-500">
                  El producto quedará activo en todas las sucursales. Desactívalo por sucursal desde la tabla de la derecha.
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-h flex items-center justify-between">
                <div>
                  <div className="text-lg font-extrabold">Productos creados</div>
                  <div className="text-sm text-gray-500">{products.length} en el catálogo</div>
                </div>
                <span className="badge">CRUD</span>
              </div>

              <div className="card-b">
                {products.length === 0 ? (
                  <div className="text-sm text-gray-500">No hay productos todavía.</div>
                ) : (
                  <div className="space-y-2">
                    {products.map((p) => {
                      const assigned = assignCountByProduct.get(p.id) ?? 0;
                      const busyDeleting = deletingId === p.id;
                      const busyDeact = deactivatingId === p.id;

                      return (
                        <div key={p.id} className="rounded-2xl border border-gray-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-12 w-12 rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" loading="lazy" />
                                ) : (
                                  <div className="text-[10px] text-gray-400 font-bold">IMG</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold truncate">{p.name}</div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Asignado a <span className="font-bold text-gray-800">{assigned}</span> sucursal(es)
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-end flex-shrink-0">
                              <button className="btn" onClick={() => openEdit(p)} disabled={busyDeleting || busyDeact} title="Editar nombre e imagen">
                                Editar
                              </button>
                              <button className="btn" onClick={() => deactivateEverywhere(p.id)} disabled={busyDeact} title="Lo saca del POS en todas las sucursales">
                                {busyDeact ? "Desactivando..." : "Desactivar"}
                              </button>
                              <button className="btn btn-primary" onClick={() => deleteProduct(p.id)} disabled={busyDeleting} title="Solo borra si NO hay ventas">
                                {busyDeleting ? "Eliminando..." : "Eliminar"}
                              </button>
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

          {/* DERECHA */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-h flex items-center justify-between">
                <div>
                  <div className="text-lg font-extrabold">Configurar por sucursal</div>
                  <div className="text-sm text-gray-500">Ajusta precio, activo y favorito por sede.</div>
                </div>
                <span className="badge">Sucursales</span>
              </div>

              <div className="card-b space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1">
                    <span className="label">Sucursal</span>
                    <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} className="input">
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </label>
                  <div className="ml-auto text-xs text-gray-500">Tip: favoritos aparecen primero en el POS.</div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="text-sm font-extrabold">Asignar producto manualmente</div>
                  <div className="mt-1 text-xs text-gray-500">Si ya existe, se actualiza y se activa.</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select value={assignProductId} onChange={(e) => setAssignProductId(e.target.value)} className="input min-w-[220px]">
                      <option value="">Selecciona producto…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input
                      value={assignPrice}
                      onChange={(e) => setAssignPrice(e.target.value)}
                      inputMode="numeric"
                      pattern="[0-9.,]*"
                      placeholder="Precio"
                      className="input w-40"
                    />
                    <button className="btn btn-primary" onClick={assignToBranch} disabled={assigning}>
                      {assigning ? "Asignando..." : "Asignar / Activar"}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-3 text-left text-xs font-bold text-gray-600">Producto</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600">Precio</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600">Activo</th>
                        <th className="p-3 text-left text-xs font-bold text-gray-600">Favorito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsForBranch.map((r) => (
                        <tr key={r.id} className="border-t border-gray-200">
                          <td className="p-3 text-sm font-semibold text-gray-900">{(r as any).product_name}</td>
                          <td className="p-3">
                            <input
                              value={String(r.price)}
                              inputMode="numeric"
                              pattern="[0-9.,]*"
                              onChange={(e) => updateBranchProduct(r.id, { price: toNum(e.target.value) })}
                              className="input w-36"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={r.is_active}
                              onChange={(e) => updateBranchProduct(r.id, { is_active: e.target.checked })}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={r.is_favorite}
                              onChange={(e) => updateBranchProduct(r.id, { is_favorite: e.target.checked })}
                            />
                          </td>
                        </tr>
                      ))}
                      {rowsForBranch.length === 0 && (
                        <tr>
                          <td className="p-4 text-sm text-gray-500" colSpan={4}>
                            No hay productos asignados a esta sucursal.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-gray-500">
                  Recomendación: desactiva en vez de borrar si existe histórico (ventas).
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </div>
  );
}