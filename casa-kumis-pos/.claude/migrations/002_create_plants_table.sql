-- Migración: Crear tabla independiente de plantas
-- Fecha: 2026-05-12
-- Nota: Ejecutar en Supabase cuando el usuario lo apruebe

-- 1. Crear tabla plants
CREATE TABLE IF NOT EXISTS plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agregar plant_id a tablas relevantes (reemplazando branch_id para plantas)
ALTER TABLE raw_material_batches
ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id);

ALTER TABLE raw_material_inventory
ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id);

ALTER TABLE production_variance_log
ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id);

ALTER TABLE production_records
ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id);

ALTER TABLE cost_module_alerts
ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id);

ALTER TABLE product_cost_history
ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id);

-- 3. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_plants_is_active ON plants(is_active);
CREATE INDEX IF NOT EXISTS idx_raw_material_batches_plant ON raw_material_batches(plant_id);
CREATE INDEX IF NOT EXISTS idx_product_cost_history_plant ON product_cost_history(plant_id);

-- 4. Insertar plantas por defecto (opcional, el usuario puede crearlas desde el selector)
-- INSERT INTO plants (name) VALUES ('Planta 1'), ('Planta 2');
