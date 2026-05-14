-- ============================================================
-- Migración 004: Tabla de alertas del sistema
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      UUID REFERENCES plants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,               -- 'stock_bajo', 'umbral_costo', 'merma_anormal'
  severity      TEXT NOT NULL DEFAULT 'yellow', -- 'red' | 'yellow'
  message       TEXT NOT NULL,
  related_id    UUID,                        -- ID de materia prima o producto relacionado
  related_type  TEXT,                        -- 'raw_material' | 'product'
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage alerts"
  ON alerts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_alerts_plant_unread
  ON alerts (plant_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_type
  ON alerts (type, related_id);
