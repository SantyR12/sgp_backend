require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes          = require('./modules/auth/routes/auth.routes');
const historialRoutes     = require('./modules/historial/routes/historial.routes');
const alergiasRoutes      = require('./modules/alergias/routes/alergias.routes');
const prescripcionesRoutes = require('./modules/prescripciones/routes/prescripciones.routes');
const medicamentosRoutes  = require('./modules/medicamentos/routes/medicamentos.routes');

const app = express();

// ─── Middlewares globales ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Log de requests en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Rutas ────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/historial',      historialRoutes);
app.use('/api/pacientes',      historialRoutes); // alias para búsqueda
app.use('/api/alergias',       alergiasRoutes);
app.use('/api/prescripciones', prescripcionesRoutes);
app.use('/api/medicamentos',   medicamentosRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// Error global
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// ─── Arrancar ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  SGP Backend corriendo en http://localhost:${PORT}/api`);
  console.log(`📋  Modo: ${process.env.NODE_ENV}`);
});