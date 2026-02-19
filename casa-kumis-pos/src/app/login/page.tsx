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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (profileError || !profile) {
      setError("No se encontró el rol del usuario.");
      return;
    }

    if (profile.role === "ADMIN") {
      router.replace("/admin");
    } else {
      router.replace("/select-branch");
    }
  };

  return (
    <div className="container py-10">
      <div className="mx-auto max-w-md">
        <div className="card">
          <div className="card-h">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Iniciar sesión
              </h1>
              <div className="mt-1 text-sm text-gray-500">
                Accede al sistema Casa del Kumis POS
              </div>
            </div>
          </div>

          <div className="card-b space-y-4">
            {/* Email */}
            <div className="grid gap-2">
              <label className="label">Correo electrónico</label>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pos@casadelkumis.com"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {error && <div className="alert-err">{error}</div>}

            <button
              className="btn btn-primary w-full"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Entrar"}
            </button>

            <div className="text-xs text-gray-500 text-center">
              Sistema interno para administración y punto de venta.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
