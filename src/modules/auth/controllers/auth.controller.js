const authService = require('../services/auth.service');

// PB-01
async function createUser(req, res) {
  try {
    const user = await authService.createUser(req.body, req.user.userId);
    res.status(201).json(user);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

// PB-02
async function resendVerification(req, res) {
  try {
    await authService.resendVerificationEmail(req.body.correo);
    res.json({ message: 'Correo de verificación reenviado' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

// PB-03
async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    // PB-05: incluir bloqueadoHasta en la respuesta 423
    const body = { message: err.message };
    if (err.bloqueadoHasta) body.bloqueadoHasta = err.bloqueadoHasta;
    res.status(err.status || 500).json(body);
  }
}

// PB-04
async function verifyOtp(req, res) {
  try {
    const result = await authService.verifyOtp(req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
}

// PB-06
async function refresh(req, res) {
  try {
    const result = await authService.refreshAccessToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    res.status(err.status || 401).json({ message: err.message });
  }
}

// Logout
async function logout(req, res) {
  try {
    await authService.logout(req.body.refreshToken);
    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { createUser, resendVerification, login, verifyOtp, refresh, logout };