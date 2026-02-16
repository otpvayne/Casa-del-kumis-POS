"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const res = await requireRole("ADMIN");

      if (!res.ok) {
        router.replace("/pos"); // o /login si prefieres
        return;
      }

      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Panel Admin</h1>
      <p>Gestión de sucursales / productos / precios (próximo paso).</p>
      <button onClick={() => router.push("/admin/products")} style={{ padding: 10, borderRadius: 10 }}>
  Productos / Precios
</button>
<button onClick={() => router.push("/admin/branches")} style={{ padding: 10, borderRadius: 10 }}>
  Sucursales
</button>
<button onClick={() => router.push("/admin/reports")} style={{ padding: 10, borderRadius: 10 }}>
  Reportes
</button>

    </div>
    
  );
}
