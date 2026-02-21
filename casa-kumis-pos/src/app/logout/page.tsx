"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LoadingCard from "@/components/LoadingCard";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        // Cierra sesión
        await supabase.auth.signOut();

        // Limpia estado local del POS
        localStorage.removeItem("selected_branch_id");
      } finally {
        router.replace("/login");
      }
    };

    run().catch(() => router.replace("/login"));
  }, [router]);

  return <LoadingCard title="Cerrando sesión..." />;
}