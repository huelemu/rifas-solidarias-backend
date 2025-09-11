// src/routes/rifas.js
import express from 'express';
import {
  obtenerRifas,
  crearRifa,
  obtenerRifaPorId,
  obtenerNumerosRifa,
  comprarNumeros,
  actualizarRifa,
  eliminarRifa,
  obtenerMisRifas
} from '../controllers/rifaController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Rutas públicas
router.get('/', obtenerRifas);
router.get('/:id', obtenerRifaPorId);
router.get('/:id/numeros', obtenerNumerosRifa);

// Rutas protegidas
router.post('/', authenticateToken, crearRifa);
router.put('/:id', authenticateToken, actualizarRifa);
router.delete('/:id', authenticateToken, eliminarRifa);
router.post('/:id/comprar', authenticateToken, comprarNumeros);
router.get('/user/mis-rifas', authenticateToken, obtenerMisRifas);

export default router;