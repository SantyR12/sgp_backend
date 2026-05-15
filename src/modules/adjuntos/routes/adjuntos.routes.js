// ══════════════════════════════════════════════════════════════════════════════
// ADJUNTOS — PB-13: Adjuntar PDFs e imágenes a la historia clínica
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../../../config/db');
const { authenticate } = require('../../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de multer — almacena en disco en /uploads
// ─────────────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB máximo
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten PDF, JPG, PNG o WEBP'));
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-13: Subir archivo
// POST /adjuntos  (multipart/form-data)
// Campos: historiaClinicaId, tipo ('pdf'|'imagen'), archivo (file)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se recibió ningún archivo' });
  }

  const { historiaClinicaId, tipo } = req.body;

  if (!historiaClinicaId) {
    return res.status(400).json({ message: 'historiaClinicaId es obligatorio' });
  }

  if (!['pdf', 'imagen'].includes(tipo)) {
    return res.status(400).json({ message: 'tipo debe ser "pdf" o "imagen"' });
  }

  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;

    const result = await db.query(
      `INSERT INTO adjuntos
         (id, historia_clinica_id, nombre_archivo, tipo, url, tamano_bytes, subido_por, subido_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       RETURNING *`,
      [
        uuidv4(),
        historiaClinicaId,
        req.file.originalname,
        tipo,
        url,
        req.file.size,
        req.user.userId,
      ]
    );

    res.status(201).json(formatAdjunto(result.rows[0]));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-13: Listar adjuntos de una historia clínica
// GET /adjuntos/historia/:historiaClinicaId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/historia/:historiaClinicaId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM adjuntos WHERE historia_clinica_id=$1 ORDER BY subido_en DESC',
      [req.params.historiaClinicaId]
    );
    res.json(result.rows.map(formatAdjunto));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function formatAdjunto(r) {
  return {
    id: r.id,
    historiaClinicaId: r.historia_clinica_id,
    nombreArchivo: r.nombre_archivo,
    tipo: r.tipo,
    url: r.url,
    tamanoBytes: r.tamano_bytes,
    subidoPor: r.subido_por,
    subidoEn: r.subido_en,
  };
}

module.exports = router;
