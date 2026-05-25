const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../../../middleware/auth.middleware');
const { validate } = require('../../../middleware/validate.middleware');

const router = express.Router();

// Limitar intentos de login (anti-brute-force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { message: 'Demasiados intentos. Espera 15 minutos.' },
});

// ── PB-01: Crear usuario (solo admins autenticados) ──────────────────────────
router.post('/register',
  authenticate,
  authorize('admin'),
  [
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
    body('correo').isEmail().withMessage('Correo inválido').normalizeEmail(),
    body('contrasenaTemp')
      .isLength({ min: 8 })
      .withMessage('La contraseña debe tener mínimo 8 caracteres'),
    body('rol')
      .isIn(['medico', 'enfermero', 'admin', 'farmaceutico'])
      .withMessage('Rol inválido'),
  ],
  validate,
  controller.createUser
);

// ── PB-02: Reenviar correo de verificación ───────────────────────────────────
router.post('/resend-verification',
  [body('correo').isEmail().withMessage('Correo inválido').normalizeEmail()],
  validate,
  controller.resendVerification
);

// ── PB-03: Login (responde 423 con bloqueadoHasta si la cuenta está bloqueada)
router.post('/login',
  loginLimiter,
  [
    body('correo').isEmail().withMessage('Correo inválido').normalizeEmail(),
    body('contrasena').notEmpty().withMessage('La contraseña es obligatoria'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await require('../services/auth.service').login(req.body);
      res.json(result);
    } catch (err) {
      if (err.status === 423) {
        return res.status(423).json({
          message: err.message,
          bloqueadoHasta: err.bloqueadoHasta,
        });
      }
      next(err);
    }
  }
);

// ── PB-04: Verificar OTP ─────────────────────────────────────────────────────
router.post('/verify-otp',
  [
    body('correo').isEmail().normalizeEmail(),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('El OTP debe ser de 6 dígitos numéricos'),
  ],
  validate,
  controller.verifyOtp
);

// ── PB-06: Refresh token ─────────────────────────────────────────────────────
router.post('/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token requerido')],
  validate,
  controller.refresh
);

// ── Listado de usuarios (solo admin) ─────────────────────────────────────────
router.get('/usuarios', authenticate, authorize('admin'), controller.getUsers);

// ── PB-05: Desbloquear usuario (solo admin) ───────────────────────────────────
router.patch('/usuarios/:id/desbloquear', authenticate, authorize('admin'), controller.unblockUser);

// ── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout',
  [body('refreshToken').notEmpty()],
  validate,
  controller.logout
);

// ── PB-05: Desbloquear usuario (solo admins) ─────────────────────────────────
router.patch('/usuarios/:id/desbloquear',
  authenticate,
  authorize('admin'),
  controller.unblockUser
);

module.exports = router;