-- ══════════════════════════════════════════════════════════════════════════════
-- SGP — Migración 001: Crear todas las tablas del Sprint 1
-- Ejecutar con: psql -U postgres -d sgp_db -f 001_create_tables.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- USUARIOS — PB-01, PB-02, PB-03, PB-04, PB-06
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre                      VARCHAR(200) NOT NULL,
  correo                      VARCHAR(200) UNIQUE NOT NULL,
  contrasena_hash             VARCHAR(255) NOT NULL,
  rol                         VARCHAR(20) NOT NULL CHECK (rol IN ('medico','enfermero','admin','farmaceutico')),
  estado                      VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','activo','bloqueado')),
  -- Verificación de correo (PB-02)
  verification_token          VARCHAR(255),
  verification_token_expiry   TIMESTAMP,
  -- MFA OTP (PB-04)
  otp_code                    VARCHAR(6),
  otp_expiry                  TIMESTAMP,
  otp_intentos                INTEGER DEFAULT 0,
  -- Seguridad (PB-05 Sprint 2)
  intentos_fallidos           INTEGER DEFAULT 0,
  -- Auditoría
  creado_por                  UUID REFERENCES usuarios(id),
  creado_en                   TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- REFRESH TOKENS — PB-06
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expiry      TIMESTAMP NOT NULL,
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PACIENTES — PB-10
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pacientes (
  id                             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_completo                VARCHAR(200) NOT NULL,
  tipo_documento                 VARCHAR(5) NOT NULL CHECK (tipo_documento IN ('CC','TI','CE','PAS')),
  numero_documento               VARCHAR(20) NOT NULL,
  fecha_nacimiento               DATE NOT NULL,
  sexo                           CHAR(1) NOT NULL CHECK (sexo IN ('M','F','O')),
  direccion                      VARCHAR(300),
  telefono                       VARCHAR(20),
  correo                         VARCHAR(200),
  contacto_emergencia_nombre     VARCHAR(200),
  contacto_emergencia_telefono   VARCHAR(20),
  creado_en                      TIMESTAMP DEFAULT NOW(),
  -- Número de documento único por tipo (PB-10 criterio 5)
  UNIQUE (tipo_documento, numero_documento)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- HISTORIAS CLÍNICAS — PB-09
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historias_clinicas (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id             UUID NOT NULL REFERENCES pacientes(id),
  estado                  VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','archivada')),
  -- Log de auditoría (PB-09 criterio 2)
  ultimo_editado_por      UUID REFERENCES usuarios(id),
  ultimo_editado_desde    VARCHAR(100),
  ultima_edicion_en       TIMESTAMP,
  creado_en               TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MEDICAMENTOS — catálogo para autocompletado (PB-20 criterio 4, PB-15)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicamentos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_generico  VARCHAR(200) NOT NULL,
  nombre_comercial VARCHAR(200),
  categoria        VARCHAR(100),
  creado_en        TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ALERGIAS — PB-20
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alergias (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id       UUID NOT NULL REFERENCES pacientes(id),
  agente_causante   VARCHAR(200) NOT NULL,
  tipo_reaccion     VARCHAR(30) NOT NULL CHECK (tipo_reaccion IN ('anafilaxia','urticaria','angioedema','intolerancia','otra')),
  severidad         VARCHAR(20) NOT NULL CHECK (severidad IN ('leve','moderada','grave','mortal')),
  estado            VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','inactiva')),
  fecha_diagnostico DATE,
  observaciones     TEXT,
  creado_por        UUID REFERENCES usuarios(id),
  creado_en         TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PRESCRIPCIONES — PB-15
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescripciones (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id             UUID NOT NULL REFERENCES pacientes(id),
  medico_id               UUID NOT NULL REFERENCES usuarios(id),
  medico_nombre           VARCHAR(200) NOT NULL,
  medicamento_id          UUID REFERENCES medicamentos(id),
  medicamento_nombre      VARCHAR(200) NOT NULL,
  dosis                   DECIMAL(10,2) NOT NULL CHECK (dosis > 0),
  dosis_unidad            VARCHAR(20) NOT NULL CHECK (dosis_unidad IN ('mg','ml','mcg','unidades')),
  frecuencia_horas        INTEGER NOT NULL CHECK (frecuencia_horas > 0),
  via_administracion      VARCHAR(20) NOT NULL CHECK (via_administracion IN ('oral','IV','IM','subcutanea','topica')),
  duracion_dias           INTEGER NOT NULL CHECK (duracion_dias > 0),
  indicaciones_especiales TEXT,
  estado                  VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','completada','cancelada')),
  fecha_prescripcion      TIMESTAMP DEFAULT NOW(),
  -- Firma digital (PB-15 criterio 5)
  firma_digital           VARCHAR(255),
  matricula_medico        VARCHAR(50)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- LOG DE AUDITORÍA — PB-01 criterio 5
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accion      VARCHAR(100) NOT NULL,
  tabla       VARCHAR(100) NOT NULL,
  registro_id UUID,
  usuario_id  UUID REFERENCES usuarios(id),
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ÍNDICES para mejorar rendimiento de búsquedas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre     ON pacientes (LOWER(nombre_completo));
CREATE INDEX IF NOT EXISTS idx_pacientes_documento  ON pacientes (tipo_documento, numero_documento);
CREATE INDEX IF NOT EXISTS idx_alergias_paciente    ON alergias (paciente_id);
CREATE INDEX IF NOT EXISTS idx_prescripciones_pac   ON prescripciones (paciente_id, estado);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens       ON refresh_tokens (token);
CREATE INDEX IF NOT EXISTS idx_medicamentos_nombre  ON medicamentos (LOWER(nombre_generico));

SELECT 'Tablas creadas correctamente ✅' AS resultado;