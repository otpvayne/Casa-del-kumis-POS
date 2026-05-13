-- Migración: Agregar soporte multi-planta (branch_id) y costos
-- Fecha: 2026-05-12
-- Nota: Ejecutar en Supabase cuando el usuario lo apruebe

-- 1. Agregar branch_id, plant_id y cost_per_unit a raw_material_batches
ALTER TABLE raw_material_batches
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id),
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC;

-- 2. Agregar branch_id a raw_material_inventory
ALTER TABLE raw_material_inventory
ADD COLUMN IF NOT EXISTS branch_id UUID;

-- 3. Agregar batch_id a production_ingredient_usage
ALTER TABLE production_ingredient_usage
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES raw_material_batches(id);

-- 4. Mejorar production_variance_log con costos
ALTER TABLE production_variance_log
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS cost_estimated NUMERIC,
ADD COLUMN IF NOT EXISTS cost_breakdown JSONB;

-- 5. Mejorar production_records
ALTER TABLE production_records
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS cost_estimated NUMERIC;

-- 6. Mejorar cost_module_alerts
ALTER TABLE cost_module_alerts
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS state_id UUID REFERENCES raw_material_states(id);

-- 7. Crear tabla product_cost_history
CREATE TABLE IF NOT EXISTS product_cost_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_produced NUMERIC NOT NULL,
  cost_estimated NUMERIC NOT NULL,
  cost_per_unit NUMERIC,
  cost_breakdown JSONB,
  variance_percentage NUMERIC,
  production_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(branch_id, product_id, production_date)
);

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_raw_material_batches_branch ON raw_material_batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_cost_history_branch ON product_cost_history(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_cost_history_product ON product_cost_history(product_id);
