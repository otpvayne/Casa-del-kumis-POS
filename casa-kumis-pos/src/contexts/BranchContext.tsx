"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  is_active: boolean;
}

interface BranchContextType {
  selectedBranch: Branch | null;
  branches: Branch[];
  loading: boolean;
  error: string | null;
  setBranch: (branch: Branch) => void;
  fetchBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar branches disponibles
  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");

      const data = await response.json();
      setBranches(data);

      // Seleccionar la primera rama activa por defecto
      const defaultBranch = data.find((b: Branch) => b.is_active);
      if (defaultBranch) {
        // Cargar del localStorage si existe
        const savedBranchId = localStorage.getItem("selectedBranchId");
        const branchToSet = data.find((b: Branch) => b.id === savedBranchId) || defaultBranch;
        setSelectedBranch(branchToSet);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading branches");
      console.error("Error fetching branches:", err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar branches al montar el componente
  useEffect(() => {
    fetchBranches();
  }, []);

  // Guardar selección en localStorage
  const setBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    localStorage.setItem("selectedBranchId", branch.id);
  };

  return (
    <BranchContext.Provider
      value={{
        selectedBranch,
        branches,
        loading,
        error,
        setBranch,
        fetchBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within BranchProvider");
  }
  return context;
};
