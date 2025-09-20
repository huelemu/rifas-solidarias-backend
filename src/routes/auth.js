// src/routes/auth.js
import { Router } from 'express';
import {
  login,
  register,
  refreshToken,
  requireAuth
} from '../middleware/auth.js';

const router = Router();

// Rutas de autenticación
router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refreshToken);

// Ruta protegida de ejemplo
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
