"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

 const handleLogin = async () => {
  setLoading(true);
  setError(null);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  setLoading(false);

  if (error) {
    setError(error.message);
    return;
  }

  const session = data.session;
  if (!session) {
    setError("No se pudo obtener sesión.");
    return;
  }

  // 🔎 Buscar rol en profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", session.user.id)
    .single();

  if (profileError || !profile) {
    setError("No se encontró el rol del usuario (profiles).");
    return;
  }

  // 🔁 Redirección por rol
  if (profile.role === "ADMIN") {
    router.replace("/admin");
  } else {
    // CASHIER
    router.replace("/select-branch");
  }
};


  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1>Iniciar sesión</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
            placeholder="pos@casadelkumis.com"
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
            placeholder="••••••••"
          />
        </label>

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ padding: 10, borderRadius: 8, border: "none", cursor: "pointer" }}
        >
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}
