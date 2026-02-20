"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem("selected_branch_id");
      router.replace("/login");
    };

    run();
  }, [router]);

  return (
    <div className="container py-10">
      <div className="card text-center">
        <div className="card-h">
          <div className="text-lg font-extrabold">Cerrando sesión...</div>
        </div>
        <div className="card-b text-sm text-gray-600">
          Redireccionando al login.
        </div>
      </div>
    </div>
  );
}