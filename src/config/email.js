const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/**
 * Enviar correo de verificación de cuenta (PB-02)
 */
async function sendVerificationEmail(correo, nombre, token) {
  const link = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  try {
    await transporter.sendMail({
      from: `"SGP Sistema" <${process.env.MAIL_FROM}>`,
      to: correo,
      subject: 'Activa tu cuenta SGP',
      html: `
        <h2>Hola, ${nombre}</h2>
        <p>Para activar tu cuenta en el Sistema de Gestión de Pacientes, haz clic en el siguiente enlace:</p>
        <a href="${link}" style="background:#1565C0;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">
          Verificar correo
        </a>
        <p>Este enlace vence en <strong>24 horas</strong>.</p>
        <p>Si no solicitaste esta cuenta, ignora este correo.</p>
      `,
    });
  } catch (error) {
    console.error('Error al enviar correo de verificación:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[DEV MOCK EMAIL] Verificación - Correo: ${correo} | Token: ${token}\n`);
    } else {
      throw error;
    }
  }
}

/**
 * Enviar código OTP para MFA (PB-04)
 */
async function sendOtpEmail(correo, nombre, otp) {
  try {
    await transporter.sendMail({
      from: `"SGP Sistema" <${process.env.MAIL_FROM}>`,
      to: correo,
      subject: 'Tu código de verificación SGP',
      html: `
        <h2>Hola, ${nombre}</h2>
        <p>Tu código de verificación es:</p>
        <h1 style="font-size:48px;letter-spacing:12px;color:#1565C0;font-family:monospace">
          ${otp}
        </h1>
        <p>Este código vence en <strong>5 minutos</strong>.</p>
        <p>Si no iniciaste sesión, cambia tu contraseña inmediatamente.</p>
      `,
    });
  } catch (error) {
    console.error('Error al enviar correo OTP:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n[DEV MOCK EMAIL] OTP - Correo: ${correo} | Código OTP: ${otp}\n`);
    } else {
      throw error;
    }
  }
}

module.exports = { sendVerificationEmail, sendOtpEmail };