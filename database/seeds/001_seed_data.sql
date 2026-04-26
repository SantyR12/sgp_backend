-- ══════════════════════════════════════════════════════════════════════════════
-- SGP — Seed 001: Datos iniciales para desarrollo
-- Ejecutar DESPUÉS de las migraciones:
-- psql -U postgres -d sgp_db -f 001_seed_data.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- ADMIN inicial (para poder crear los demás usuarios desde la app)
-- Contraseña: Admin123  (hash generado con bcrypt 12 rondas)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO usuarios (id, nombre, correo, contrasena_hash, rol, estado)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Administrador Sistema',
  'admin@sgp.com',
  '$2a$12$LQv3c1yqBwEHFQWkADqHt.sMtSoF1OcPvEE4UNRHhHjVTZYnrmQqK',
  'admin',
  'activo'
)
ON CONFLICT (correo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- MÉDICO de prueba
-- Contraseña: Medico123
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO usuarios (id, nombre, correo, contrasena_hash, rol, estado)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'Dr. Juan López',
  'medico@sgp.com',
  '$2a$12$mH3QBW3IjUwDwnRhh3jB7OsFwXvqtBvJOHW6VZlJfBb0Z82IvF0Cq',
  'medico',
  'activo'
)
ON CONFLICT (correo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- ENFERMERO de prueba
-- Contraseña: Enfer123
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO usuarios (id, nombre, correo, contrasena_hash, rol, estado)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'Enf. María Torres',
  'enfermera@sgp.com',
  '$2a$12$j9l.H3LvY3e5XJFxW.9oV.lqJJWN7H4XH2hT3ULzn7V9JQf4FZbOi',
  'enfermero',
  'activo'
)
ON CONFLICT (correo) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- MEDICAMENTOS — catálogo inicial (15 medicamentos para autocompletado)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO medicamentos (nombre_generico, nombre_comercial, categoria) VALUES
  ('Penicilina G',     'Pencid',      'Antibiótico'),
  ('Amoxicilina',      'Amoxil',      'Antibiótico'),
  ('Ibuprofeno',       'Advil',       'Antiinflamatorio'),
  ('Acetaminofén',     'Tylenol',     'Analgésico'),
  ('Metformina',       'Glucophage',  'Antidiabético'),
  ('Atorvastatina',    'Lipitor',     'Estatina'),
  ('Losartán',         'Cozaar',      'Antihipertensivo'),
  ('Omeprazol',        'Prilosec',    'Antiácido'),
  ('Azitromicina',     'Zithromax',   'Antibiótico'),
  ('Ciprofloxacina',   'Cipro',       'Antibiótico'),
  ('Diazepam',         'Valium',      'Ansiolítico'),
  ('Metronidazol',     'Flagyl',      'Antibiótico'),
  ('Ranitidina',        NULL,          'Antiácido'),
  ('Salbutamol',       'Ventolin',    'Broncodilatador'),
  ('Prednisona',       'Deltasone',   'Corticosteroide')
ON CONFLICT DO NOTHING;

SELECT 'Datos iniciales insertados correctamente ✅' AS resultado;