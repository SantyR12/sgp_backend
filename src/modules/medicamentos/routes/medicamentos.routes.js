const express = require('express');
const db = require('../../../config/db');
const { authenticate } = require('../../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// Búsqueda de medicamentos para autocompletado (PB-20 criterio 4 / PB-15)
router.get('/buscar', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const result = await db.query(
      `SELECT id, nombre_generico, nombre_comercial, categoria
       FROM medicamentos
       WHERE LOWER(nombre_generico) LIKE LOWER($1)
          OR LOWER(nombre_comercial) LIKE LOWER($1)
       ORDER BY nombre_generico
       LIMIT 15`,
      [`%${q}%`]
    );

    res.json(result.rows.map((r) => ({
      id: r.id,
      nombreGenerico: r.nombre_generico,
      nombreComercial: r.nombre_comercial,
      categoria: r.categoria,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;