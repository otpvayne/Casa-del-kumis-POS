"use client";

import { useState } from "react";

export interface BatchLot {
  id: string;
  lot_code: string;
  raw_material_id: string;
  raw_material_name?: string;
  quantity_out: number;
  cost_per_unit: number;
  unit: string;
  batch_date: string;
}

interface BatchLotSelectorProps {
  batches: BatchLot[];
  selectedBatchId?: string;
  selectedQuantity?: number;
  onSelectBatch: (batchId: string) => void;
  onQuantityChange?: (quantity: number) => void;
  label?: string;
  filterByMaterialId?: string; // Filtrar por raw_material_id
}

export function BatchLotSelector({
  batches,
  selectedBatchId,
  selectedQuantity,
  onSelectBatch,
  onQuantityChange,
  label = "Seleccionar Lote",
  filterByMaterialId,
}: BatchLotSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filtrar por material si se especifica
  const filteredBatches = filterByMaterialId
    ? batches.filter((b) => b.raw_material_id === filterByMaterialId)
    : batches;

  const selectedBatch = filteredBatches.find((b) => b.id === selectedBatchId);

  // Filtrar solo lotes con cantidad disponible
  const availableBatches = filteredBatches.filter((b) => b.quantity_out > 0);

  if (availableBatches.length === 0) {
    return (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        ⚠️ No hay lotes disponibles con stock
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 py-2 rounded-lg border text-left transition ${
            selectedBatchId
              ? "border-blue-300 bg-blue-50 text-gray-900"
              : "border-gray-300 bg-white text-gray-600"
          }`}
        >
          {selectedBatch ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{selectedBatch.lot_code}</div>
                <div className="text-xs text-gray-600">
                  {selectedBatch.raw_material_name} • {selectedBatch.quantity_out} {selectedBatch.unit}
                </div>
              </div>
              <span className="text-blue-600">✓</span>
            </div>
          ) : (
            "Selecciona un lote..."
          )}
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {availableBatches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => {
                  onSelectBatch(batch.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-3 border-b border-gray-200 hover:bg-blue-50 transition ${
                  selectedBatchId === batch.id ? "bg-blue-100 font-semibold" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{batch.lot_code}</div>
                    <div className="text-xs text-gray-600">
                      {batch.raw_material_name}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Disponible: {batch.quantity_out} {batch.unit} • ${batch.cost_per_unit.toFixed(2)}/{batch.unit}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Ingreso: {new Date(batch.batch_date).toLocaleDateString("es-CO")}
                    </div>
                  </div>
                  {selectedBatchId === batch.id && <span className="text-blue-600">✓</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedBatch && (
        <div className="space-y-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="text-gray-700">
              <div className="font-semibold mb-2">{selectedBatch.raw_material_name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Disponible:</span>
                  <div className="font-semibold text-blue-700">{selectedBatch.quantity_out} {selectedBatch.unit}</div>
                </div>
                <div>
                  <span className="text-gray-600">Costo/unidad:</span>
                  <div className="font-semibold text-blue-700">${selectedBatch.cost_per_unit.toFixed(2)}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Lote:</span>
                  <div className="font-semibold text-gray-900">{selectedBatch.lot_code}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
