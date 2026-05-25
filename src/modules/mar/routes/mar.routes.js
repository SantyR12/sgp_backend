// ══════════════════════════════════════════════════════════════════════════════
// MAR — Medication Administration Record — PB-19
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
// PB-19: Listar entradas MAR de un paciente
// GET /mar/paciente/:pacienteId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         m.*,
         p.medicamento_nombre  AS nombre_medicamento,
         p.dosis_texto         AS dosis_prescrita,
         u.nombre              AS nombre_enfermero
       FROM mar_entradas m
       JOIN prescripciones p ON p.id = m.prescripcion_id
       LEFT JOIN usuarios u ON u.id = m.administrado_por
       WHERE m.paciente_id = $1
       ORDER BY m.hora_programada DESC
       LIMIT 100`,
      [req.params.pacienteId]
    );
    res.json(result.rows.map(formatMar));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-19: Registrar administración
// POST /mar
// ─────────────────────────────────────────────────────────────────────────────
router.post('/',
  authorize('medico', 'enfermero'),
  [
    body('prescripcionId').notEmpty(),
    body('horaReal').isISO8601().withMessage('Fecha/hora inválida'),
    body('resultado').isIn(['administrado','omitido','rechazado_paciente','contraindicado']),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        prescripcionId, horaReal, resultado,
        dosisAdministrada, viaAdministrada, observaciones,
      } = req.body;

      // Obtener paciente_id y hora_programada de la prescripción
      const presc = await db.query(
        'SELECT paciente_id FROM prescripciones WHERE id=$1',
        [prescripcionId]
      );
      if (presc.rows.length === 0) {
        return res.status(404).json({ message: 'Prescripción no encontrada' });
      }

      const result = await db.query(
        `INSERT INTO mar_entradas
           (id, prescripcion_id, paciente_id, hora_programada, hora_real,
            administrado_por, resultado, dosis_administrada, via_administrada,
            observaciones, creado_en)
         VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,NOW())
         RETURNING *`,
        [
          uuidv4(), prescripcionId, presc.rows[0].paciente_id,
          horaReal, req.user.userId, resultado,
          dosisAdministrada || null, viaAdministrada || null,
          observaciones || null,
        ]
      );

      res.status(201).json(formatMar(result.rows[0]));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

function formatMar(r) {
  return {
    id: r.id,
    prescripcionId: r.prescripcion_id,
    pacienteId: r.paciente_id,
    horaProgramada: r.hora_programada,
    horaReal: r.hora_real,
    administradoPor: r.nombre_enfermero || r.administrado_por,
    resultado: r.resultado,
    dosisAdministrada: r.dosis_administrada,
    viaAdministrada: r.via_administrada,
    observaciones: r.observaciones,
    creadoEn: r.creado_en,
    nombreMedicamento: r.nombre_medicamento || null,
    dosisPrescrita: r.dosis_prescrita || null,
  };
}

module.exports = router;
