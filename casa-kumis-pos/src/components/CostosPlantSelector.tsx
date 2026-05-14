"use client";

import { useEffect, useState } from "react";
import { Factory, Plus } from "lucide-react";

interface Plant {
  id: string;
  name: string;
  is_active: boolean;
}

interface CostosPlantSelectorProps {
  onSelectPlant: (plantId: string) => void;
}

export function CostosPlantSelector({ onSelectPlant }: CostosPlantSelectorProps) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlants();
  }, []);

  const loadPlants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/plants");
      if (!response.ok) throw new Error("No se pudieron cargar las plantas");
      const data = await response.json();
      setPlants(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando plantas");
      setPlants([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Factory size={48} className="text-blue-600" />
          </div>
          <p className="text-slate-600">Cargando plantas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
            <div className="flex items-center gap-3 mb-2">
              <Factory size={32} className="text-white" />
              <h1 className="text-2xl font-bold text-white">Casa del Kumis</h1>
            </div>
            <p className="text-blue-100">Módulo de Control de Costos</p>
          </div>

          {/* Content */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Selecciona una planta</h2>
            <p className="text-slate-600 text-sm mb-6">
              Elige la planta con la que deseas trabajar
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {plants.length === 0 ? (
              <div className="text-center py-8">
                <Factory size={48} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No hay plantas creadas aún</p>
                <button
                  onClick={() => window.location.href = "/admin"}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Ir a configuración
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {plants.map((plant) => (
                  <button
                    key={plant.id}
                    onClick={() => onSelectPlant(plant.id)}
                    className="w-full px-4 py-4 text-left bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-lg transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Factory size={24} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{plant.name}</p>
                        <p className="text-sm text-slate-500">Haz clic para seleccionar</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
            <button
              onClick={() => window.location.href = "/admin"}
              className="w-full px-4 py-2 text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors"
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
