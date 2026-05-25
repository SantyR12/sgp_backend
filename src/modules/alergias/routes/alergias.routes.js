// ══════════════════════════════════════════════════════════════════════════════
// ALERGIAS SERVICE + ROUTES — PB-20
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
// PB-20: Crear alergia
// ─────────────────────────────────────────────────────────────────────────────

router.post('/',
  authorize('medico', 'enfermero'),
  [
    body('pacienteId').notEmpty(),
    body('agenteCausante').trim().notEmpty().withMessage('El agente causante es obligatorio'),
    body('tipoReaccion')
      .isIn(['anafilaxia', 'urticaria', 'angioedema', 'intolerancia', 'otra']),
    body('severidad')
      .isIn(['leve', 'moderada', 'grave', 'mortal']),
  ],
  validate,
  async (req, res) => {
    try {
      const { pacienteId, agenteCausante, tipoReaccion, severidad,
              fechaDiagnostico, observaciones } = req.body;

      const result = await db.query(
        `INSERT INTO alergias
           (id, paciente_id, agente_causante, tipo_reaccion, severidad,
            estado, fecha_diagnostico, observaciones, creado_por, creado_en)
         VALUES ($1,$2,$3,$4,$5,'activa',$6,$7,$8,NOW())
         RETURNING *`,
        [uuidv4(), pacienteId, agenteCausante, tipoReaccion, severidad,
         fechaDiagnostico || null, observaciones || null, req.user.userId]
      );

      res.status(201).json(formatAlergia(result.rows[0]));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// Listar alergias de un paciente
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.nombre AS creado_por_nombre
       FROM alergias a
       LEFT JOIN usuarios u ON u.id = a.creado_por
       WHERE a.paciente_id = $1
       ORDER BY a.creado_en DESC`,
      [req.params.pacienteId]
    );
    res.json(result.rows.map(formatAlergia));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PB-20 criterio 3: Cambiar estado (solo médicos)
router.patch('/:id/estado',
  authorize('medico'),
  [body('estado').isIn(['activa', 'inactiva'])],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `UPDATE alergias SET estado=$1 WHERE id=$2 RETURNING *`,
        [req.body.estado, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Alergia no encontrada' });
      }
      res.json(formatAlergia(result.rows[0]));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PB-20 criterio 3 / PB-15 criterio 3: Verificar alerta de alergia
router.get('/alerta', async (req, res) => {
  try {
    const { pacienteId, medicamentoId } = req.query;

    // Buscar el nombre del medicamento
    const med = await db.query(
      'SELECT nombre_generico, nombre_comercial FROM medicamentos WHERE id=$1',
      [medicamentoId]
    );
    const medNombre = med.rows[0]?.nombre_generico || '';
    const medComercial = med.rows[0]?.nombre_comercial || '';

    // Buscar alergia activa que coincida con el nombre del medicamento
    const result = await db.query(
      `SELECT * FROM alergias
       WHERE paciente_id=$1
         AND estado='activa'
         AND (
           LOWER(agente_causante) LIKE LOWER($2)
           OR LOWER(agente_causante) LIKE LOWER($3)
         )
       LIMIT 1`,
      [pacienteId, `%${medNombre}%`, `%${medComercial}%`]
    );

    if (result.rows.length > 0) {
      const alg = result.rows[0];
      return res.json({
        hasAllergy: true,
        allergyId: alg.id,
        agenteCausante: alg.agente_causante,
        severidad: alg.severidad,
      });
    }

    res.json({ hasAllergy: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function formatAlergia(r) {
  return {
    id: r.id,
    pacienteId: r.paciente_id,
    agenteCausante: r.agente_causante,
    tipoReaccion: r.tipo_reaccion,
    severidad: r.severidad,
    estado: r.estado,
    fechaDiagnostico: r.fecha_diagnostico,
    observaciones: r.observaciones,
    creadoEn: r.creado_en,
    creadoPor: r.creado_por_nombre || r.creado_por,
  };
}

module.exports = router;