"use client";

import { useState } from "react";
import { MaterialBatch, calculateCostPerUnit } from "@/utils/costCalculations";

interface BatchSelectorProps {
  ingredientName: string;
  ingredientId: string;
  availableBatches: MaterialBatch[];
  selectedBatchId?: string;
  onSelectBatch: (batchId: string) => void;
  showCost?: boolean;
}

/**
 * Componente para seleccionar un lote de una materia prima
 * Muestra los lotes disponibles con información de costo
 */
export function BatchSelector({
  ingredientName,
  ingredientId,
  availableBatches,
  selectedBatchId,
  onSelectBatch,
  showCost = true,
}: BatchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedBatch = availableBatches.find((b) => b.id === selectedBatchId);

  if (!availableBatches || availableBatches.length === 0) {
    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        ⚠️ No hay lotes disponibles para {ingredientName}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">
        {ingredientName}
        {!selectedBatchId && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 py-2 rounded-lg border text-left transition ${
            selectedBatchId
              ? "border-blue-300 bg-blue-50 text-gray-900"
              : "border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {selectedBatch ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{selectedBatch.lot_code}</div>
                <div className="text-xs text-gray-600">
                  {selectedBatch.quantity_out} {selectedBatch.id} • $
                  {calculateCostPerUnit(selectedBatch).toFixed(2)}/unidad
                </div>
              </div>
              <span className="text-blue-600">✓</span>
            </div>
          ) : (
            "Selecciona un lote..."
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            {availableBatches.map((batch) => {
              const costPerUnit = calculateCostPerUnit(batch);
              return (
                <button
                  key={batch.id}
                  onClick={() => {
                    onSelectBatch(batch.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 border-b border-gray-200 hover:bg-blue-50 transition ${
                    selectedBatchId === batch.id ? "bg-blue-100 font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{batch.lot_code}</div>
                      <div className="text-xs text-gray-600">
                        Ingreso: {new Date(batch.batch_date).toLocaleDateString("es-CO")}
                      </div>
                      <div className="text-xs text-gray-600">
                        Disponible: {batch.quantity_out} unidades
                      </div>
                      {showCost && (
                        <div className="text-xs text-blue-700 font-semibold">
                          ${costPerUnit.toFixed(2)}/unidad
                        </div>
                      )}
                    </div>
                    {selectedBatchId === batch.id && <span className="text-blue-600">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
