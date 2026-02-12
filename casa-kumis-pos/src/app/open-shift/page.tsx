"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function OpenShiftPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [openingCash, setOpeningCash] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }

      const id = localStorage.getItem("selected_branch_id");
      if (!id) {
        router.replace("/select-branch");
        return;
      }

      setBranchId(id);
      setLoading(false);
    };

    run();
  }, [router]);

  const openShift = async () => {
    if (!branchId) return;

    setSaving(true);
    setError(null);

    const cash = Number(openingCash);
    if (Number.isNaN(cash) || cash < 0) {
      setSaving(false);
      setError("El monto inicial debe ser un número válido (0 o mayor).");
      return;
    }

    const { error } = await supabase.from("shifts").insert({
      branch_id: branchId,
      opening_cash: cash,
      status: "OPEN",
      expected_total: 0,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/pos");
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1>Abrir turno</h1>
      <p style={{ opacity: 0.7 }}>
        Debes abrir un turno para empezar a vender.
      </p>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Monto inicial de caja
          <input
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
            placeholder="0"
          />
        </label>

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button
          onClick={openShift}
          disabled={saving}
          style={{ padding: 10, borderRadius: 8, border: "none", cursor: "pointer" }}
        >
          {saving ? "Abriendo..." : "Abrir turno"}
        </button>
      </div>
    </div>
  );
}
