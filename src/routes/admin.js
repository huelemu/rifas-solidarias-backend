const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Todas las rutas requieren autenticación Y rol admin
router.use(authenticate);
router.use(isAdmin); // ⬅️ Verificar que sea admin

// ========== GESTIÓN USUARIOS-INSTITUCIONES ==========
// Asignar usuario a institución
router.post('/usuarios-instituciones', adminController.asignarUsuarioInstitucion);

// Remover usuario de institución
router.delete('/usuarios-instituciones', adminController.removerUsuarioInstitucion);

// Listar usuarios de una institución
router.get('/instituciones/:institucionId/usuarios', adminController.listarUsuariosInstitucion);

// ========== GESTIÓN VENDEDORES EN RIFAS ==========
// Asignar vendedor a rifa específica
router.post('/vendedores-rifas', adminController.asignarVendedorRifa);

// Remover vendedor de rifa
router.delete('/vendedores-rifas', adminController.removerVendedorRifa);

// Listar vendedores de una rifa (por institución)
router.get('/rifas/:rifaId/instituciones/:institucionId/vendedores', 
  adminController.listarVendedoresRifa);

// ========== ASIGNACIÓN MASIVA ==========
// Asignar números masivamente (rango)
router.post('/asignar-numeros-masivo', adminController.asignarNumerosMasivo);

// ========== REPORTES ==========
// Resumen general de una rifa
router.get('/rifas/:rifaId/resumen', adminController.resumenRifa);

// Ranking de vendedores
router.get('/rifas/:rifaId/ranking-vendedores', adminController.rankingVendedores);

module.exports = router;