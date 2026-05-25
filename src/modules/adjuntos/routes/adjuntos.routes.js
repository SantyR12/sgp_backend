// ══════════════════════════════════════════════════════════════════════════════
// ADJUNTOS — PB-13: Adjuntar PDFs e imágenes al expediente del paciente
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
// Multer — disco en /uploads, máx 10 MB, solo PDF/JPG/PNG
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten PDF, JPG o PNG'));
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-13: Subir archivo
// POST /adjuntos
// multipart/form-data: pacienteId (text), descripcion (text, opcional), archivo (file)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se recibió ningún archivo' });
  }

  const { pacienteId, descripcion } = req.body;

  if (!pacienteId) {
    return res.status(400).json({ message: 'pacienteId es obligatorio' });
  }

  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const urlDescarga = `${baseUrl}/uploads/${req.file.filename}`;

    const result = await db.query(
      `INSERT INTO adjuntos
         (id, paciente_id, nombre_archivo, tipo_mime, url, tamano_bytes,
          descripcion, subido_por, subido_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       RETURNING *`,
      [
        uuidv4(),
        pacienteId,
        req.file.originalname,
        req.file.mimetype,
        urlDescarga,
        req.file.size,
        descripcion || null,
        req.user.userId,
      ]
    );

    const row = result.rows[0];
    // JOIN para obtener nombre del usuario
    const userRow = await db.query(
      'SELECT nombre FROM usuarios WHERE id=$1',
      [req.user.userId]
    );
    row.subido_por_nombre = userRow.rows[0]?.nombre || null;

    res.status(201).json(formatAdjunto(row));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-13: Listar adjuntos de un paciente
// GET /adjuntos/:pacienteId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:pacienteId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.nombre AS subido_por_nombre
       FROM adjuntos a
       LEFT JOIN usuarios u ON u.id = a.subido_por
       WHERE a.paciente_id = $1
       ORDER BY a.subido_en DESC`,
      [req.params.pacienteId]
    );
    res.json(result.rows.map(formatAdjunto));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PB-13: Eliminar adjunto
// DELETE /adjuntos/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM adjuntos WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Adjunto no encontrado' });
    }
    res.json({ message: 'Adjunto eliminado' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function formatAdjunto(r) {
  return {
    id: r.id,
    pacienteId: r.paciente_id,
    nombreArchivo: r.nombre_archivo,
    tipoMime: r.tipo_mime,
    tamanoBytes: r.tamano_bytes,
    urlDescarga: r.url,
    descripcion: r.descripcion || null,
    creadoPor: r.subido_por_nombre || null,
    creadoEn: r.subido_en,
  };
}

module.exports = router;
