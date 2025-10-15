// =====================================================
// RUTAS DEL SISTEMA DE RIFAS
// src/routes/rifas.js
// Sistema completo con multi-institución, números y sorteos
// =====================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import rifasController, { rifasValidations } from '../controllers/rifasController.js';

const router = Router();


// =====================================================
// AGREGAR ESTA RUTA PÚBLICA EN rifas.js
// =====================================================

/**
 * @route   GET /rifas/:id/numeros
 * @desc    Ver todos los números de una rifa (PÚBLICO)
 * @access  Public
 */
router.get(
  '/:id/numeros',
  rifasController.obtenerNumerosRifaPublico
);  

// =====================================================
// 🎪 CRUD DE RIFAS
// =====================================================

/**
 * @swagger
 * /rifas:
 *   get:
 *     summary: Listar todas las rifas
 *     description: Obtiene una lista de rifas con filtros opcionales
 *     tags: [Rifas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [borrador, activa, cerrada, finalizada, cancelada]
 *         description: Filtrar por estado
 *       - in: query
 *         name: institucion_id
 *         schema:
 *           type: integer
 *         description: Filtrar por institución
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista de rifas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       nombre:
 *                         type: string
 *                         example: Rifa Solidaria 2025
 *                       descripcion:
 *                         type: string
 *                       cantidad_numeros:
 *                         type: integer
 *                         example: 1000
 *                       precio_numero:
 *                         type: number
 *                         example: 500.00
 *                       fecha_sorteo:
 *                         type: string
 *                         format: date-time
 *                       estado:
 *                         type: string
 *                         example: activa
 *                       institucion_nombre:
 *                         type: string
 *                         example: Cruz Roja
 *                       numeros_vendidos:
 *                         type: integer
 *                         example: 450
 *                       total_recaudado:
 *                         type: number
 *                         example: 225000.00
 */
router.get('/', rifasController.listarRifas);

/**
 * @swagger
 * /rifas/{id}:
 *   get:
 *     summary: Obtener detalles de una rifa
 *     description: Retorna información completa de una rifa específica
 *     tags: [Rifas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa
 *         example: 1
 *     responses:
 *       200:
 *         description: Detalles de la rifa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     nombre:
 *                       type: string
 *                     descripcion:
 *                       type: string
 *                     cantidad_numeros:
 *                       type: integer
 *                     precio_numero:
 *                       type: number
 *                     fecha_inicio:
 *                       type: string
 *                       format: date-time
 *                     fecha_fin:
 *                       type: string
 *                       format: date-time
 *                     fecha_sorteo:
 *                       type: string
 *                       format: date-time
 *                     estado:
 *                       type: string
 *                     estadisticas:
 *                       type: object
 *                       properties:
 *                         numeros_generados:
 *                           type: integer
 *                         numeros_vendidos:
 *                           type: integer
 *                         numeros_disponibles:
 *                           type: integer
 *                         total_recaudado:
 *                           type: number
 *       404:
 *         description: Rifa no encontrada
 */
router.get('/:id', rifasController.obtenerRifa);

/**
 * @swagger
 * /rifas:
 *   post:
 *     summary: Crear nueva rifa
 *     description: Crea una rifa nueva. Solo administradores.
 *     tags: [Rifas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - cantidad_numeros
 *               - precio_numero
 *               - fecha_inicio
 *               - fecha_fin
 *               - fecha_sorteo
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Rifa Solidaria del Club
 *               descripcion:
 *                 type: string
 *                 example: Rifa para recaudar fondos
 *               institucion_promotora_id:
 *                 type: integer
 *                 example: 1
 *               cantidad_numeros:
 *                 type: integer
 *                 example: 1000
 *               precio_numero:
 *                 type: number
 *                 example: 500.00
 *               fecha_inicio:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-01-01T00:00:00Z
 *               fecha_fin:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-03-01T23:59:59Z
 *               fecha_sorteo:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-03-05T20:00:00Z
 *               max_instituciones_participantes:
 *                 type: integer
 *                 example: 5
 *               comision_promotora:
 *                 type: number
 *                 example: 10.00
 *               numeros_por_institucion:
 *                 type: integer
 *                 example: 200
 *               requiere_aprobacion:
 *                 type: boolean
 *                 example: true
 *           examples:
 *             rifa_simple:
 *               summary: Rifa simple
 *               value:
 *                 nombre: Rifa del Club
 *                 cantidad_numeros: 500
 *                 precio_numero: 300.00
 *                 fecha_inicio: 2025-01-15T00:00:00Z
 *                 fecha_fin: 2025-02-15T23:59:59Z
 *                 fecha_sorteo: 2025-02-20T20:00:00Z
 *             rifa_multiinstitucion:
 *               summary: Rifa multi-institución
 *               value:
 *                 nombre: Rifa Solidaria Conjunta
 *                 descripcion: Rifa entre varias instituciones
 *                 cantidad_numeros: 2000
 *                 precio_numero: 1000.00
 *                 fecha_inicio: 2025-02-01T00:00:00Z
 *                 fecha_fin: 2025-04-30T23:59:59Z
 *                 fecha_sorteo: 2025-05-10T20:00:00Z
 *                 max_instituciones_participantes: 10
 *                 comision_promotora: 15.00
 *                 numeros_por_institucion: 200
 *                 requiere_aprobacion: true
 *     responses:
 *       201:
 *         description: Rifa creada exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos
 */
router.post(
  '/',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.crearRifa,
  rifasController.crearRifa
);

/**
 * @swagger
 * /rifas/{id}:
 *   put:
 *     summary: Actualizar rifa
 *     description: Modifica los datos de una rifa existente
 *     tags: [Rifas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               estado:
 *                 type: string
 *                 enum: [borrador, activa, cerrada, finalizada, cancelada]
 *               fecha_sorteo:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Rifa actualizada
 *       404:
 *         description: Rifa no encontrada
 *       401:
 *         description: No autorizado
 */
router.put(
  '/:id',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.actualizarRifa,
  rifasController.actualizarRifa
);

/**
 * @swagger
 * /rifas/{id}:
 *   delete:
 *     summary: Eliminar rifa
 *     description: Elimina permanentemente una rifa. Solo admin_global.
 *     tags: [Rifas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rifa eliminada
 *       404:
 *         description: Rifa no encontrada
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Sin permisos suficientes
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole(['admin_global']),
  rifasController.eliminarRifa
);

// =====================================================
// 🎯 GESTIÓN DE NÚMEROS
// =====================================================

/**
 * @swagger
 * /rifas/{id}/generar-numeros:
 *   post:
 *     summary: Generar números para una rifa
 *     description: Genera todos los números de la rifa según la cantidad configurada
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa
 *     responses:
 *       200:
 *         description: Números generados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Números generados exitosamente
 *                 total:
 *                   type: integer
 *                   example: 1000
 *       404:
 *         description: Rifa no encontrada
 *       400:
 *         description: Los números ya fueron generados
 */
router.post(
  '/:id/generar-numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.generarNumerosRifa
);

/**
 * @swagger
 * /rifas/{id}/numeros:
 *   get:
 *     summary: Obtener todos los números de una rifa
 *     description: Lista todos los números con su estado (disponible, reservado, vendido)
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [disponible, reservado, vendido]
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de números
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       rifa_id:
 *                         type: integer
 *                       numero:
 *                         type: integer
 *                       estado:
 *                         type: string
 *                       comprador_id:
 *                         type: integer
 *                       vendedor_id:
 *                         type: integer
 *                       fecha_venta:
 *                         type: string
 *                         format: date-time
 *                       metodo_pago:
 *                         type: string
 */
// se hizo publico -> router.get('/:id/numeros', requireAuth, rifasController.obtenerNumerosRifa);

/**
 * @swagger
 * /rifas/{id}/comprar:
 *   post:
 *     summary: Comprar números de rifa
 *     description: Permite a un usuario comprar uno o varios números
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la rifa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - numeros
 *               - metodo_pago
 *             properties:
 *               numeros:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [42, 123, 456]
 *               comprador_info:
 *                 type: object
 *                 properties:
 *                   nombre:
 *                     type: string
 *                   apellido:
 *                     type: string
 *                   telefono:
 *                     type: string
 *                   email:
 *                     type: string
 *               metodo_pago:
 *                 type: string
 *                 enum: [efectivo, transferencia, tarjeta, mercadopago]
 *                 example: efectivo
 *               observaciones:
 *                 type: string
 *           examples:
 *             compra_simple:
 *               summary: Compra simple
 *               value:
 *                 numeros: [42]
 *                 metodo_pago: efectivo
 *             compra_multiple:
 *               summary: Compra múltiple
 *               value:
 *                 numeros: [10, 20, 30, 40, 50]
 *                 comprador_info:
 *                   nombre: Juan
 *                   apellido: Pérez
 *                   telefono: "+5491123456789"
 *                   email: juan@email.com
 *                 metodo_pago: transferencia
 *                 observaciones: Transferencia realizada el 10/01
 *     responses:
 *       200:
 *         description: Números comprados exitosamente
 *       400:
 *         description: Números no disponibles
 *       404:
 *         description: Rifa no encontrada
 */
router.post(
  '/:id/comprar',
  requireAuth,
  rifasValidations.comprarNumeros,
  rifasController.comprarNumeros
);

/**
 * @swagger
 * /rifas/{rifa_id}/numeros/{numero}/vender:
 *   post:
 *     summary: Vender número como vendedor
 *     description: Permite a un vendedor registrar la venta de un número a un comprador
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifa_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: numero
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comprador_nombre
 *               - comprador_telefono
 *               - metodo_pago
 *             properties:
 *               comprador_nombre:
 *                 type: string
 *                 example: María González
 *               comprador_telefono:
 *                 type: string
 *                 example: "+5491145678901"
 *               comprador_email:
 *                 type: string
 *                 example: maria@email.com
 *               metodo_pago:
 *                 type: string
 *                 enum: [efectivo, transferencia, tarjeta]
 *               observaciones:
 *                 type: string
 *     responses:
 *       200:
 *         description: Venta registrada exitosamente
 *       400:
 *         description: Número no disponible
 *       404:
 *         description: Número no encontrado
 */
router.post(
  '/:rifa_id/numeros/:numero/vender',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion', 'vendedor']),
  rifasValidations.venderNumero,
  rifasController.venderNumero
);

/**
 * @swagger
 * /rifas/{rifa_id}/numeros/{numero}/reservar:
 *   post:
 *     summary: Reservar número temporalmente
 *     description: Reserva un número por tiempo limitado (ej. 15 minutos)
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifa_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: numero
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Número reservado
 *       400:
 *         description: Número no disponible
 */
router.post(
  '/:rifa_id/numeros/:numero/reservar',
  requireAuth,
  rifasController.reservarNumero
);

/**
 * @swagger
 * /rifas/{rifa_id}/numeros/{numero}/venta:
 *   delete:
 *     summary: Cancelar venta de número
 *     description: Devuelve un número vendido al estado disponible
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifa_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: numero
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Venta cancelada
 *       404:
 *         description: Número no encontrado
 */
router.delete(
  '/:rifa_id/numeros/:numero/venta',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.cancelarVentaNumero
);

// =====================================================
// 👤 MIS RIFAS Y NÚMEROS
// =====================================================

/**
 * @swagger
 * /rifas/usuario/mis-rifas:
 *   get:
 *     summary: Obtener mis rifas
 *     description: Lista las rifas creadas por el usuario actual
 *     tags: [Rifas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de mis rifas
 */
router.get('/usuario/mis-rifas', requireAuth, rifasController.obtenerMisRifas);

/**
 * @swagger
 * /rifas/{id}/mis-numeros:
 *   get:
 *     summary: Obtener mis números de una rifa
 *     description: Lista los números que el usuario ha comprado en esta rifa
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de mis números
 */
router.get('/:id/mis-numeros', requireAuth, rifasController.obtenerMisNumeros);

// =====================================================
// 🌐 RUTAS PÚBLICAS (NO REQUIEREN AUTENTICACIÓN)
// =====================================================

/**
 * @swagger
 * /rifas/publicas/{id}:
 *   get:
 *     summary: Obtener rifa pública (sin autenticación)
 *     tags: [Rifas Públicas]
 */
router.get('/publicas/:id', rifasController.obtenerRifaPublica);

/**
 * @swagger
 * /rifas/publicas/{id}/numeros:
 *   get:
 *     summary: Obtener números de rifa pública
 *     tags: [Rifas Públicas]
 */
router.get('/publicas/:id/numeros', rifasController.obtenerNumerosPublicos);


// =====================================================
// 🏢 ADMINISTRACIÓN MULTI-INSTITUCIÓN
// =====================================================

/**
 * @swagger
 * /rifas/{id}/asignar-numeros:
 *   post:
 *     summary: Asignar números a institución
 *     description: Asigna un rango de números a una institución participante
 *     tags: [Rifas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - institucion_id
 *               - cantidad_numeros
 *             properties:
 *               institucion_id:
 *                 type: integer
 *                 example: 5
 *               cantidad_numeros:
 *                 type: integer
 *                 example: 200
 *     responses:
 *       200:
 *         description: Números asignados exitosamente
 */
router.post(
  '/:id/asignar-numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.asignarNumeros,
  rifasController.asignarNumeros
);

/**
 * @swagger
 * /rifas/{rifa_id}/instituciones/{institucion_id}/numeros:
 *   get:
 *     summary: Obtener números de una institución
 *     description: Lista los números asignados a una institución específica
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifa_id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: institucion_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de números de la institución
 */
router.get(
  '/:rifa_id/instituciones/:institucion_id/numeros',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  rifasController.obtenerNumerosInstitucion
);

/**
 * @swagger
 * /rifas/{rifa_id}/vendedor/numeros:
 *   get:
 *     summary: Obtener números del vendedor
 *     description: Lista los números vendidos por el vendedor actual
 *     tags: [Números]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rifa_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de números vendidos por el vendedor
 */
router.get(
  '/:rifa_id/vendedor/numeros',
  requireAuth,
  requireRole(['vendedor', 'admin_institucion', 'admin_global']),
  rifasController.obtenerNumerosVendedor
);

export default router;