const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware de autenticación — verifica que el JWT sea válido.
 * Agrega req.user con los datos del payload del token.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  console.log(`[AUTH] ${req.method} ${req.path} — header: ${authHeader ? authHeader.substring(0, 30) + '...' : 'AUSENTE'}`);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, email, rol, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    return res.status(401).json({ message: 'Token inválido' });
  }
}

/**
 * Middleware de autorización por rol.
 * Uso: authorize('medico', 'admin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        message: 'No tienes permiso para realizar esta acción',
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };