const express = require('express');
const router = express.Router();
const asignacionController = require('../controllers/asignacionController');
const { verificarToken, verificarRol } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Asignar instituciones a rifa (solo admin)
router.post('/rifas/:rifaId/instituciones', 
  verificarRol(['admin']), 
  asignacionController.asignarInstitucionesARifa
);

// Obtener instituciones de una rifa
router.get('/rifas/:rifaId/instituciones', 
  asignacionController.obtenerInstitucionesDeRifa
);

// Asignar números a vendedor
router.post('/rifa-instituciones/:rifaInstitucionId/vendedores', 
  verificarRol(['admin']), 
  asignacionController.asignarNumerosAVendedor
);

// Obtener vendedores de una institución
router.get('/rifa-instituciones/:rifaInstitucionId/vendedores', 
  asignacionController.obtenerVendedoresDeInstitucion
);

module.exports = router;