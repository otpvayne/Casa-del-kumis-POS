"use client";

import { useRouter } from "next/navigation";

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="container py-16 flex justify-center">
      <div className="card max-w-lg w-full text-center">
        <div className="card-h">
          <div className="text-3xl font-extrabold">404</div>
          <div className="text-lg font-bold">Página no encontrada</div>
        </div>

        <div className="card-b space-y-4">
          <p className="text-sm text-gray-600">
            La página que estás buscando no existe o fue movida.
          </p>

          <div className="flex justify-center gap-3">
            <button
              className="btn"
              onClick={() => router.push("/pos")}
            >
              Ir al POS
            </button>

            <button
              className="btn btn-primary"
              onClick={() => router.push("/admin")}
            >
              Ir al Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}