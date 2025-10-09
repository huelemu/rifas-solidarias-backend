// =====================================================
// RUTAS PARA EL SISTEMA DE RIFAS
// =====================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import rifasController, { rifasValidations } from '../controllers/rifasController.js';

const router = Router();
console.log('🧩 Métodos disponibles:', Object.keys(rifasController));
// ========================================
// CRUD DE RIFAS
// ========================================
router.get('/', rifasController.listarRifas);
router.get('/:id', rifasController.obtenerRifa);

router.post(
  '/',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.crearRifa,
  rifasController.crearRifa
);

router.put(
  '/:id',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.actualizarRifa,
  rifasController.actualizarRifa
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(['admin_global']),
  rifasController.eliminarRifa
);

// ========================================
// GESTIÓN DE NÚMEROS
// ========================================

router.post(
  '/:id/generar-numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.generarNumerosRifa
);

router.get('/:id/numeros', requireAuth, rifasController.obtenerNumerosRifa);

router.post(
  '/:id/comprar',
  requireAuth,
  rifasValidations.comprarNumeros,
  rifasController.comprarNumeros
);

router.post(
  '/:rifa_id/numeros/:numero/vender',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  rifasValidations.venderNumero,
  rifasController.venderNumero
);

router.post(
  '/:rifa_id/numeros/:numero/reservar',
  requireAuth,
  rifasController.reservarNumero
);

router.delete(
  '/:rifa_id/numeros/:numero/venta',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.cancelarVentaNumero
);

// ========================================
// MIS RIFAS Y NÚMEROS
// ========================================

router.get('/usuario/mis-rifas', requireAuth, rifasController.obtenerMisRifas);

router.get('/:id/mis-numeros', requireAuth, rifasController.obtenerMisNumeros);

// ========================================
// ADMINISTRACIÓN DE NÚMEROS
// ========================================

router.post(
  '/:id/asignar-numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.asignarNumeros,
  rifasController.asignarNumeros
);

router.get(
  '/:rifa_id/instituciones/:institucion_id/numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.obtenerNumerosInstitucion
);

router.get(
  '/:rifa_id/vendedor/numeros',
  requireAuth,
  requireRole(['vendedor', 'admin_institucion', 'admin_global']),
  rifasController.obtenerNumerosVendedor
);

export default router;
