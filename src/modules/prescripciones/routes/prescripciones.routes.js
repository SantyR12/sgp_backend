const express = require('express');
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../../../config/db');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const { validate } = require('../../../middleware/validate.middleware');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// PB-15 criterio 2: Verificar duplicidad
// ─────────────────────────────────────────────────────────────────────────────

router.get('/duplicidad', async (req, res) => {
  try {
    const { pacienteId, medicamentoId } = req.query;

    const result = await db.query(
      `SELECT p.id, m.nombre_generico
       FROM prescripciones p
       JOIN medicamentos m ON m.id = p.medicamento_id
       WHERE p.paciente_id=$1 AND p.medicamento_id=$2 AND p.estado='activa'
       LIMIT 1`,
      [pacienteId, medicamentoId]
    );

    if (result.rows.length > 0) {
      return res.json({
        hasDuplicity: true,
        existingPrescriptionId: result.rows[0].id,
        medicamentoNombre: result.rows[0].nombre_generico,
      });
    }

    res.json({ hasDuplicity: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-15: Crear prescripción digital
// ─────────────────────────────────────────────────────────────────────────────

router.post('/',
  authorize('medico'),
  [
    body('pacienteId').notEmpty(),
    body('medicamentoId').notEmpty(),
    body('medicamentoNombre').trim().notEmpty(),
    body('dosis').isFloat({ gt: 0 }).withMessage('Dosis inválida'),
    body('dosisUnidad').isIn(['mg', 'ml', 'mcg', 'unidades']),
    body('frecuenciaHoras').isInt({ gt: 0 }),
    body('viaAdministracion').isIn(['oral', 'IV', 'IM', 'subcutanea', 'topica']),
    body('duracionDias').isInt({ gt: 0 }),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        pacienteId, medicamentoId, medicamentoNombre, dosis,
        dosisUnidad, frecuenciaHoras, viaAdministracion,
        duracionDias, indicacionesEspeciales,
      } = req.body;

      // Obtener datos del médico para la firma digital (PB-15 criterio 5)
      const medico = await db.query(
        'SELECT nombre FROM usuarios WHERE id=$1',
        [req.user.userId]
      );
      const medicoNombre = medico.rows[0]?.nombre || 'Médico';

      // Firma digital: hash SHA256 de los datos principales
      const firmaData = `${req.user.userId}|${pacienteId}|${medicamentoId}|${dosis}${dosisUnidad}|${new Date().toISOString()}`;
      const firmaDigital = crypto
        .createHash('sha256')
        .update(firmaData)
        .digest('hex');

      const result = await db.query(
        `INSERT INTO prescripciones
           (id, paciente_id, medico_id, medico_nombre, medicamento_id,
            medicamento_nombre, dosis, dosis_unidad, frecuencia_horas,
            via_administracion, duracion_dias, indicaciones_especiales,
            estado, fecha_prescripcion, firma_digital)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'activa',NOW(),$13)
         RETURNING *`,
        [
          uuidv4(), pacienteId, req.user.userId, medicoNombre,
          medicamentoId, medicamentoNombre, dosis, dosisUnidad,
          frecuenciaHoras, viaAdministracion, duracionDias,
          indicacionesEspeciales || null, firmaDigital,
        ]
      );

      res.status(201).json(formatPrescripcion(result.rows[0]));
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// Listar prescripciones activas de un paciente
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const { estado } = req.query;
    const params = [req.params.pacienteId];
    let filter = '';
    if (estado) {
      params.push(estado);
      filter = `AND estado=$${params.length}`;
    }

    const result = await db.query(
      `SELECT * FROM prescripciones WHERE paciente_id=$1 ${filter} ORDER BY fecha_prescripcion DESC`,
      params
    );
    res.json(result.rows.map(formatPrescripcion));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancelar prescripción
router.patch('/:id/cancelar',
  authorize('medico'),
  async (req, res) => {
    try {
      const result = await db.query(
        `UPDATE prescripciones SET estado='cancelada' WHERE id=$1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Prescripción no encontrada' });
      }
      res.json(formatPrescripcion(result.rows[0]));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

function formatPrescripcion(r) {
  return {
    id: r.id,
    pacienteId: r.paciente_id,
    medicoId: r.medico_id,
    medicoNombre: r.medico_nombre,
    medicamentoId: r.medicamento_id,
    medicamentoNombre: r.medicamento_nombre,
    dosis: parseFloat(r.dosis),
    dosisUnidad: r.dosis_unidad,
    frecuenciaHoras: r.frecuencia_horas,
    viaAdministracion: r.via_administracion,
    duracionDias: r.duracion_dias,
    indicacionesEspeciales: r.indicaciones_especiales,
    estado: r.estado,
    fechaPrescripcion: r.fecha_prescripcion,
    firmaDigital: r.firma_digital,
  };
}

module.exports = router;