"use client";

import { useBranch } from "@/contexts/BranchContext";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function BranchSelector() {
  const { selectedBranch, branches, setBranch, loading } = useBranch();
  const [isOpen, setIsOpen] = useState(false);

  if (loading || !selectedBranch) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 bg-gray-100 rounded-lg">
        Cargando plantas...
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium transition"
      >
        <span className="text-gray-700">Planta:</span>
        <span className="font-semibold text-blue-700">{selectedBranch.name}</span>
        <ChevronDown size={16} className={`transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-48">
          {branches.filter((b) => b.is_active).map((branch) => (
            <button
              key={branch.id}
              onClick={() => {
                setBranch(branch);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition ${
                selectedBranch.id === branch.id
                  ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              ✓ {branch.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
