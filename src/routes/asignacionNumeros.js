const express = require('express');
const router = express.Router();
const asignacionController = require('../controllers/asignacionNumerosController');
const { authenticate } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener mis instituciones
router.get('/mis-instituciones', asignacionController.obtenerMisInstituciones);

// Obtener rifas de una institución donde puedo vender
router.get('/instituciones/:institucionId/rifas', asignacionController.obtenerRifasDisponibles);

// Obtener números disponibles
router.get('/rifas/:rifaId/instituciones/:institucionId/numeros-disponibles', 
  asignacionController.obtenerNumerosDisponibles);

// Obtener mis números asignados
router.get('/rifas/:rifaId/instituciones/:institucionId/mis-numeros', 
  asignacionController.obtenerMisNumeros);

// Asignar números
router.post('/asignar', asignacionController.asignarNumeros);

// Liberar números
router.post('/liberar', asignacionController.liberarNumeros);

module.exports = router;