"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { initializeMockPlants } from "@/lib/mockPlants";

export interface Plant {
  id: string;
  name: string;
  is_active: boolean;
}

interface PlantContextType {
  plants: Plant[];
  selectedPlantId: string | null;
  selectedPlant: Plant | null;
  selectPlant: (plantId: string) => void;
  addPlant: (name: string) => Promise<Plant | null>;
  deletePlant: (plantId: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

const PlantContext = createContext<PlantContextType | undefined>(undefined);

export function PlantProvider({ children }: { children: React.ReactNode }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar plantas al montar
  useEffect(() => {
    loadPlants();
  }, []);

  // Cargar planta seleccionada del localStorage o seleccionar Planta 1 por defecto
  useEffect(() => {
    const stored = localStorage.getItem("selectedPlantId");
    if (stored) {
      setSelectedPlantId(stored);
    } else if (plants.length > 0) {
      // Si no hay selección guardada, seleccionar la primera planta (Planta 1)
      setSelectedPlantId(plants[0].id);
    }
  }, [plants]);

  // Guardar planta seleccionada en localStorage
  useEffect(() => {
    if (selectedPlantId) {
      localStorage.setItem("selectedPlantId", selectedPlantId);
    }
  }, [selectedPlantId]);

  const loadPlants = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/plants");
      if (!response.ok) throw new Error("Failed to load plants");
      const data = await response.json();

      if (data.length === 0) {
        // Si no hay plantas, usar mock
        const mockPlants = initializeMockPlants();
        setPlants(mockPlants);
      } else {
        setPlants(data);
      }
    } catch (err) {
      // Error al conectar con Supabase, usar mock
      const mockPlants = initializeMockPlants();
      setPlants(mockPlants);
      setError(null); // No mostrar error si estamos usando mock
    } finally {
      setIsLoading(false);
    }
  };

  const selectPlant = (plantId: string) => {
    setSelectedPlantId(plantId);
  };

  const addPlant = async (name: string): Promise<Plant | null> => {
    try {
      setError(null);
      const response = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create plant");
      }

      const newPlant = await response.json();
      setPlants([...plants, newPlant]);
      setSelectedPlantId(newPlant.id);
      return newPlant;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create plant";
      setError(message);
      return null;
    }
  };

  const deletePlant = async (plantId: string): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch(`/api/plants/${plantId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete plant");
      }

      setPlants(plants.filter((p) => p.id !== plantId));

      // Si la planta eliminada era la seleccionada, seleccionar otra
      if (selectedPlantId === plantId) {
        const remaining = plants.filter((p) => p.id !== plantId);
        setSelectedPlantId(remaining.length > 0 ? remaining[0].id : null);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete plant";
      setError(message);
      return false;
    }
  };

  const selectedPlant = selectedPlantId
    ? plants.find((p) => p.id === selectedPlantId) || null
    : null;

  const value: PlantContextType = {
    plants,
    selectedPlantId,
    selectedPlant,
    selectPlant,
    addPlant,
    deletePlant,
    isLoading,
    error,
  };

  return (
    <PlantContext.Provider value={value}>{children}</PlantContext.Provider>
  );
}

export function usePlant() {
  const context = useContext(PlantContext);
  if (!context) {
    throw new Error("usePlant must be used within a PlantProvider");
  }
  return context;
}
