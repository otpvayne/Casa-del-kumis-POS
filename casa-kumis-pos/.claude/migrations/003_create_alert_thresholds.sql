-- ============================================================
-- Migración 003: Tabla de umbrales de alertas personalizadas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS material_alert_thresholds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  state_id      UUID REFERENCES raw_material_states(id) ON DELETE SET NULL,
  min_stock     NUMERIC DEFAULT NULL,        -- alerta si stock < este valor
  max_cost_per_unit NUMERIC DEFAULT NULL,   -- alerta si costo/unidad > este valor
  max_waste_pct NUMERIC DEFAULT NULL,       -- alerta si merma% > este valor (0-100)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (plant_id, raw_material_id, state_id)
);

-- RLS
ALTER TABLE material_alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage thresholds"
  ON material_alert_thresholds
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índice para búsquedas rápidas por planta
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_plant
  ON material_alert_thresholds (plant_id, is_active);
