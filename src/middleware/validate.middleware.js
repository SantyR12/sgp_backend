const { validationResult } = require('express-validator');

/**
 * Middleware que lee los errores de express-validator y los devuelve
 * como respuesta 422 si hay alguno.
 * Se coloca después de los validadores en las rutas.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Datos inválidos',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

module.exports = { validate };