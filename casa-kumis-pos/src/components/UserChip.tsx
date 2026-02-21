"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function UserChip() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const userEmail = data.session?.user?.email ?? "";
      setEmail(userEmail);
    };

    load();

    // Si cambia la sesión, actualiza el chip
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? "");
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!email) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="badge">
        Usuario: <span className="ml-1 font-extrabold text-gray-900">{email}</span>
      </span>

      <button className="btn" onClick={() => router.push("/logout")}>
        Cerrar Sesion
      </button>
    </div>
  );
}