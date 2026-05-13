"use client";

import { IngredientCostBreakdown } from "@/utils/costCalculations";

interface CostBreakdownProps {
  breakdown: IngredientCostBreakdown[];
  totalCost: number;
  costPerUnit: number;
  unit?: string;
  variancePercentage?: number;
  showVariance?: boolean;
}

/**
 * Componente para mostrar el desglose detallado de costos
 * Muestra cada ingrediente y su contribución al costo total
 */
export function CostBreakdown({
  breakdown,
  totalCost,
  costPerUnit,
  unit = "unidad",
  variancePercentage,
  showVariance = true,
}: CostBreakdownProps) {
  // Agrupar por tipo para mejor visualización
  const rawMaterials = breakdown.filter((item) => item.ingredient_type === "RAW_MATERIAL");
  const nestedProducts = breakdown.filter((item) => item.ingredient_type === "PRODUCT");

  return (
    <div className="space-y-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div>
        <h3 className="font-bold text-lg text-gray-900">📊 Desglose de Costos</h3>
        <p className="text-xs text-gray-600 mt-1">Costo estimado basado en lotes seleccionados</p>
      </div>

      {/* Materias primas */}
      {rawMaterials.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-700">Materias Primas</h4>
          <div className="space-y-1 text-sm">
            {rawMaterials.map((item, idx) => (
              <div key={`${item.ingredient_id}-${item.batch_id}-${idx}`} className="flex items-center justify-between py-1">
                <div className="flex-1">
                  <div className="text-gray-900">
                    {item.ingredient_name}
                    <span className="text-xs text-gray-600 ml-2">
                      ({item.quantity_used} {item.unit})
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {item.batch_lot_code} • ${item.cost_per_unit.toFixed(2)}/{item.unit}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${item.cost_total.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos anidados */}
      {nestedProducts.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-700">Productos Anidados</h4>
          <div className="space-y-1 text-sm">
            {nestedProducts.map((item, idx) => (
              <div key={`${item.ingredient_id}-${idx}`} className="flex items-center justify-between py-1">
                <div className="flex-1">
                  <div className="text-gray-900">
                    🍲 {item.ingredient_name}
                    <span className="text-xs text-gray-600 ml-2">
                      ({item.quantity_used} {item.unit})
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    ${item.cost_per_unit.toFixed(2)} por {item.unit}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">${item.cost_total.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totales */}
      <div className="border-t border-yellow-300 pt-3 mt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-900">Costo Total Estimado:</span>
          <span className="text-lg font-bold text-green-700">${totalCost.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900">Costo por {unit}:</span>
          <span className="text-lg font-bold text-blue-700">${costPerUnit.toFixed(2)}</span>
        </div>

        {/* Variancia */}
        {showVariance && variancePercentage !== undefined && (
          <div className="mt-3 pt-3 border-t border-yellow-300">
            <div
              className={`flex items-center justify-between text-sm font-semibold ${
                variancePercentage < 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              <span>Variancia:</span>
              <span>{variancePercentage > 0 ? "+" : ""}{variancePercentage.toFixed(2)}%</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {variancePercentage < 0
                ? "✓ Ahorro en ingredientes"
                : "⚠️ Exceso en ingredientes"}
            </p>
          </div>
        )}
      </div>

      {/* Footer con leyenda */}
      <div className="text-xs text-gray-600 italic border-t border-yellow-300 pt-2 mt-2">
        💡 Este costo es teórico basado en los lotes seleccionados y las cantidades de la fórmula.
      </div>
    </div>
  );
}
