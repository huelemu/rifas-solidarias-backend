// =====================================================
// CONTROLADOR DE RESERVAS
// src/controllers/reservasController.js
// =====================================================

import db from '../config/db.js';
import { RESERVA_CONFIG } from '../config/reservas.config.js';
import { generarTokenReserva, calcularExpiracion } from '../utils/tokenGenerator.js';
import { generarLinkWhatsApp } from '../services/whatsappService.js';
import { 
  enviarEmailConfirmacionComprador, 
  enviarEmailNotificacionVendedor 
} from '../services/emailService.js';

const reservasController = {

  /**
   * POST /reservas/crear
   * Crear una nueva reserva de números
   */
  async crearReserva(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const usuarioId = req.user.id;
      const { rifa_id, numeros } = req.body;
      
      // =====================================================
      // VALIDACIONES
      // =====================================================
      
      if (!rifa_id || !numeros || !Array.isArray(numeros) || numeros.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Debe proporcionar rifa_id y un array de números'
        });
      }
      
      // Validar cantidad de números
      if (numeros.length > RESERVA_CONFIG.MAX_NUMEROS_POR_RESERVA) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: `Máximo ${RESERVA_CONFIG.MAX_NUMEROS_POR_RESERVA} números por reserva`
        });
      }
      
      if (numeros.length < RESERVA_CONFIG.MIN_NUMEROS_POR_RESERVA) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: `Mínimo ${RESERVA_CONFIG.MIN_NUMEROS_POR_RESERVA} número por reserva`
        });
      }
      
      // Verificar que la rifa existe y está activa
      const [rifas] = await connection.execute(
        'SELECT * FROM rifas WHERE id = ? AND estado = "activa"',
        [rifa_id]
      );
      
      if (rifas.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada o no está activa'
        });
      }
      
      const rifa = rifas[0];
      
      // Verificar que los números existen y están disponibles
      const [numerosDB] = await connection.execute(`
        SELECT id, numero, estado 
        FROM numeros_rifa 
        WHERE rifa_id = ? 
          AND numero IN (${numeros.map(() => '?').join(',')})
        FOR UPDATE
      `, [rifa_id, ...numeros]);
      
      if (numerosDB.length !== numeros.length) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Algunos números no existen'
        });
      }
      
      // Verificar que todos están disponibles
      const noDisponibles = numerosDB.filter(n => n.estado !== 'disponible');
      if (noDisponibles.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Algunos números ya no están disponibles',
          numeros_no_disponibles: noDisponibles.map(n => n.numero)
        });
      }
      
      // Verificar reservas activas del usuario
      const [reservasActivas] = await connection.execute(`
        SELECT COUNT(*) as total 
        FROM historial_reservas 
        WHERE usuario_id = ? 
          AND estado = 'activa' 
          AND fecha_expiracion > NOW()
      `, [usuarioId]);
      
      if (reservasActivas[0].total >= RESERVA_CONFIG.MAX_RESERVAS_SIMULTANEAS_POR_USUARIO) {
        await connection.rollback();
        return res.status(400).json({
          status: 'error',
          message: `Máximo ${RESERVA_CONFIG.MAX_RESERVAS_SIMULTANEAS_POR_USUARIO} reservas simultáneas`
        });
      }
      
      // =====================================================
      // CREAR RESERVA
      // =====================================================
      
      const tokenReserva = generarTokenReserva();
      const fechaExpiracion = calcularExpiracion(RESERVA_CONFIG.DURACION_MINUTOS);
      const montoTotal = numeros.length * rifa.precio_numero;
      
      // Obtener datos del usuario
      const [usuarios] = await connection.execute(
        'SELECT * FROM usuarios WHERE id = ?',
        [usuarioId]
      );
      const usuario = usuarios[0];
      
      // Obtener vendedor/institución de la rifa
      const [vendedores] = await connection.execute(`
        SELECT u.* 
        FROM usuarios u
        INNER JOIN rifas r ON r.creado_por = u.id
        WHERE r.id = ?
      `, [rifa_id]);
      const vendedor = vendedores[0];
      
      // Generar link de WhatsApp
      let whatsappLink = null;
      if (vendedor && vendedor.telefono) {
        whatsappLink = generarLinkWhatsApp(
          vendedor,
          {
            nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
            email: usuario.email,
            telefono: usuario.telefono
          },
          { titulo: rifa.titulo },
          numeros
        );
      }
      
      // Insertar en historial_reservas
      const [resultReserva] = await connection.execute(`
        INSERT INTO historial_reservas (
          rifa_id, usuario_id, numeros, cantidad_numeros, monto_total,
          token_reserva, fecha_reserva, fecha_expiracion,
          estado, comprador_nombre, comprador_email, comprador_telefono,
          vendedor_id, institucion_id, whatsapp_link,
          ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, 'activa', ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        rifa_id,
        usuarioId,
        JSON.stringify(numeros),
        numeros.length,
        montoTotal,
        tokenReserva,
        fechaExpiracion,
        `${usuario.nombre} ${usuario.apellido}`.trim(),
        usuario.email,
        usuario.telefono || null,
        vendedor?.id || null,
        rifa.institucion_id || null,
        whatsappLink,
        req.ip || null,
        req.get('user-agent') || null
      ]);
      
      const reservaId = resultReserva.insertId;
      
      // Actualizar números a estado 'reservado'
      await connection.execute(`
        UPDATE numeros_rifa 
        SET 
          estado = 'reservado',
          reservado_por = ?,
          fecha_reserva = NOW(),
          fecha_expiracion_reserva = ?,
          token_reserva = ?,
          intentos_reserva = intentos_reserva + 1
        WHERE rifa_id = ? 
          AND numero IN (${numeros.map(() => '?').join(',')})
      `, [usuarioId, fechaExpiracion, tokenReserva, rifa_id, ...numeros]);
      
      await connection.commit();
      
// =====================================================
// ENVIAR NOTIFICACIONES
// =====================================================

const reservaCompleta = {
  id: reservaId,
  token_reserva: tokenReserva,
  usuario_id: usuarioId,
  monto_total: montoTotal,
  fecha_expiracion: fechaExpiracion,
  comprador_nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
  comprador_email: usuario.email,
  comprador_telefono: usuario.telefono,
  whatsapp_link: whatsappLink
};

// ✅ OBJETO RIFA COMPLETO PARA EMAILS
const rifaParaEmail = {
  id: rifa.id,
  titulo: rifa.titulo || rifa.nombre, // ← Por si el campo se llama 'nombre'
  descripcion: rifa.descripcion,
  precio_numero: rifa.precio_numero,
  fecha_sorteo: rifa.fecha_sorteo,
  imagen_url: rifa.imagen_url
};

// Enviar emails de forma asíncrona (no bloquear la respuesta)
if (RESERVA_CONFIG.EMAIL_COMPRADOR) {
  enviarEmailConfirmacionComprador(reservaCompleta, rifaParaEmail, numeros)
    .catch(err => console.error('Error enviando email al comprador:', err));
}

if (RESERVA_CONFIG.EMAIL_VENDEDOR && vendedor) {
  enviarEmailNotificacionVendedor(reservaCompleta, rifaParaEmail, numeros, vendedor)
    .catch(err => console.error('Error enviando email al vendedor:', err));
}
      
      // =====================================================
      // RESPUESTA EXITOSA
      // =====================================================
      
      console.log(`✅ Reserva creada: ${reservaId} - ${numeros.length} números`);
      
      res.json({
        status: 'success',
        message: 'Reserva creada exitosamente',
        data: {
          reserva_id: reservaId,
          token_reserva: tokenReserva.substring(0, 8).toUpperCase(), // Solo primeros 8 chars para mostrar
          numeros_reservados: numeros,
          cantidad: numeros.length,
          monto_total: montoTotal,
          fecha_expiracion: fechaExpiracion,
          minutos_restantes: RESERVA_CONFIG.DURACION_MINUTOS,
          whatsapp_link: whatsappLink,
          vendedor: vendedor ? {
            nombre: `${vendedor.nombre} ${vendedor.apellido}`.trim(),
            email: vendedor.email,
            telefono: vendedor.telefono
          } : null
        }
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error creando reserva:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al crear la reserva',
        error: error.message
      });
    } finally {
      connection.release();
    }
  },

  /**
   * GET /reservas/mis-reservas
   * Obtener reservas activas del usuario actual
   */
  async obtenerMisReservas(req, res) {
    try {
      const usuarioId = req.user.id;
      
      const [reservas] = await db.execute(`
        SELECT 
          hr.*,
          r.titulo as rifa_nombre,
          r.descripcion as rifa_descripcion,
          r.imagen_url as rifa_imagen,
          r.precio_numero,
          r.fecha_sorteo,
          TIMESTAMPDIFF(MINUTE, NOW(), hr.fecha_expiracion) as minutos_restantes,
          CASE 
            WHEN hr.fecha_expiracion < NOW() THEN 'expirada'
            ELSE hr.estado
          END as estado_real
        FROM historial_reservas hr
        INNER JOIN rifas r ON hr.rifa_id = r.id
        WHERE hr.usuario_id = ?
          AND hr.estado IN ('activa', 'confirmada')
        ORDER BY hr.fecha_reserva DESC
      `, [usuarioId]);
      
      res.json({
        status: 'success',
        data: reservas.map(r => ({
          ...r,
          numeros: JSON.parse(r.numeros)
        }))
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo mis reservas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener reservas',
        error: error.message
      });
    }
  },

  /**
   * GET /reservas/:id
   * Obtener detalle de una reserva específica
   */
  async obtenerReserva(req, res) {
    try {
      const { id } = req.params;
      const usuarioId = req.user.id;
      const esVendedor = ['vendedor', 'admin_institucion', 'admin_global'].includes(req.user.rol);
      
      const [reservas] = await db.execute(`
        SELECT 
          hr.*,
          r.titulo as rifa_nombre,
          r.descripcion as rifa_descripcion,
          r.imagen_url as rifa_imagen,
          r.precio_numero,
          r.fecha_sorteo,
          TIMESTAMPDIFF(MINUTE, NOW(), hr.fecha_expiracion) as minutos_restantes
        FROM historial_reservas hr
        INNER JOIN rifas r ON hr.rifa_id = r.id
        WHERE hr.id = ?
          AND (hr.usuario_id = ? OR ? = TRUE)
      `, [id, usuarioId, esVendedor]);
      
      if (reservas.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Reserva no encontrada'
        });
      }
      
      const reserva = {
        ...reservas[0],
        numeros: JSON.parse(reservas[0].numeros)
      };
      
      res.json({
        status: 'success',
        data: reserva
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo reserva:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener la reserva',
        error: error.message
      });
    }
  },

  /**
   * POST /reservas/:id/cancelar
   * Cancelar una reserva activa
   */
  async cancelarReserva(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const { id } = req.params;
      const usuarioId = req.user.id;
      
      // Verificar que la reserva existe y pertenece al usuario
      const [reservas] = await connection.execute(
        'SELECT * FROM historial_reservas WHERE id = ? AND usuario_id = ? AND estado = "activa"',
        [id, usuarioId]
      );
      
      if (reservas.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Reserva no encontrada o no se puede cancelar'
        });
      }
      
      const reserva = reservas[0];
      
      // Actualizar estado de la reserva
      await connection.execute(
        'UPDATE historial_reservas SET estado = "cancelada", fecha_cambio_estado = NOW() WHERE id = ?',
        [id]
      );
      
      // Liberar números
      await connection.execute(`
        UPDATE numeros_rifa 
        SET 
          estado = 'disponible',
          reservado_por = NULL,
          fecha_reserva = NULL,
          fecha_expiracion_reserva = NULL,
          token_reserva = NULL
        WHERE token_reserva = ?
      `, [reserva.token_reserva]);
      
      await connection.commit();
      
      console.log(`✅ Reserva cancelada: ${id}`);
      
      res.json({
        status: 'success',
        message: 'Reserva cancelada exitosamente'
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error cancelando reserva:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al cancelar la reserva',
        error: error.message
      });
    } finally {
      connection.release();
    }
  },

  /**
   * POST /reservas/:id/confirmar
   * Vendedor confirma la venta (marca como vendido)
   */
  async confirmarVenta(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const { id } = req.params;
      const vendedorId = req.user.id;
      const { metodo_pago, observaciones } = req.body;
      
      // Verificar que la reserva existe
      const [reservas] = await connection.execute(
        'SELECT * FROM historial_reservas WHERE id = ? AND estado = "activa"',
        [id]
      );
      
      if (reservas.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Reserva no encontrada o ya fue procesada'
        });
      }
      
      const reserva = reservas[0];
      const numeros = JSON.parse(reserva.numeros);
      
      // Actualizar estado de la reserva
      await connection.execute(
        `UPDATE historial_reservas 
         SET estado = 'confirmada', 
             fecha_cambio_estado = NOW(),
             observaciones = ?
         WHERE id = ?`,
        [observaciones || 'Venta confirmada por vendedor', id]
      );
      
      // Marcar números como vendidos
      await connection.execute(`
        UPDATE numeros_rifa 
        SET 
          estado = 'vendido',
          vendedor_id = ?,
          comprador_nombre = ?,
          comprador_email = ?,
          comprador_telefono = ?,
          metodo_pago = ?,
          precio_venta = ?,
          fecha_venta = NOW(),
          observaciones = ?,
          participante_id = ?
        WHERE token_reserva = ?
      `, [
        vendedorId,
        reserva.comprador_nombre,
        reserva.comprador_email,
        reserva.comprador_telefono,
        metodo_pago || 'efectivo',
        reserva.monto_total / reserva.cantidad_numeros,
        observaciones || null,
        reserva.usuario_id,
        reserva.token_reserva
      ]);
      
      await connection.commit();
      
      console.log(`✅ Venta confirmada: Reserva ${id} - ${numeros.length} números`);
      
      res.json({
        status: 'success',
        message: 'Venta confirmada exitosamente',
        data: {
          reserva_id: id,
          numeros_vendidos: numeros,
          cantidad: numeros.length
        }
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error confirmando venta:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al confirmar la venta',
        error: error.message
      });
    } finally {
      connection.release();
    }
  },

  /**
   * POST /reservas/:id/rechazar
   * Vendedor rechaza la reserva
   */
  async rechazarReserva(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const { id } = req.params;
      const { motivo_rechazo } = req.body;
      
      // Verificar que la reserva existe
      const [reservas] = await connection.execute(
        'SELECT * FROM historial_reservas WHERE id = ? AND estado = "activa"',
        [id]
      );
      
      if (reservas.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          status: 'error',
          message: 'Reserva no encontrada o ya fue procesada'
        });
      }
      
      const reserva = reservas[0];
      
      // Actualizar estado de la reserva
      await connection.execute(
        `UPDATE historial_reservas 
         SET estado = 'rechazada', 
             fecha_cambio_estado = NOW(),
             motivo_rechazo = ?
         WHERE id = ?`,
        [motivo_rechazo || 'Rechazada por vendedor', id]
      );
      
      // Liberar números
      await connection.execute(`
        UPDATE numeros_rifa 
        SET 
          estado = 'disponible',
          reservado_por = NULL,
          fecha_reserva = NULL,
          fecha_expiracion_reserva = NULL,
          token_reserva = NULL
        WHERE token_reserva = ?
      `, [reserva.token_reserva]);
      
      await connection.commit();
      
      console.log(`✅ Reserva rechazada: ${id}`);
      
      res.json({
        status: 'success',
        message: 'Reserva rechazada. Los números están disponibles nuevamente'
      });
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error rechazando reserva:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al rechazar la reserva',
        error: error.message
      });
    } finally {
      connection.release();
    }
  },

  /**
   * GET /reservas/rifa/:rifaId/pendientes
   * Obtener reservas pendientes de una rifa (para vendedores)
   */
  async obtenerReservasPendientes(req, res) {
    try {
      const { rifaId } = req.params;
      const usuarioId = req.user.id;
      const esAdmin = ['admin_global', 'admin_institucion'].includes(req.user.rol);
      
      // Verificar permisos
      if (!esAdmin) {
        const [rifas] = await db.execute(
          'SELECT * FROM rifas WHERE id = ? AND creado_por = ?',
          [rifaId, usuarioId]
        );
        
        if (rifas.length === 0) {
          return res.status(403).json({
            status: 'error',
            message: 'No tienes permisos para ver las reservas de esta rifa'
          });
        }
      }
      
      const [reservas] = await db.execute(`
        SELECT 
          hr.*,
          TIMESTAMPDIFF(MINUTE, NOW(), hr.fecha_expiracion) as minutos_restantes,
          CASE 
            WHEN hr.fecha_expiracion < NOW() THEN 'expirada'
            ELSE hr.estado
          END as estado_real
        FROM historial_reservas hr
        WHERE hr.rifa_id = ?
          AND hr.estado = 'activa'
        ORDER BY hr.fecha_reserva DESC
      `, [rifaId]);
      
      res.json({
        status: 'success',
        data: reservas.map(r => ({
          ...r,
          numeros: JSON.parse(r.numeros)
        }))
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo reservas pendientes:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener reservas pendientes',
        error: error.message
      });
    }
  }

};

export default reservasController;