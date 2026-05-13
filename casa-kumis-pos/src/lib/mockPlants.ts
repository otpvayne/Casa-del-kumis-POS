/**
 * Mock de plantas para testing en desarrollo (sin tabla en Supabase)
 * Usa localStorage para persistencia
 */

export interface MockPlant {
  id: string;
  name: string;
  is_active: boolean;
}

const STORAGE_KEY = "mock_plants";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function getMockPlants(): MockPlant[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }

    // Retornar plantas por defecto si no hay stored
    return [
      { id: "55e2607b-ef2c-4b0e-a54a-b2601a7bf11b", name: "Planta 1", is_active: true },
    ];
  } catch (error) {
    console.error("Error reading mock plants:", error);
    // Siempre retornar al menos Planta 1
    return [
      { id: "55e2607b-ef2c-4b0e-a54a-b2601a7bf11b", name: "Planta 1", is_active: true },
    ];
  }
}

export function initializeMockPlants(): MockPlant[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return getMockPlants();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const defaultPlants: MockPlant[] = [
        { id: "55e2607b-ef2c-4b0e-a54a-b2601a7bf11b", name: "Planta 1", is_active: true },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPlants));
      return defaultPlants;
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error initializing mock plants:", error);
    return getMockPlants();
  }
}

export function createMockPlant(name: string): MockPlant {
  const plants = getMockPlants();
  const newPlant: MockPlant = {
    id: generateId(),
    name,
    is_active: true,
  };
  plants.push(newPlant);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
  return newPlant;
}

export function deleteMockPlant(id: string): boolean {
  const plants = getMockPlants();
  const filtered = plants.filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return plants.length !== filtered.length;
}
