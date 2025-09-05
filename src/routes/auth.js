// src/routes/auth.js
import express from 'express';
import { login, register } from '../controllers/authController.js';

const router = express.Router();

// POST /auth/login - Iniciar sesión
router.post('/login', login);

// POST /auth/register - Registrar nuevo usuario
router.post('/register', register);

export default router;