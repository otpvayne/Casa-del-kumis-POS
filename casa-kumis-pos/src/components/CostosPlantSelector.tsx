"use client";

import { useEffect, useState } from "react";
import { Factory, Plus } from "lucide-react";

interface Plant {
  id: string;
  name: string;
  is_active: boolean;
}

interface CostosPlantSelectorProps {
  onSelectPlant: (plantId: string, plantName: string) => void;
}

export function CostosPlantSelector({ onSelectPlant }: CostosPlantSelectorProps) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlantName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error creando planta");
      }

      const newPlant = await response.json();
      setPlants([...plants, newPlant]);
      setNewPlantName("");
      setShowCreateForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando planta");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlant = async (plantId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta planta?")) return;

    setIsDeleting(plantId);
    try {
      const response = await fetch(`/api/plants/${plantId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error eliminando planta");

      setPlants(plants.filter((p) => p.id !== plantId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando planta");
    } finally {
      setIsDeleting(null);
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
              </div>
            ) : (
              <div className="space-y-3">
                {plants.map((plant) => (
                  <div key={plant.id} className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectPlant(plant.id, plant.name)}
                      className="flex-1 px-4 py-4 text-left bg-slate-50 hover:bg-blue-50 border-2 border-slate-200 hover:border-blue-400 rounded-lg transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <Factory size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{plant.name}</p>
                          <p className="text-xs text-slate-500">Haz clic para seleccionar</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeletePlant(plant.id)}
                      disabled={isDeleting === plant.id}
                      className="px-3 py-3 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-semibold disabled:opacity-50"
                      title="Eliminar planta"
                    >
                      {isDeleting === plant.id ? "..." : "✕"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Separador */}
            {plants.length > 0 && <div className="border-t border-slate-200 my-3" />}

            {/* Formulario de crear planta */}
            {showCreateForm ? (
              <form onSubmit={handleCreatePlant} className="space-y-2">
                <input
                  type="text"
                  placeholder="Nombre de la planta"
                  value={newPlantName}
                  onChange={(e) => setNewPlantName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  autoFocus
                  disabled={isCreating}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isCreating || !newPlantName.trim()}
                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                  >
                    {isCreating ? "Creando..." : "Crear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewPlantName("");
                    }}
                    className="flex-1 px-3 py-2 bg-slate-300 text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition"
              >
                + Nueva Planta
              </button>
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
