// ══════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICOS CIE-10 — PB-23 (crear) · PB-24 (tipo) · PB-25 (estado) · PB-26 (lista problemas)
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../../../config/db');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const { validate } = require('../../../middleware/validate.middleware');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// PB-23/24/25: Registrar diagnóstico
// POST /diagnosticos
// ─────────────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('medico'),
  [
    body('historiaClinicaId').notEmpty(),
    body('pacienteId').notEmpty(),
    body('codigoCie10').trim().notEmpty().withMessage('Código CIE-10 es obligatorio'),
    body('descripcion').trim().notEmpty(),
    body('tipo').isIn(['principal','secundario','presuntivo','definitivo']),
    body('estado').optional().isIn(['activo','resuelto','cronico']),
  ],
  validate,
  async (req, res) => {
    try {
      const { historiaClinicaId, pacienteId, codigoCie10, descripcion, tipo, estado } = req.body;

      const result = await db.query(
        `INSERT INTO diagnosticos
           (id, historia_clinica_id, paciente_id, codigo_cie10, descripcion,
            tipo, estado, registrado_por, creado_en, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
         RETURNING *`,
        [
          uuidv4(), historiaClinicaId, pacienteId, codigoCie10, descripcion,
          tipo, estado || 'activo', req.user.userId,
        ]
      );

      res.status(201).json(formatDiagnostico(result.rows[0]));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PB-26: Lista de problemas activos/crónicos del paciente
// GET /diagnosticos/paciente/:pacienteId/problemas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/paciente/:pacienteId/problemas', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, u.nombre AS nombre_medico
       FROM diagnosticos d
       LEFT JOIN usuarios u ON u.id = d.registrado_por
       WHERE d.paciente_id = $1
         AND d.estado IN ('activo','cronico')
       ORDER BY d.creado_en DESC`,
      [req.params.pacienteId]
    );
    res.json(result.rows.map(formatDiagnostico));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-25: Cambiar estado del diagnóstico
// PATCH /diagnosticos/:id/estado
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/estado',
  authorize('medico'),
  [body('estado').isIn(['activo','resuelto','cronico'])],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `UPDATE diagnosticos
         SET estado=$1, actualizado_en=NOW()
         WHERE id=$2
         RETURNING *`,
        [req.body.estado, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Diagnóstico no encontrado' });
      }
      res.json(formatDiagnostico(result.rows[0]));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

function formatDiagnostico(r) {
  return {
    id: r.id,
    historiaClinicaId: r.historia_clinica_id,
    pacienteId: r.paciente_id,
    codigoCie10: r.codigo_cie10,
    descripcion: r.descripcion,
    tipo: r.tipo,
    estado: r.estado,
    registradoPor: r.nombre_medico || r.registrado_por,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
  };
}

module.exports = router;
