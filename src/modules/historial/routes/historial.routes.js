const express = require('express');
const { body, query } = require('express-validator');
const service = require('../services/historial.service');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const { validate } = require('../../../middleware/validate.middleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// PB-09: Crear historia clínica
router.post('/',
  authorize('medico', 'admin'),
  [
    body('nombreCompleto').trim().notEmpty(),
    body('tipoDocumento').isIn(['CC', 'TI', 'CE', 'PAS']),
    body('numeroDocumento').trim().notEmpty(),
    body('fechaNacimiento').isISO8601().withMessage('Fecha inválida'),
    body('sexo').isIn(['M', 'F', 'O']),
  ],
  validate,
  async (req, res) => {
    try {
      const device = req.headers['x-device'] || 'Unknown';
      const record = await service.createRecord(req.body, req.user.userId, device);
      res.status(201).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// PB-09: Obtener historia clínica
router.get('/paciente/:pacienteId', async (req, res) => {
  try {
    const record = await service.getRecordByPatientId(req.params.pacienteId);
    res.json(record);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// PB-09: Actualizar historia clínica (solo médicos)
router.put('/:id',
  authorize('medico'),
  async (req, res) => {
    try {
      const device = req.headers['x-device'] || 'Unknown';
      const record = await service.updateRecord(
        req.params.id, req.body, req.user.userId, device
      );
      res.json(record);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// PB-09: Archivar historia
router.patch('/:id/archivar',
  authorize('medico', 'admin'),
  async (req, res) => {
    try {
      const record = await service.archiveRecord(req.params.id);
      res.json(record);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// PB-14: Buscar pacientes
router.get('/pacientes/buscar',
  [
    query('nombre').optional().isString(),
    query('documento').optional().isString(),
    query('fechaNacimiento').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const results = await service.searchPatients({
        nombre: req.query.nombre,
        documento: req.query.documento,
        fechaNacimiento: req.query.fechaNacimiento,
      });
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;