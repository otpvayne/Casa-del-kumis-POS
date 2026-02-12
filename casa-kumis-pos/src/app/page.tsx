"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Branch = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function Home() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id,name,is_active")
        .order("created_at", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setBranches(data ?? []);
      }
      setLoading(false);
    };

    run();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (error) return <div style={{ padding: 24 }}>Error: {error}</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Conexión OK ✅</h1>
      <p>Sucursales encontradas: {branches.length}</p>

      <ul>
        {branches.map((b) => (
          <li key={b.id}>
            {b.name} — {b.is_active ? "Activa" : "Inactiva"}
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Si ves esta lista sin errores, Next.js ya está conectado a Supabase.
      </p>
    </div>
  );
}
