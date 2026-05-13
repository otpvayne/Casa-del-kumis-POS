import { useState, useCallback } from "react";
import {
  MaterialBatch,
  ProductIngredient,
  IngredientCostBreakdown,
  calculateProductCost,
  formatCostBreakdown,
  calculateCostVariance,
} from "@/utils/costCalculations";

interface UseProductCostProps {
  batches: MaterialBatch[];
  formulas: Map<string, ProductIngredient[]>;
}

interface ProductCostResult {
  totalCost: number;
  costPerUnit: number;
  breakdown: IngredientCostBreakdown[];
  formattedBreakdown: any;
}

/**
 * Hook para calcular costos de productos
 * Maneja productos anidados y desglose de costos
 */
export const useProductCost = ({ batches, formulas }: UseProductCostProps) => {
  const [selectedBatches, setSelectedBatches] = useState<Record<string, string>>({});
  const [costResult, setCostResult] = useState<ProductCostResult | null>(null);

  /**
   * Calcula el costo de un producto basado en lotes seleccionados
   */
  const calculateCost = useCallback(
    (
      productId: string,
      ingredients: ProductIngredient[],
      quantity: number = 1
    ) => {
      try {
        // Validar que todos los ingredientes tengan lote seleccionado
        const missingBatches = ingredients.filter(
          (ing) => !selectedBatches[ing.ingredient_id]
        );

        if (missingBatches.length > 0) {
          console.warn("Missing batch selection for:", missingBatches);
          return null;
        }

        // Calcular costo
        const { totalCost, breakdown } = calculateProductCost(
          productId,
          ingredients,
          selectedBatches,
          batches,
          formulas
        );

        const costPerUnit = totalCost / quantity;
        const formattedBreakdown = formatCostBreakdown(breakdown);

        const result = {
          totalCost,
          costPerUnit,
          breakdown,
          formattedBreakdown,
        };

        setCostResult(result);
        return result;
      } catch (error) {
        console.error("Error calculating product cost:", error);
        return null;
      }
    },
    [selectedBatches, batches, formulas]
  );

  /**
   * Selecciona un lote para un ingrediente
   */
  const selectBatch = useCallback((ingredientId: string, batchId: string) => {
    setSelectedBatches((prev) => ({
      ...prev,
      [ingredientId]: batchId,
    }));
  }, []);

  /**
   * Obtiene los lotes disponibles para un ingrediente
   */
  const getAvailableBatches = useCallback(
    (ingredientId: string): MaterialBatch[] => {
      return batches.filter((b) => b.raw_material_id === ingredientId);
    },
    [batches]
  );

  /**
   * Calcula variancia entre costo estimado y real
   */
  const getVariance = useCallback(
    (estimatedCost: number, realCost: number) => {
      return calculateCostVariance(estimatedCost, realCost);
    },
    []
  );

  /**
   * Resetea la selección de lotes
   */
  const resetSelection = useCallback(() => {
    setSelectedBatches({});
    setCostResult(null);
  }, []);

  return {
    selectedBatches,
    costResult,
    calculateCost,
    selectBatch,
    getAvailableBatches,
    getVariance,
    resetSelection,
  };
};
