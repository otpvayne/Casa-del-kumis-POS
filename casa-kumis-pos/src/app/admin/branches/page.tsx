"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";

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

  const load = async () => {
    setErr(null);
    setLoading(true);

    const role = await requireRole("ADMIN");
    if (!role.ok) return router.replace("/pos");

    const { data, error } = await supabase
      .from("branches")
      .select("id,name,is_active")
      .order("name");

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

    setRows((prev) => [...prev, { id: data.id, name: data.name, is_active: Boolean(data.is_active) }].sort((a,b)=>a.name.localeCompare(b.name)));
    setNewName("");
  };

  const updateBranch = async (id: string, patch: Partial<Branch>) => {
    setErr(null);

    const { error } = await supabase.from("branches").update(patch).eq("id", id);
    if (error) return setErr(error.message);

    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando sucursales...</div>;
  if (err) return <div style={{ padding: 24, color: "red" }}>Error: {err}</div>;

  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Admin · Sucursales</h1>
        <button onClick={() => router.push("/admin")} style={{ padding: 10, borderRadius: 10 }}>
          Volver
        </button>
        <button onClick={() => load().catch(()=>{})} style={{ padding: 10, borderRadius: 10 }}>
          Refrescar
        </button>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2>Crear sucursal</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre sucursal"
            style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
          <button onClick={createBranch} disabled={creating} style={{ padding: 10, borderRadius: 10, fontWeight: 800 }}>
            {creating ? "Creando..." : "Crear"}
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              <th style={th}>Nombre</th>
              <th style={th}>Activa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td style={td}>
                  <input
                    value={b.name}
                    onChange={(e) => updateBranch(b.id, { name: e.target.value })}
                    style={{ padding: 8, borderRadius: 10, border: "1px solid #ddd", width: 320 }}
                  />
                </td>
                <td style={td}>
                  <input
                    type="checkbox"
                    checked={b.is_active}
                    onChange={(e) => updateBranch(b.id, { is_active: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={td} colSpan={2}>
                  No hay sucursales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ opacity: 0.7 }}>
        Recomendación: desactivar sucursales (is_active) en vez de borrar, para no afectar histórico.
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 10, borderBottom: "1px solid #eee", fontSize: 12 };
const td: React.CSSProperties = { padding: 10, borderBottom: "1px solid #f1f1f1", fontSize: 12 };
