// ══════════════════════════════════════════════════════════════════════════════
// NOTAS SOAP — PB-11 (crear) · PB-12 (historial consultas)
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../../../config/db');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const { validate } = require('../../../middleware/validate.middleware');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// PB-11: Registrar nota SOAP
// POST /notas-soap
// ─────────────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('medico', 'enfermero'),
  [
    body('historiaClinicaId').notEmpty().withMessage('historiaClinicaId es obligatorio'),
    body('pacienteId').notEmpty().withMessage('pacienteId es obligatorio'),
    body('subjetivo').trim().notEmpty().withMessage('Subjetivo es obligatorio'),
    body('objetivo').trim().notEmpty().withMessage('Objetivo es obligatorio'),
    body('analisis').trim().notEmpty().withMessage('Análisis es obligatorio'),
    body('plan').trim().notEmpty().withMessage('Plan es obligatorio'),
  ],
  validate,
  async (req, res) => {
    try {
      const { historiaClinicaId, pacienteId, subjetivo, objetivo, analisis, plan } = req.body;

      const result = await db.query(
        `INSERT INTO notas_soap
           (id, historia_clinica_id, paciente_id, subjetivo, objetivo, analisis, plan, creado_por, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         RETURNING *`,
        [uuidv4(), historiaClinicaId, pacienteId, subjetivo, objetivo, analisis, plan, req.user.userId]
      );

      res.status(201).json(formatNota(result.rows[0]));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PB-12: Listar notas SOAP de un paciente (historial de consultas)
// GET /notas-soap/paciente/:pacienteId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT n.*, u.nombre AS nombre_medico
       FROM notas_soap n
       LEFT JOIN usuarios u ON u.id = n.creado_por
       WHERE n.paciente_id = $1
       ORDER BY n.creado_en DESC`,
      [req.params.pacienteId]
    );
    res.json(result.rows.map(formatNota));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function formatNota(r) {
  return {
    id: r.id,
    historiaClinicaId: r.historia_clinica_id,
    pacienteId: r.paciente_id,
    subjetivo: r.subjetivo,
    objetivo: r.objetivo,
    analisis: r.analisis,
    plan: r.plan,
    creadoPor: r.nombre_medico || r.creado_por,
    creadoEn: r.creado_en,
  };
}

module.exports = router;
