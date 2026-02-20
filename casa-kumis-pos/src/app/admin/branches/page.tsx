"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";

type Branch = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function AdminBranchesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Branch[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    setLoading(true);

    const role = await requireRole("ADMIN");
    if (!role.ok) return router.replace("/pos");

    const { data, error } = await supabase.from("branches").select("id,name,is_active").order("name");
    if (error) throw new Error(error.message);

    setRows(
      (data ?? []).map((b: any) => ({
        id: b.id,
        name: b.name,
        is_active: Boolean(b.is_active),
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    load().catch((e) => {
      setErr(e.message ?? "Error cargando sucursales.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createBranch = async () => {
    const name = newName.trim();
    if (!name) return setErr("Nombre obligatorio.");

    setErr(null);
    setCreating(true);

    const { data, error } = await supabase
      .from("branches")
      .insert({ name, is_active: true })
      .select("id,name,is_active")
      .single();

    setCreating(false);

    if (error || !data) return setErr(error?.message ?? "Error creando sucursal.");

    setRows((prev) =>
      [...prev, { id: data.id, name: data.name, is_active: Boolean(data.is_active) }].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setNewName("");
  };

  const updateBranch = async (id: string, patch: Partial<Branch>) => {
    setErr(null);

    const { error } = await supabase.from("branches").update(patch).eq("id", id);
    if (error) return setErr(error.message);

    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  /**
   * Delete seguro:
   * - Si tiene histórico (sales o shifts), NO se borra. Se recomienda desactivar.
   * - Si NO tiene histórico:
   *    1) borra branch_products de esa sucursal
   *    2) borra la sucursal
   */
  const deleteBranch = async (branchId: string) => {
    setErr(null);

    const branch = rows.find((b) => b.id === branchId);
    const name = branch?.name ?? "esta sucursal";

    const ok = window.confirm(
      `¿Seguro que quieres eliminar "${name}"?\n\nOJO: si ya tiene ventas/turnos, NO se puede borrar (solo desactivar).`
    );
    if (!ok) return;

    setDeletingId(branchId);

    try {
      // Bloqueo si tiene ventas
      const { count: salesCount, error: salesErr } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId);

      if (salesErr) throw new Error(salesErr.message);

      // Bloqueo si tiene turnos
      const { count: shiftsCount, error: shiftsErr } = await supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId);

      if (shiftsErr) throw new Error(shiftsErr.message);

      const hasHistory = (salesCount ?? 0) > 0 || (shiftsCount ?? 0) > 0;

      if (hasHistory) {
        throw new Error(
          `No se puede borrar porque tiene histórico.\n\nVentas: ${salesCount ?? 0}\nTurnos: ${
            shiftsCount ?? 0
          }\n\nRecomendación: desactívala (is_active=false).`
        );
      }

      // sin histórico: borrar dependencias primero
      const { error: delBpErr } = await supabase.from("branch_products").delete().eq("branch_id", branchId);
      if (delBpErr) throw new Error(delBpErr.message);

      // borrar sucursal
      const { error: delBranchErr } = await supabase.from("branches").delete().eq("id", branchId);
      if (delBranchErr) throw new Error(delBranchErr.message);

      setRows((prev) => prev.filter((b) => b.id !== branchId));
    } catch (e: any) {
      setErr(e.message ?? "No se pudo borrar la sucursal.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingCard title="Cargando POS..." />;

  return (
    <div className="container py-8">
      <PageShell
        title="Sucursales"
        subtitle="Crea, edita, activa/desactiva y gestiona sucursales."
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={() => load().catch(() => {})}>
              Refrescar
            </button>
            <button className="btn" onClick={() => router.push("/admin")}>
              Volver
            </button>
          </div>
        }
      >
        {err && (
          <div className="alert-err mb-4" style={{ whiteSpace: "pre-line" }}>
            {err}
          </div>
        )}

        {/* Crear sucursal */}
        <div className="card mb-4">
          <div className="card-h flex items-center justify-between">
            <div>
              <div className="text-lg font-extrabold">Crear sucursal</div>
              <div className="text-sm text-gray-500">Agrega una nueva sede para operar el POS.</div>
            </div>
            <span className="badge">CRUD</span>
          </div>

          <div className="card-b">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="grid flex-1 gap-1">
                <span className="label">Nombre</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Sucursal Centro"
                  className="input"
                />
              </label>

              <button className="btn btn-primary sm:w-40" onClick={createBranch} disabled={creating}>
                {creating ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card">
          <div className="card-h flex items-center justify-between">
            <div>
              <div className="text-lg font-extrabold">Listado</div>
              <div className="text-sm text-gray-500">{rows.length} sucursal(es)</div>
            </div>
            <div className="text-xs text-gray-500">
              Recomendación: desactivar (is_active) en vez de borrar, para no afectar histórico.
            </div>
          </div>

          <div className="card-b">
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Nombre</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Activa</th>
                    <th className="p-3 text-left text-xs font-bold text-gray-600">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((b) => {
                    const busyDeleting = deletingId === b.id;

                    return (
                      <tr key={b.id} className="border-t border-gray-200">
                        <td className="p-3">
                          <input
                            value={b.name}
                            onChange={(e) => updateBranch(b.id, { name: e.target.value })}
                            className="input w-full max-w-sm"
                          />
                        </td>

                        <td className="p-3">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={b.is_active}
                              onChange={(e) => updateBranch(b.id, { is_active: e.target.checked })}
                            />
                            <span className="text-sm text-gray-600">{b.is_active ? "Sí" : "No"}</span>
                          </label>
                        </td>

                        <td className="p-3">
                          <button
                            className="btn"
                            onClick={() => deleteBranch(b.id)}
                            disabled={busyDeleting}
                            title="Solo se borra si no tiene ventas ni turnos"
                          >
                            {busyDeleting ? "Eliminando..." : "Eliminar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {rows.length === 0 && (
                    <tr>
                      <td className="p-4 text-sm text-gray-500" colSpan={3}>
                        No hay sucursales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Consejo: si una sucursal ya tuvo movimiento, desactívala para que no se pueda usar.
            </div>
          </div>
        </div>
      </PageShell>
    </div>
  );
}