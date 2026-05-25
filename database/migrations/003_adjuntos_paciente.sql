-- ══════════════════════════════════════════════════════════════════════════════
-- SGP — Migración 003: Adjuntos por paciente (PB-13)
-- Ejecutar: docker exec -i sgp_postgres psql -U sgp_user -d sgp_db < database/migrations/003_adjuntos_paciente.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- Hacer historia_clinica_id nullable (ahora usamos paciente_id directamente)
ALTER TABLE adjuntos
  ALTER COLUMN historia_clinica_id DROP NOT NULL;

-- Agregar columnas que necesita el frontend
ALTER TABLE adjuntos
  ADD COLUMN IF NOT EXISTS paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS descripcion  VARCHAR(150),
  ADD COLUMN IF NOT EXISTS tipo_mime    VARCHAR(100);

-- Índice por paciente para queries rápidas
CREATE INDEX IF NOT EXISTS idx_adjuntos_paciente ON adjuntos (paciente_id);

-- 'tipo' ya no es necesario (se usa tipo_mime)
ALTER TABLE adjuntos ALTER COLUMN tipo DROP NOT NULL;
