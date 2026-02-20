"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error capturado:", error);
  }, [error]);

  return (
    <div className="container py-16 flex justify-center">
      <div className="card max-w-lg w-full text-center">
        <div className="card-h">
          <div className="text-lg font-extrabold text-red-600">
            Ocurrió un error inesperado
          </div>
        </div>

        <div className="card-b space-y-4">
          <p className="text-sm text-gray-600">
            Algo salió mal. Puedes intentar nuevamente.
          </p>

          <button
            className="btn btn-primary"
            onClick={() => reset()}
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}