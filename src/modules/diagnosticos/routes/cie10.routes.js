// ══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO CIE-10 — Búsqueda para autocompletado en formulario diagnósticos
// ══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const db = require('../../../config/db');
const { authenticate } = require('../../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// GET /cie10/buscar?q=diabetes
router.get('/buscar', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json([]);
    }

    const result = await db.query(
      `SELECT codigo, descripcion
       FROM catalogo_cie10
       WHERE LOWER(descripcion) LIKE LOWER($1)
          OR LOWER(codigo)      LIKE LOWER($1)
       ORDER BY codigo
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json(result.rows.map((r) => ({
      codigo: r.codigo,
      descripcion: r.descripcion,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
