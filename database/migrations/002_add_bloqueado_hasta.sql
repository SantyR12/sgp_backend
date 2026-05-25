-- ══════════════════════════════════════════════════════════════════════════════
-- SGP — Migración 002: Agregar columna bloqueado_hasta a usuarios
-- Ejecutar con: docker exec sgp_postgres psql -U sgp_user -d sgp_db -f /migrations/002_add_bloqueado_hasta.sql
-- O directamente: psql -U sgp_user -d sgp_db -f 002_add_bloqueado_hasta.sql
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP;

SELECT 'Columna bloqueado_hasta agregada correctamente ✅' AS resultado;
