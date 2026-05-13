/**
 * Sistema de Cálculo de Costos
 * - Calcula costo por unidad de materias primas
 * - Calcula costo de ingredientes en productos
 * - Maneja productos anidados recursivamente
 */

export interface MaterialBatch {
  id: string;
  raw_material_id: string;
  quantity_in: number;
  quantity_out: number;
  waste?: number;
  cost: number;
  cost_per_unit?: number;
  batch_date: string;
  lot_code: string;
}

export interface ProductIngredient {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_type: "RAW_MATERIAL" | "PRODUCT";
  quantity: number;
  unit: string;
  state_id?: string;
}

export interface IngredientCostBreakdown {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_type: string;
  quantity_used: number;
  batch_id: string;
  batch_lot_code: string;
  cost_per_unit: number;
  cost_total: number;
  unit: string;
}

/**
 * Calcula el costo por unidad de un lote
 * Usa cost_per_unit si ya está calculado, si no lo calcula de cost / quantity_out
 */
export const calculateCostPerUnit = (batch: MaterialBatch): number => {
  // Preferir cost_per_unit si ya está almacenado
  if (batch.cost_per_unit && batch.cost_per_unit > 0) {
    return batch.cost_per_unit;
  }
  const quantity_final = batch.quantity_out;
  if (quantity_final <= 0) return 0;
  return batch.cost / quantity_final;
};

/**
 * Calcula el costo de un ingrediente específico
 * Formula: Cantidad Usada × Costo Unitario del Lote
 */
export const calculateIngredientCost = (
  quantity: number,
  batch: MaterialBatch
): number => {
  const costPerUnit = calculateCostPerUnit(batch);
  return quantity * costPerUnit;
};

/**
 * Calcula el costo total de un producto (recursivo para anidados)
 * - Si es materia prima: usa el lote seleccionado
 * - Si es producto: recursivamente calcula sus ingredientes
 */
export const calculateProductCost = (
  product_id: string,
  ingredients: ProductIngredient[],
  selectedBatches: Record<string, string>, // ingredientId -> batchId
  batches: MaterialBatch[],
  formulas: Map<string, ProductIngredient[]>
): {
  totalCost: number;
  breakdown: IngredientCostBreakdown[];
} => {
  let totalCost = 0;
  const breakdown: IngredientCostBreakdown[] = [];

  for (const ingredient of ingredients) {
    if (ingredient.ingredient_type === "RAW_MATERIAL") {
      // Materia prima: buscar el lote seleccionado
      const batchId = selectedBatches[ingredient.ingredient_id];
      if (!batchId) {
        console.warn(`No batch selected for raw material: ${ingredient.ingredient_id} (${ingredient.ingredient_name})`);
        continue;
      }

      const batch = batches.find((b) => b.id === batchId);
      if (!batch) {
        console.warn(`Batch not found: ${batchId}`);
        continue;
      }

      const costPerUnit = calculateCostPerUnit(batch);
      const ingredientCost = calculateIngredientCost(ingredient.quantity, batch);

      totalCost += ingredientCost;
      breakdown.push({
        ingredient_id: ingredient.ingredient_id,
        ingredient_name: ingredient.ingredient_name,
        ingredient_type: "RAW_MATERIAL",
        quantity_used: ingredient.quantity,
        batch_id: batch.id,
        batch_lot_code: batch.lot_code,
        cost_per_unit: costPerUnit,
        cost_total: ingredientCost,
        unit: ingredient.unit,
      });

    } else if (ingredient.ingredient_type === "PRODUCT") {
      // Producto anidado: calcular recursivamente sin necesitar batch propio
      const subIngredients = formulas.get(ingredient.ingredient_id);
      if (!subIngredients) {
        console.warn(`Formula not found for product: ${ingredient.ingredient_id} (${ingredient.ingredient_name})`);
        continue;
      }

      const { totalCost: subTotalCost, breakdown: subBreakdown } = calculateProductCost(
        ingredient.ingredient_id,
        subIngredients,
        selectedBatches,
        batches,
        formulas
      );

      const nestedCost = subTotalCost * ingredient.quantity;
      totalCost += nestedCost;

      breakdown.push({
        ingredient_id: ingredient.ingredient_id,
        ingredient_name: ingredient.ingredient_name,
        ingredient_type: "PRODUCT",
        quantity_used: ingredient.quantity,
        batch_id: "N/A",
        batch_lot_code: "N/A",
        cost_per_unit: subTotalCost,
        cost_total: nestedCost,
        unit: ingredient.unit,
      });

      breakdown.push(...subBreakdown);
    }
  }

  return { totalCost, breakdown };
};

/**
 * Formatea el desglose de costos para almacenar en JSON
 */
export const formatCostBreakdown = (breakdown: IngredientCostBreakdown[]) => {
  return {
    ingredients: breakdown,
    summary: {
      total_cost: breakdown.reduce((sum, item) => sum + item.cost_total, 0),
      ingredient_count: breakdown.filter((item) => item.ingredient_type === "RAW_MATERIAL").length,
      nested_products_count: breakdown.filter((item) => item.ingredient_type === "PRODUCT").length,
    },
  };
};

/**
 * Calcula la variancia de costo (real vs estimado)
 */
export const calculateCostVariance = (
  estimatedCost: number,
  realCost: number
): {
  variance: number;
  variancePercentage: number;
} => {
  const variance = realCost - estimatedCost;
  const variancePercentage = estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0;

  return { variance, variancePercentage };
};
