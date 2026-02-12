"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Branch = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function SelectBranchPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("branches")
        .select("id,name,is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) setError(error.message);
      setBranches(data ?? []);
      setLoading(false);
    };

    run();
  }, [router]);

  const chooseBranch = (branchId: string) => {
    localStorage.setItem("selected_branch_id", branchId);
    router.push("/pos");
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>Error: {error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Selecciona una sucursal</h1>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {branches.map((b) => (
          <button
            key={b.id}
            onClick={() => chooseBranch(b.id)}
            style={{ padding: 12, borderRadius: 10, cursor: "pointer" }}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
