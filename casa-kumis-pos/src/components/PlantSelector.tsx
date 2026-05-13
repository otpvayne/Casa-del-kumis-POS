"use client";

import { useState } from "react";
import { usePlant } from "@/contexts/PlantContext";

export function PlantSelector() {
  const { plants, selectedPlant, selectPlant, addPlant, deletePlant, isLoading } = usePlant();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleCreatePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantName.trim()) return;

    setIsCreating(true);
    const result = await addPlant(newPlantName.trim());
    setIsCreating(false);

    if (result) {
      setNewPlantName("");
      setShowCreateForm(false);
      setIsOpen(false);
    }
  };

  const handleDeletePlant = async (plantId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta planta?")) return;

    setIsDeleting(plantId);
    await deletePlant(plantId);
    setIsDeleting(null);
  };

  if (isLoading) {
    return (
      <button className="badge" disabled>
        Cargando plantas...
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`badge ${selectedPlant ? "bg-blue-100 border-blue-300" : "bg-yellow-100 border-yellow-300"}`}
      >
        🏭 {selectedPlant ? selectedPlant.name : "Sin planta"}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {plants.length === 0 ? (
              <div className="text-sm text-gray-600 italic text-center py-2">
                No hay plantas creadas aún
              </div>
            ) : (
              plants.map((plant) => (
                <div key={plant.id} className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      selectPlant(plant.id);
                      setIsOpen(false);
                    }}
                    className={`flex-1 px-3 py-2 rounded text-left text-sm transition ${
                      selectedPlant?.id === plant.id
                        ? "bg-blue-100 border border-blue-300 font-semibold text-blue-900"
                        : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {plant.name}
                  </button>
                  <button
                    onClick={() => handleDeletePlant(plant.id)}
                    disabled={isDeleting === plant.id}
                    className="px-2 py-2 text-red-600 hover:bg-red-50 rounded transition text-sm font-semibold disabled:opacity-50"
                    title="Eliminar planta"
                  >
                    {isDeleting === plant.id ? "..." : "✕"}
                  </button>
                </div>
              ))
            )}

            {/* Separador */}
            {plants.length > 0 && <div className="border-t border-gray-200 my-2" />}

            {/* Formulario de crear planta */}
            {showCreateForm ? (
              <form onSubmit={handleCreatePlant} className="space-y-2 pt-2">
                <input
                  type="text"
                  placeholder="Nombre de la planta"
                  value={newPlantName}
                  onChange={(e) => setNewPlantName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  autoFocus
                  disabled={isCreating}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isCreating || !newPlantName.trim()}
                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
                  >
                    {isCreating ? "Creando..." : "Crear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewPlantName("");
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 text-gray-900 rounded text-sm font-semibold hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-600 transition"
              >
                + Nueva Planta
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
