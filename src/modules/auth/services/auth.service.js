const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../../config/db');
const { sendVerificationEmail, sendOtpEmail } = require('../../../config/email');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers JWT
// ─────────────────────────────────────────────────────────────────────────────

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN, // 1h
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN, // 7d
  });
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-01: Crear usuario (solo admins)
// ─────────────────────────────────────────────────────────────────────────────

async function createUser({ nombre, correo, contrasenaTemp, rol }, creadorId) {
  // Verificar que el correo no exista (PB-01 criterio 4)
  const existe = await db.query(
    'SELECT id FROM usuarios WHERE correo = $1',
    [correo.toLowerCase()]
  );
  if (existe.rows.length > 0) {
    const err = new Error('Ya existe un usuario con ese correo');
    err.status = 409;
    throw err;
  }

  const hash = await bcrypt.hash(contrasenaTemp, 12);
  const verificationToken = uuidv4();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const result = await db.query(
    `INSERT INTO usuarios
       (id, nombre, correo, contrasena_hash, rol, estado, verification_token, verification_token_expiry, creado_por)
     VALUES ($1,$2,$3,$4,$5,'pendiente',$6,$7,$8)
     RETURNING id, nombre, correo, rol, estado, creado_en`,
    [uuidv4(), nombre, correo.toLowerCase(), hash, rol,
     verificationToken, tokenExpiry, creadorId]
  );

  const usuario = result.rows[0];

  // Registrar en log de auditoría (PB-01 criterio 5)
  await db.query(
    `INSERT INTO auditoria_log (accion, tabla, registro_id, usuario_id)
     VALUES ('CREATE_USER', 'usuarios', $1, $2)`,
    [usuario.id, creadorId]
  );

  // Enviar correo de verificación (PB-02)
  await sendVerificationEmail(correo, nombre, verificationToken);

  return usuario;
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-02: Reenviar correo de verificación
// ─────────────────────────────────────────────────────────────────────────────

async function resendVerificationEmail(correo) {
  const result = await db.query(
    'SELECT id, nombre, estado FROM usuarios WHERE correo = $1',
    [correo.toLowerCase()]
  );
  if (result.rows.length === 0) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const user = result.rows[0];
  if (user.estado === 'activo') {
    const err = new Error('La cuenta ya está verificada');
    err.status = 400;
    throw err;
  }

  const newToken = uuidv4();
  const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(
    'UPDATE usuarios SET verification_token=$1, verification_token_expiry=$2 WHERE correo=$3',
    [newToken, newExpiry, correo.toLowerCase()]
  );

  await sendVerificationEmail(correo, user.nombre, newToken);
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-03: Login
// ─────────────────────────────────────────────────────────────────────────────

async function login({ correo, contrasena }) {
  const result = await db.query(
    'SELECT id, nombre, correo, contrasena_hash, rol, estado, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE correo = $1',
    [correo.toLowerCase()]
  );

  // Mensaje genérico — no revela cuál campo falló (PB-03 criterio 3)
  const genericError = new Error('Correo o contraseña incorrectos');
  genericError.status = 401;

  if (result.rows.length === 0) throw genericError;
  const user = result.rows[0];

  if (user.estado === 'pendiente') {
    const err = new Error('Cuenta pendiente de verificación');
    err.status = 401;
    throw err;
  }

  // PB-05: bloqueo temporal de 15 minutos tras 5 intentos fallidos
  if (user.estado === 'bloqueado') {
    const bloqueadoHasta = user.bloqueado_hasta ? new Date(user.bloqueado_hasta) : null;
    if (bloqueadoHasta && bloqueadoHasta > new Date()) {
      const err = new Error('Cuenta bloqueada. Intente de nuevo en 15 minuto(s).');
      err.status = 423;
      err.bloqueadoHasta = bloqueadoHasta.toISOString();
      throw err;
    }
    // Bloqueo expirado — desbloquear automáticamente
    await db.query(
      "UPDATE usuarios SET estado = 'activo', intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1",
      [user.id]
    );
    user.estado = 'activo';
    user.intentos_fallidos = 0;
  }

  const match = await bcrypt.compare(contrasena, user.contrasena_hash);
  if (!match) {
    const intentos = user.intentos_fallidos + 1;
    if (intentos >= 5) {
      // Bloquear cuenta 15 minutos (PB-05)
      const bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
      await db.query(
        "UPDATE usuarios SET intentos_fallidos = $1, estado = 'bloqueado', bloqueado_hasta = $2 WHERE id = $3",
        [intentos, bloqueadoHasta, user.id]
      );
      const err = new Error('Cuenta bloqueada. Intente de nuevo en 15 minuto(s).');
      err.status = 423;
      err.bloqueadoHasta = bloqueadoHasta.toISOString();
      throw err;
    }
    await db.query(
      'UPDATE usuarios SET intentos_fallidos = $1 WHERE id = $2',
      [intentos, user.id]
    );
    throw genericError;
  }

  // Reset intentos fallidos en login exitoso
  await db.query(
    "UPDATE usuarios SET intentos_fallidos = 0, estado = 'activo', bloqueado_hasta = NULL WHERE id = $1",
    [user.id]
  );

  // Generar y guardar OTP (PB-04)
  const otp = generateOtp();
  const otpExpiry = new Date(
    Date.now() + parseInt(process.env.OTP_EXPIRES_MINUTES) * 60 * 1000
  );

  await db.query(
    'UPDATE usuarios SET otp_code=$1, otp_expiry=$2 WHERE id=$3',
    [otp, otpExpiry, user.id]
  );

  await sendOtpEmail(user.correo, user.nombre, otp);

  return {
    requiresMfa: true,
    correo: user.correo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-04: Verificar OTP
// ─────────────────────────────────────────────────────────────────────────────

async function verifyOtp({ correo, otp }) {
  const result = await db.query(
    'SELECT id, nombre, correo, rol, otp_code, otp_expiry, otp_intentos FROM usuarios WHERE correo=$1',
    [correo.toLowerCase()]
  );

  if (result.rows.length === 0) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const user = result.rows[0];

  // PB-04 criterio 4: máximo 3 intentos fallidos
  if (user.otp_intentos >= 3) {
    await db.query(
      'UPDATE usuarios SET otp_code=NULL, otp_expiry=NULL, otp_intentos=0 WHERE id=$1',
      [user.id]
    );
    const err = new Error('Demasiados intentos. Inicia sesión nuevamente.');
    err.status = 401;
    throw err;
  }

  // Verificar expiración
  if (!user.otp_expiry || new Date() > user.otp_expiry) {
    const err = new Error('El código OTP ha expirado');
    err.status = 401;
    throw err;
  }

  // Verificar código
  if (user.otp_code !== otp) {
    await db.query(
      'UPDATE usuarios SET otp_intentos = otp_intentos + 1 WHERE id=$1',
      [user.id]
    );
    const err = new Error('Código incorrecto');
    err.status = 401;
    throw err;
  }

  // OTP correcto — invalidar inmediatamente (PB-04 criterio 6)
  await db.query(
    'UPDATE usuarios SET otp_code=NULL, otp_expiry=NULL, otp_intentos=0 WHERE id=$1',
    [user.id]
  );

  // Emitir tokens (PB-06)
  const tokenPayload = {
    userId: user.id,
    email: user.correo,
    rol: user.rol,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // Guardar refresh token en BD para poder invalidarlo en logout
  await db.query(
    'INSERT INTO refresh_tokens (id, usuario_id, token, expiry) VALUES ($1,$2,$3,$4)',
    [uuidv4(), user.id, refreshToken,
     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
  );

  return {
    requiresMfa: false,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      estado: 'activo',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-06: Refresh token
// ─────────────────────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Refresh token inválido o expirado');
    err.status = 401;
    throw err;
  }

  // Verificar que el refresh token no fue revocado (logout)
  const result = await db.query(
    'SELECT id FROM refresh_tokens WHERE token=$1 AND expiry > NOW()',
    [refreshToken]
  );
  if (result.rows.length === 0) {
    const err = new Error('Refresh token revocado');
    err.status = 401;
    throw err;
  }

  const newAccessToken = signAccessToken({
    userId: payload.userId,
    email: payload.email,
    rol: payload.rol,
  });

  return { accessToken: newAccessToken };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout — invalida el refresh token (PB-06 criterio 4)
// ─────────────────────────────────────────────────────────────────────────────

async function logout(refreshToken) {
  await db.query(
    'DELETE FROM refresh_tokens WHERE token=$1',
    [refreshToken]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-05: Desbloquear usuario (solo admins)
// ─────────────────────────────────────────────────────────────────────────────

async function unblockUser(userId) {
  const result = await db.query(
    "UPDATE usuarios SET estado = 'activo', intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1 RETURNING id",
    [userId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }
}

module.exports = {
  createUser,
  resendVerificationEmail,
  login,
  verifyOtp,
  refreshAccessToken,
  logout,
  unblockUser,
};