# 📊 Sistema de Cálculo de Costos - Casa del Kumis

## Estado Actual (May 12, 2026)

### ✅ Implementado (Local)

#### 1. **Infraestructura de Bases de Datos**
- Archivo de migraciones SQL: `.claude/migrations/001_add_branch_support.sql`
- **NO EJECUTADO EN SUPABASE AÚN** - Pendiente aprobación del usuario

#### 2. **Sistema Multi-Planta (Branch)**
- `src/contexts/BranchContext.tsx` - Context para manejar selección de planta
- `src/components/BranchSelector.tsx` - Selector visual de plantas
- `src/app/api/branches/route.ts` - API endpoint para obtener plantas
- Integrado en `src/app/layout.tsx`

#### 3. **Cálculo de Costos**
- `src/utils/costCalculations.ts` - Funciones matemáticas:
  - `calculateCostPerUnit()` - Costo unitario de un lote
  - `calculateIngredientCost()` - Costo de un ingrediente
  - `calculateProductCost()` - Costo recursivo de productos (incluye anidados)
  - `formatCostBreakdown()` - Formato para almacenar en JSON
  - `calculateCostVariance()` - Variancia real vs estimado

#### 4. **Hooks**
- `src/hooks/useProductCost.ts` - Hook para gestionar:
  - Selección de lotes
  - Cálculos de costos
  - Variancia de costos

#### 5. **Componentes de UI**
- `src/components/BatchSelector.tsx` - Selector de lotes para ingredientes
- `src/components/CostBreakdown.tsx` - Desglose visual de costos

---

## 📋 Fórmula de Cálculo

### Para Materias Primas (Lotes)
```
Costo Unitario = Costo Total / Cantidad Final
Cantidad Final = Cantidad Entrada - Merma

Ejemplo:
- HARINA: $100 / 10kg = $10/kg (sin merma)
- CARNE: $300 / 14kg = $21.43/kg (15kg entrada - 1kg merma)
```

### Para Ingredientes en Fórmula
```
Costo Ingrediente = Cantidad Usada × Costo Unitario del Lote

Ejemplo:
- 0.5kg HARINA × $10/kg = $5
```

### Para Productos (Incluyendo Anidados)
```
Costo Producto = Σ (Cantidad × Costo Unitario) + Σ (Cantidad × Costo Sub-Producto)

Ejemplo EMPANADA:
= (1.00 MASA × $7.70/MASA) + (1.50 CARNE_COCINADA × $18.34/CARNE)
= $7.70 + $27.51
= $35.21 por unidad
```

---

## 🔄 Flujo Completo (Pendiente Implementar)

### 1. Entrada Inicial
```
Usuario ingresa:
- Materia Prima: HARINA
- Cantidad: 10kg
- Costo Total: $100
- Código Lote: HARINA-20260512-001

Sistema calcula automáticamente:
- Costo Unitario: $100 / 10kg = $10/kg
- Guarda en raw_material_batches con plant_id
```

### 2. Registrar Merma
```
Usuario selecciona:
- Materia Prima: HARINA
- Lote: HARINA-20260512-001
- Cantidad Merma: 0.5kg

Sistema:
- Actualiza quantity_out (10 - 0.5 = 9.5)
- Recalcula costo_per_unit ($100 / 9.5 = $10.53/kg)
- Guarda en batch_merma_history
```

### 3. Analizar Variancia
```
Usuario selecciona:
- Producto: EMPANADA DE CARNE
- Cantidad Real: 10 unidades
- Para cada ingrediente, selecciona lote:
  * MASA: Lote MASA-001
  * CARNE: Lote CARNE-002

Sistema:
1. Obtiene lotes de raw_material_batches
2. Calcula costo de cada ingrediente
3. Calcula costo total del producto
4. Muestra desglose con CostBreakdown
5. Al registrar, guarda en production_variance_log:
   - cost_estimated: $35.21 total
   - cost_breakdown: JSON con desglose
```

---

## 📁 Estructura de Tablas Supabase

### Nuevas Columnas (Pendiente)
```
raw_material_batches:
  ✓ branch_id UUID
  ✓ cost_per_unit NUMERIC

raw_material_inventory:
  ✓ branch_id UUID

production_variance_log:
  ✓ branch_id UUID
  ✓ cost_estimated NUMERIC
  ✓ cost_breakdown JSONB

production_records:
  ✓ branch_id UUID
  ✓ cost_estimated NUMERIC

cost_module_alerts:
  ✓ branch_id UUID
  ✓ state_id UUID (para alertas por estado)

production_ingredient_usage:
  ✓ batch_id UUID (para vincular a lotes)
```

### Nueva Tabla
```
product_cost_history:
  - id UUID
  - branch_id UUID
  - product_id UUID
  - quantity_produced NUMERIC
  - cost_estimated NUMERIC
  - cost_per_unit NUMERIC
  - cost_breakdown JSONB
  - variance_percentage NUMERIC
  - production_date DATE
  - created_at TIMESTAMP
  - created_by UUID
```

---

## 🚀 Próximos Pasos

### FASE 1: Integrar en "Entrada Inicial"
- [ ] Mostrar unidad de cada materia prima como guía
- [ ] Auto-calcular Costo Unitario = Costo Total / Cantidad
- [ ] Guardar en raw_material_batches (con branch_id)
- [ ] Hacer "Costo Total" y "Código Lote" obligatorios

### FASE 2: Integrar en "Merma Adicional"
- [ ] Permitir seleccionar lote manualmente
- [ ] Restar merma de cantidad del lote
- [ ] Recalcular costo_per_unit
- [ ] Guardar en batch_merma_history

### FASE 3: Integrar en "Analizar Variancia"
- [ ] Mostrar BatchSelector para cada ingrediente (incluyendo anidados)
- [ ] Calcular y mostrar CostBreakdown
- [ ] Guardar cost_estimated y cost_breakdown en production_variance_log

### FASE 4: Historial de Costos
- [ ] Crear tabla product_cost_history
- [ ] Guardar al registrar variancia
- [ ] Crear vista en "Reportes" > "Historial de Costos"

### FASE 5: Alertas Mejoradas
- [ ] Integrar branch_id y state_id en cost_module_alerts
- [ ] Mostrar alertas con filtro por estado

### FASE 6: Reportes de Costos
- [ ] Costo promedio por producto
- [ ] Productos más/menos caros
- [ ] Variancia de costos

---

## 🔧 Cómo Usar (Localmente)

### Para calcular costo de un producto:
```typescript
import { useProductCost } from "@/hooks/useProductCost";

const { 
  selectedBatches, 
  costResult, 
  calculateCost, 
  selectBatch 
} = useProductCost({ batches, formulas });

// Seleccionar lotes
selectBatch("ingrediente-1-id", "batch-1-id");
selectBatch("ingrediente-2-id", "batch-2-id");

// Calcular costo
const result = calculateCost("product-id", ingredients, 10);
// result.totalCost
// result.costPerUnit
// result.breakdown (desglose detallado)
```

---

## 📝 Notas Importantes

1. **Multi-Planta**: El sistema ahora es multi-planta. Cada registro debe tener `branch_id`.
2. **Lotes**: Ya existen en `raw_material_batches`. Solo agregamos `branch_id` y `cost_per_unit`.
3. **Productos Anidados**: El sistema calcula recursivamente costos de MASA, CARNE, etc.
4. **Migraciones**: El archivo SQL está listo pero NO se ha ejecutado en Supabase.
5. **LocalStorage**: La selección de planta se guarda en localStorage.

---

## ⚠️ IMPORTANTE

**NO HACER PUSH HASTA QUE EL USUARIO APRUEBE**

- [ ] Las migraciones SQL necesitan ser revisadas
- [ ] El BranchContext debe integrase con toda la app
- [ ] Falta integrar en los modales (Entrada Inicial, Merma, Analizar Variancia)
- [ ] Falta crear endpoints de API para guardar costos

Esperar confirmación del usuario antes de avanzar a la siguiente fase.
