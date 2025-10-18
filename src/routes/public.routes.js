const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

/**
 * Rutas públicas (sin autenticación)
 * Base: /api/public
 */

// Obtener información pública de una rifa
router.get('/rifas/:rifaId', publicController.getRifaPublica);

// Obtener todos los números de una rifa
router.get('/rifas/:rifaId/numeros', publicController.getNumerosRifa);

// Obtener detalle de un número específico (incluye vendedor con teléfono)
router.get('/rifas/:rifaId/numeros/:numeroId', publicController.getNumeroDetalle);

module.exports = router;