require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes           = require('./modules/auth/routes/auth.routes');
const historialRoutes      = require('./modules/historial/routes/historial.routes');
const alergiasRoutes       = require('./modules/alergias/routes/alergias.routes');
const prescripcionesRoutes = require('./modules/prescripciones/routes/prescripciones.routes');
const medicamentosRoutes   = require('./modules/medicamentos/routes/medicamentos.routes');
// Sprint 2
const notasSoapRoutes      = require('./modules/notas-soap/routes/notas-soap.routes');
const adjuntosRoutes       = require('./modules/adjuntos/routes/adjuntos.routes');
const diagnosticosRoutes   = require('./modules/diagnosticos/routes/diagnosticos.routes');
const cie10Routes          = require('./modules/diagnosticos/routes/cie10.routes');
const marRoutes            = require('./modules/mar/routes/mar.routes');

const app = express();

// ─── Middlewares globales ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Archivos subidos (adjuntos PB-13)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
// Sprint 2
app.use('/api/notas-soap',     notasSoapRoutes);
app.use('/api/adjuntos',       adjuntosRoutes);
app.use('/api/diagnosticos',   diagnosticosRoutes);
app.use('/api/cie10',          cie10Routes);
app.use('/api/mar',            marRoutes);

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