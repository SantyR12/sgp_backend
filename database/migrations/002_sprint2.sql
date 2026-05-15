-- ══════════════════════════════════════════════════════════════════════════════
-- SGP — Migración 002: Sprint 2
-- Ejecutar: psql -U sgp_user -d sgp_db -f 002_sprint2.sql
-- O dentro de Docker: docker exec -i sgp_postgres psql -U sgp_user -d sgp_db < database/migrations/002_sprint2.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-05: Bloqueo de cuenta tras 5 intentos fallidos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usuarios_bloqueado_hasta
  ON usuarios (bloqueado_hasta)
  WHERE bloqueado_hasta IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-18: Peso y talla del paciente para validación de dosis
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS peso_kg  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS talla_cm NUMERIC(5,2);

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-11 / PB-12: Notas de evolución en formato SOAP
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notas_soap (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  historia_clinica_id UUID        NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  paciente_id         UUID        NOT NULL REFERENCES pacientes(id),
  subjetivo           TEXT        NOT NULL,
  objetivo            TEXT        NOT NULL,
  analisis            TEXT        NOT NULL,
  plan                TEXT        NOT NULL,
  creado_por          UUID        REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_soap_paciente ON notas_soap (paciente_id);
CREATE INDEX IF NOT EXISTS idx_notas_soap_historia ON notas_soap (historia_clinica_id);
CREATE INDEX IF NOT EXISTS idx_notas_soap_fecha    ON notas_soap (creado_en DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-13: Adjuntos a la historia clínica
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adjuntos (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  historia_clinica_id UUID        NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  nombre_archivo      VARCHAR(255) NOT NULL,
  tipo                VARCHAR(10)  NOT NULL CHECK (tipo IN ('pdf', 'imagen')),
  url                 TEXT         NOT NULL,
  tamano_bytes        INTEGER,
  subido_por          UUID         REFERENCES usuarios(id),
  subido_en           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjuntos_historia ON adjuntos (historia_clinica_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-23 / PB-24 / PB-25: Diagnósticos CIE-10
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnosticos (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  historia_clinica_id UUID        NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  paciente_id         UUID        NOT NULL REFERENCES pacientes(id),
  codigo_cie10        VARCHAR(10) NOT NULL,
  descripcion         TEXT        NOT NULL,
  tipo                VARCHAR(20) NOT NULL DEFAULT 'presuntivo'
                        CHECK (tipo IN ('principal','secundario','presuntivo','definitivo')),
  estado              VARCHAR(20) NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo','resuelto','cronico')),
  registrado_por      UUID        REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_historia ON diagnosticos (historia_clinica_id);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_paciente ON diagnosticos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_estado   ON diagnosticos (estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-23: Catálogo CIE-10 mínimo para búsqueda
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_cie10 (
  codigo      VARCHAR(10) PRIMARY KEY,
  descripcion TEXT        NOT NULL,
  capitulo    VARCHAR(5),
  categoria   VARCHAR(150)
);

INSERT INTO catalogo_cie10 (codigo, descripcion, capitulo, categoria) VALUES
  ('E11',   'Diabetes mellitus tipo 2',                      'IV',   'Enfermedades endocrinas'),
  ('E11.9', 'Diabetes mellitus tipo 2 sin complicaciones',   'IV',   'Enfermedades endocrinas'),
  ('E78.0', 'Hipercolesterolemia pura',                      'IV',   'Enfermedades endocrinas'),
  ('I10',   'Hipertensión esencial (primaria)',               'IX',   'Enfermedades cardiovasculares'),
  ('I21.9', 'Infarto agudo de miocardio no especificado',    'IX',   'Enfermedades cardiovasculares'),
  ('I50.0', 'Insuficiencia cardíaca congestiva',             'IX',   'Enfermedades cardiovasculares'),
  ('J00',   'Rinofaringitis aguda (resfriado común)',         'X',    'Enfermedades respiratorias'),
  ('J06.9', 'Infección aguda vías respiratorias superiores', 'X',    'Enfermedades respiratorias'),
  ('J18.9', 'Neumonía no especificada',                      'X',    'Enfermedades respiratorias'),
  ('J45.0', 'Asma predominantemente alérgica',               'X',    'Enfermedades respiratorias'),
  ('J45.9', 'Asma no especificada',                          'X',    'Enfermedades respiratorias'),
  ('K21.0', 'Reflujo gastroesofágico con esofagitis',        'XI',   'Enfermedades digestivas'),
  ('K29.7', 'Gastritis no especificada',                     'XI',   'Enfermedades digestivas'),
  ('M54.5', 'Lumbago no especificado',                       'XIII', 'Músculo-esqueléticas'),
  ('N39.0', 'Infección de las vías urinarias',               'XIV',  'Genitourinarias'),
  ('R05',   'Tos',                                            'XVIII','Síntomas generales'),
  ('R50.9', 'Fiebre no especificada',                        'XVIII','Síntomas generales'),
  ('R51',   'Cefalea',                                        'XVIII','Síntomas generales'),
  ('Z00.0', 'Examen médico general',                         'XXI',  'Factores de salud'),
  ('Z30',   'Anticoncepción',                                 'XXI',  'Factores de salud')
ON CONFLICT (codigo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-16 / PB-17 / PB-21: Columnas adicionales en prescripciones para Sprint 2
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE prescripciones
  ADD COLUMN IF NOT EXISTS historia_clinica_id      UUID REFERENCES historias_clinicas(id),
  ADD COLUMN IF NOT EXISTS frecuencia               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS via_v2                   VARCHAR(30),
  ADD COLUMN IF NOT EXISTS dosis_texto              VARCHAR(50),
  ADD COLUMN IF NOT EXISTS alerta_alergia_ignorada  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_alergia_motivo    TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- PB-19: MAR — Medication Administration Record
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mar_entradas (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescripcion_id     UUID        NOT NULL REFERENCES prescripciones(id) ON DELETE CASCADE,
  paciente_id         UUID        NOT NULL REFERENCES pacientes(id),
  hora_programada     TIMESTAMPTZ NOT NULL,
  hora_real           TIMESTAMPTZ,
  administrado_por    UUID        REFERENCES usuarios(id),
  resultado           VARCHAR(30) NOT NULL DEFAULT 'administrado'
                        CHECK (resultado IN ('administrado','omitido','rechazado_paciente','contraindicado')),
  dosis_administrada  VARCHAR(50),
  via_administrada    VARCHAR(30),
  observaciones       TEXT,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_prescripcion ON mar_entradas (prescripcion_id);
CREATE INDEX IF NOT EXISTS idx_mar_paciente     ON mar_entradas (paciente_id);
CREATE INDEX IF NOT EXISTS idx_mar_pendientes
  ON mar_entradas (paciente_id, hora_programada)
  WHERE hora_real IS NULL;

SELECT 'Migración Sprint 2 aplicada correctamente ✅' AS resultado;
