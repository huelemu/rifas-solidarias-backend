// =====================================================
// BACKEND COMPLETO - SISTEMA DE RIFAS SOLIDARIAS
// src/controllers/rifasController.js
// =====================================================

import db from '../config/db.js';
import { validationResult } from 'express-validator';

// =====================================================
// CONTROLADOR PRINCIPAL DE RIFAS
// =====================================================

export const rifasController = {

  // ===================================================
  // 1. GESTIÓN DE RIFAS
  // ===================================================

  // Crear nueva rifa (solo instituciones habilitadas)
  async crearRifa(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const {
        nombre,
        descripcion,
        cantidad_numeros,
        precio_numero,
        fecha_inicio,
        fecha_fin,
        fecha_sorteo,
        max_instituciones_participantes,
        comision_promotora,
        requiere_aprobacion,
        numeros_por_institucion
      } = req.body;

      const usuario = req.user;

      // Verificar que la institución puede crear rifas
      const [configInstitucion] = await db.execute(
        'SELECT puede_crear_rifas FROM instituciones_config_rifas WHERE institucion_id = ?',
        [usuario.institucion_id]
      );

      if (!configInstitucion.length || !configInstitucion[0].puede_crear_rifas) {
        return res.status(403).json({
          status: 'error',
          message: 'Tu institución no tiene permisos para crear rifas'
        });
      }

      // Crear la rifa
      const [result] = await db.execute(`
        INSERT INTO rifas (
          nombre, descripcion, institucion_promotora_id, cantidad_numeros,
          precio_numero, fecha_inicio, fecha_fin, fecha_sorteo,
          max_instituciones_participantes, comision_promotora,
          requiere_aprobacion, numeros_por_institucion, creado_por, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador')
      `, [
        nombre, descripcion, usuario.institucion_id, cantidad_numeros,
        precio_numero, fecha_inicio, fecha_fin, fecha_sorteo,
        max_instituciones_participantes, comision_promotora,
        requiere_aprobacion, numeros_por_institucion, usuario.id
      ]);

      const rifaId = result.insertId;

      // Registrar institución promotora como participante automáticamente
      await db.execute(`
        INSERT INTO rifa_participaciones (
          rifa_id, institucion_id, es_promotora, estado_participacion,
          fecha_aprobacion, aprobada_por
        ) VALUES (?, ?, TRUE, 'aprobada', NOW(), ?)
      `, [rifaId, usuario.institucion_id, usuario.id]);

      res.status(201).json({
        status: 'success',
        message: 'Rifa creada exitosamente',
        data: { id: rifaId, nombre }
      });

    } catch (error) {
      console.error('Error al crear rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Listar rifas (con filtros)
  async listarRifas(req, res) {
    try {
      const { estado, institucion_id, page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      let params = [];

      if (estado) {
        whereClause += ' AND r.estado = ?';
        params.push(estado);
      }

      if (institucion_id) {
        whereClause += ' AND (r.institucion_promotora_id = ? OR rp.institucion_id = ?)';
        params.push(institucion_id, institucion_id);
      }

      // Según el rol del usuario, mostrar diferentes rifas
      const usuario = req.user;
      if (usuario.rol === 'vendedor' || usuario.rol === 'admin_institucion') {
        whereClause += ' AND (r.institucion_promotora_id = ? OR rp.institucion_id = ?)';
        params.push(usuario.institucion_id, usuario.institucion_id);
      }

      const [rifas] = await db.execute(`
        SELECT DISTINCT
          r.id,
          r.nombre,
          r.descripcion,
          r.cantidad_numeros,
          r.precio_numero,
          r.fecha_inicio,
          r.fecha_fin,
          r.fecha_sorteo,
          r.estado,
          r.comision_promotora,
          ip.nombre as institucion_promotora,
          COUNT(DISTINCT rp.id) as total_instituciones,
          COUNT(DISTINCT CASE WHEN rp.estado_participacion = 'aprobada' THEN rp.id END) as instituciones_aprobadas,
          COUNT(DISTINCT n.id) as total_numeros_generados,
          COUNT(DISTINCT CASE WHEN n.estado = 'vendido' THEN n.id END) as numeros_vendidos,
          ROUND((COUNT(CASE WHEN n.estado = 'vendido' THEN 1 END) / r.cantidad_numeros) * 100, 2) as porcentaje_vendido
        FROM rifas r
        LEFT JOIN instituciones ip ON r.institucion_promotora_id = ip.id
        LEFT JOIN rifa_participaciones rp ON r.id = rp.rifa_id
        LEFT JOIN numeros n ON r.id = n.rifa_id
        ${whereClause}
        GROUP BY r.id
        ORDER BY r.fecha_creacion DESC
        LIMIT ? OFFSET ?
      `, [...params, parseInt(limit), parseInt(offset)]);

      // Contar total para paginación
      const [totalCount] = await db.execute(`
        SELECT COUNT(DISTINCT r.id) as total
        FROM rifas r
        LEFT JOIN rifa_participaciones rp ON r.id = rp.rifa_id
        ${whereClause}
      `, params);

      res.json({
        status: 'success',
        data: {
          rifas,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount[0].total,
            totalPages: Math.ceil(totalCount[0].total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Error al listar rifas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener rifa específica con detalles completos
  async obtenerRifa(req, res) {
    try {
      const { id } = req.params;

      const [rifas] = await db.execute(`
        SELECT 
          r.*,
          ip.nombre as institucion_promotora,
          ip.logo_url as institucion_promotora_logo,
          u.nombre as creador_nombre,
          u.apellido as creador_apellido
        FROM rifas r
        LEFT JOIN instituciones ip ON r.institucion_promotora_id = ip.id
        LEFT JOIN usuarios u ON r.creado_por = u.id
        WHERE r.id = ?
      `, [id]);

      if (!rifas.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      // Obtener instituciones participantes
      const [participaciones] = await db.execute(`
        SELECT 
          rp.*,
          i.nombre as institucion_nombre,
          i.logo_url as institucion_logo,
          u.nombre as aprobado_por_nombre
        FROM rifa_participaciones rp
        LEFT JOIN instituciones i ON rp.institucion_id = i.id
        LEFT JOIN usuarios u ON rp.aprobada_por = u.id
        WHERE rp.rifa_id = ?
        ORDER BY rp.es_promotora DESC, rp.fecha_solicitud ASC
      `, [id]);

      // Obtener estadísticas de números
      const [estadisticas] = await db.execute(`
        SELECT 
          COUNT(*) as total_numeros,
          SUM(CASE WHEN estado = 'vendido' THEN 1 ELSE 0 END) as vendidos,
          SUM(CASE WHEN estado = 'reservado' THEN 1 ELSE 0 END) as reservados,
          SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) as disponibles,
          SUM(CASE WHEN estado = 'vendido' THEN COALESCE(precio_venta, ?) ELSE 0 END) as total_recaudado
        FROM numeros 
        WHERE rifa_id = ?
      `, [rifas[0].precio_numero, id]);

      const rifa = {
        ...rifas[0],
        participaciones,
        estadisticas: estadisticas[0]
      };

      res.json({
        status: 'success',
        data: rifa
      });

    } catch (error) {
      console.error('Error al obtener rifa:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // ===================================================
  // 2. GESTIÓN DE PARTICIPACIONES
  // ===================================================

  // Solicitar participación en rifa
  async solicitarParticipacion(req, res) {
    try {
      const { rifa_id } = req.params;
      const { observaciones } = req.body;
      const usuario = req.user;

      // Verificar que la rifa existe y está activa
      const [rifas] = await db.execute(
        'SELECT * FROM rifas WHERE id = ? AND estado IN ("activa", "borrador")',
        [rifa_id]
      );

      if (!rifas.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada o no disponible para participación'
        });
      }

      const rifa = rifas[0];

      // Verificar que no esté ya participando
      const [participacionExistente] = await db.execute(
        'SELECT id FROM rifa_participaciones WHERE rifa_id = ? AND institucion_id = ?',
        [rifa_id, usuario.institucion_id]
      );

      if (participacionExistente.length) {
        return res.status(400).json({
          status: 'error',
          message: 'Tu institución ya está participando en esta rifa'
        });
      }

      // Verificar límite de instituciones
      if (rifa.max_instituciones_participantes) {
        const [conteoParticipaciones] = await db.execute(
          'SELECT COUNT(*) as total FROM rifa_participaciones WHERE rifa_id = ? AND estado_participacion = "aprobada"',
          [rifa_id]
        );

        if (conteoParticipaciones[0].total >= rifa.max_instituciones_participantes) {
          return res.status(400).json({
            status: 'error',
            message: 'Esta rifa ya alcanzó el máximo de instituciones participantes'
          });
        }
      }

      // Crear solicitud de participación
      const estadoInicial = rifa.requiere_aprobacion ? 'solicitada' : 'aprobada';
      const fechaAprobacion = rifa.requiere_aprobacion ? null : new Date();

      const [result] = await db.execute(`
        INSERT INTO rifa_participaciones (
          rifa_id, institucion_id, estado_participacion, observaciones,
          fecha_aprobacion, aprobada_por
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        rifa_id, usuario.institucion_id, estadoInicial, observaciones,
        fechaAprobacion, rifa.requiere_aprobacion ? null : usuario.id
      ]);

      res.status(201).json({
        status: 'success',
        message: rifa.requiere_aprobacion 
          ? 'Solicitud de participación enviada. Esperando aprobación.'
          : 'Participación aprobada automáticamente',
        data: { participacion_id: result.insertId }
      });

    } catch (error) {
      console.error('Error al solicitar participación:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Aprobar/rechazar participación (solo promotora)
  async gestionarParticipacion(req, res) {
    try {
      const { participacion_id } = req.params;
      const { accion, observaciones } = req.body; // 'aprobar' o 'rechazar'
      const usuario = req.user;

      // Verificar que la participación existe
      const [participaciones] = await db.execute(`
        SELECT rp.*, r.institucion_promotora_id
        FROM rifa_participaciones rp
        JOIN rifas r ON rp.rifa_id = r.id
        WHERE rp.id = ?
      `, [participacion_id]);

      if (!participaciones.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Participación no encontrada'
        });
      }

      const participacion = participaciones[0];

      // Verificar que el usuario puede gestionar esta participación
      if (usuario.rol !== 'admin_global' && 
          usuario.institucion_id !== participacion.institucion_promotora_id) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para gestionar esta participación'
        });
      }

      const nuevoEstado = accion === 'aprobar' ? 'aprobada' : 'rechazada';
      const fechaAprobacion = accion === 'aprobar' ? new Date() : null;

      await db.execute(`
        UPDATE rifa_participaciones SET
          estado_participacion = ?,
          fecha_aprobacion = ?,
          aprobada_por = ?,
          observaciones = ?
        WHERE id = ?
      `, [nuevoEstado, fechaAprobacion, usuario.id, observaciones, participacion_id]);

      res.json({
        status: 'success',
        message: `Participación ${nuevoEstado} exitosamente`
      });

    } catch (error) {
      console.error('Error al gestionar participación:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // ===================================================
  // 3. GESTIÓN DE NÚMEROS Y ASIGNACIONES
  // ===================================================

  // Generar números para una rifa
  async generarNumeros(req, res) {
    try {
      const { rifa_id } = req.params;
      const usuario = req.user;

      // Verificar permisos
      const [rifas] = await db.execute(`
        SELECT r.*, COUNT(n.id) as numeros_existentes
        FROM rifas r
        LEFT JOIN numeros n ON r.id = n.rifa_id
        WHERE r.id = ? AND (r.institucion_promotora_id = ? OR ? = 'admin_global')
        GROUP BY r.id
      `, [rifa_id, usuario.institucion_id, usuario.rol]);

      if (!rifas.length) {
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para generar números en esta rifa'
        });
      }

      const rifa = rifas[0];

      if (rifa.numeros_existentes > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Los números ya han sido generados para esta rifa'
        });
      }

      // Generar números usando procedimiento almacenado
      await db.execute('CALL GenerarNumerosRifa(?)', [rifa_id]);

      res.json({
        status: 'success',
        message: `${rifa.cantidad_numeros} números generados exitosamente`
      });

    } catch (error) {
      console.error('Error al generar números:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Asignar bloque de números a institución
  async asignarNumerosInstitucion(req, res) {
    try {
      const { rifa_id } = req.params;
      const { participacion_id, numero_desde, numero_hasta } = req.body;
      const usuario = req.user;

      // Verificar permisos y que los números estén disponibles
      const [verificacion] = await db.execute(`
        SELECT 
          r.institucion_promotora_id,
          rp.institucion_id,
          COUNT(n.id) as numeros_ocupados
        FROM rifas r
        JOIN rifa_participaciones rp ON rp.id = ?
        LEFT JOIN numeros n ON n.rifa_id = r.id 
          AND n.numero BETWEEN ? AND ? 
          AND n.participacion_id IS NOT NULL
        WHERE r.id = ?
        GROUP BY r.id, rp.id
      `, [participacion_id, numero_desde, numero_hasta, rifa_id]);

      if (!verificacion.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa o participación no encontrada'
        });
      }

      if (verificacion[0].numeros_ocupados > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Algunos números en este rango ya están asignados'
        });
      }

      // Verificar permisos
      if (usuario.rol !== 'admin_global' && 
          usuario.institucion_id !== verificacion[0].institucion_promotora_id) {
        return res.status(403).json({
          status: 'error',
          message: 'Solo la institución promotora puede asignar números'
        });
      }

      // Actualizar participación con rango asignado
      await db.execute(`
        UPDATE rifa_participaciones SET
          numeros_asignados_desde = ?,
          numeros_asignados_hasta = ?
        WHERE id = ?
      `, [numero_desde, numero_hasta, participacion_id]);

      // Asignar números a la institución
      await db.execute(`
        UPDATE numeros SET
          participacion_id = ?,
          institucion_vendedora_id = ?
        WHERE rifa_id = ? AND numero BETWEEN ? AND ?
      `, [participacion_id, verificacion[0].institucion_id, rifa_id, numero_desde, numero_hasta]);

      res.json({
        status: 'success',
        message: `Números ${numero_desde} a ${numero_hasta} asignados exitosamente`
      });

    } catch (error) {
      console.error('Error al asignar números a institución:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Asignar números a vendedor específico
  async asignarNumerosVendedor(req, res) {
    try {
      const { rifa_id } = req.params;
      const { vendedor_id, numero_desde, numero_hasta } = req.body;
      const usuario = req.user;

      // Verificar que el vendedor pertenece a la institución del usuario
      const [vendedores] = await db.execute(`
        SELECT u.institucion_id, rp.id as participacion_id
        FROM usuarios u
        JOIN rifa_participaciones rp ON rp.institucion_id = u.institucion_id
        WHERE u.id = ? AND rp.rifa_id = ? AND u.rol = 'vendedor'
      `, [vendedor_id, rifa_id]);

      if (!vendedores.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Vendedor no encontrado o no pertenece a una institución participante'
        });
      }

      // Verificar permisos
      if (usuario.rol !== 'admin_global' && 
          usuario.institucion_id !== vendedores[0].institucion_id) {
        return res.status(403).json({
          status: 'error',
          message: 'Solo puedes asignar números a vendedores de tu institución'
        });
      }

      // Verificar que los números están disponibles para la institución
      const [numerosDisponibles] = await db.execute(`
        SELECT COUNT(*) as disponibles
        FROM numeros n
        WHERE n.rifa_id = ? 
          AND n.numero BETWEEN ? AND ?
          AND n.participacion_id = ?
          AND n.asignacion_id IS NULL
          AND n.estado = 'disponible'
      `, [rifa_id, numero_desde, numero_hasta, vendedores[0].participacion_id]);

      const cantidadSolicitada = numero_hasta - numero_desde + 1;
      if (numerosDisponibles[0].disponibles < cantidadSolicitada) {
        return res.status(400).json({
          status: 'error',
          message: 'No hay suficientes números disponibles en este rango para tu institución'
        });
      }

      // Crear asignación
      const [resultAsignacion] = await db.execute(`
        INSERT INTO numero_asignaciones (
          rifa_id, participacion_id, vendedor_id, numero_desde, numero_hasta, asignado_por
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [rifa_id, vendedores[0].participacion_id, vendedor_id, numero_desde, numero_hasta, usuario.id]);

      // Actualizar números con la asignación
      await db.execute(`
        UPDATE numeros SET asignacion_id = ?
        WHERE rifa_id = ? 
          AND numero BETWEEN ? AND ?
          AND participacion_id = ?
          AND asignacion_id IS NULL
        LIMIT ?
      `, [resultAsignacion.insertId, rifa_id, numero_desde, numero_hasta, 
          vendedores[0].participacion_id, cantidadSolicitada]);

      res.json({
        status: 'success',
        message: `${cantidadSolicitada} números asignados al vendedor exitosamente`,
        data: { asignacion_id: resultAsignacion.insertId }
      });

    } catch (error) {
      console.error('Error al asignar números a vendedor:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // ===================================================
  // 4. GESTIÓN DE VENTAS
  // ===================================================

  // Vender número
  async venderNumero(req, res) {
    try {
      const { rifa_id, numero } = req.params;
      const { 
        comprador_nombre, 
        comprador_telefono, 
        metodo_pago, 
        precio_venta,
        observaciones 
      } = req.body;
      const usuario = req.user;

      // Verificar que el número está disponible y asignado al vendedor
      const [numeros] = await db.execute(`
        SELECT n.*, na.vendedor_id, r.precio_numero
        FROM numeros n
        LEFT JOIN numero_asignaciones na ON n.asignacion_id = na.id
        JOIN rifas r ON n.rifa_id = r.id
        WHERE n.rifa_id = ? AND n.numero = ? AND n.estado = 'disponible'
      `, [rifa_id, numero]);

      if (!numeros.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Número no encontrado o no disponible'
        });
      }

      const numeroData = numeros[0];

      // Verificar permisos de venta
      if (usuario.rol === 'vendedor' && numeroData.vendedor_id !== usuario.id) {
        return res.status(403).json({
          status: 'error',
          message: 'Este número no está asignado a ti'
        });
      }

      const precioFinal = precio_venta || numeroData.precio_numero;

      // Registrar venta
      await db.execute(`
        UPDATE numeros SET
          estado = 'vendido',
          comprador_nombre = ?,
          comprador_telefono = ?,
          metodo_pago = ?,
          precio_venta = ?,
          vendedor_id = ?,
          fecha_venta = NOW(),
          observaciones = ?
        WHERE id = ?
      `, [
        comprador_nombre, comprador_telefono, metodo_pago, 
        precioFinal, usuario.id, observaciones, numeroData.id
      ]);

      res.json({
        status: 'success',
        message: 'Número vendido exitosamente',
        data: {
          numero: parseInt(numero),
          comprador: comprador_nombre,
          precio: precioFinal
        }
      });

    } catch (error) {
      console.error('Error al vender número:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Obtener números asignados a un vendedor
  async obtenerNumerosVendedor(req, res) {
    try {
      const { rifa_id } = req.params;
      const { vendedor_id } = req.query;
      const usuario = req.user;

      // Determinar qué vendedor consultar
      const targetVendedor = vendedor_id || usuario.id;

      // Verificar permisos
      if (usuario.rol === 'vendedor' && targetVendedor != usuario.id) {
        return res.status(403).json({
          status: 'error',
          message: 'Solo puedes consultar tus propios números'
        });
      }

      const [numeros] = await db.execute(`
        SELECT 
          n.id,
          n.numero,
          n.estado,
          n.comprador_nombre,
          n.comprador_telefono,
          n.metodo_pago,
          n.precio_venta,
          n.fecha_venta,
          r.precio_numero,
          na.numero_desde,
          na.numero_hasta
        FROM numeros n
        JOIN numero_asignaciones na ON n.asignacion_id = na.id
        JOIN rifas r ON n.rifa_id = r.id
        WHERE n.rifa_id = ? AND na.vendedor_id = ?
        ORDER BY n.numero ASC
      `, [rifa_id, targetVendedor]);

      res.json({
        status: 'success',
        data: numeros
      });

    } catch (error) {
      console.error('Error al obtener números del vendedor:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // ===================================================
  // 5. REPORTES Y ESTADÍSTICAS
  // ===================================================

  // Reporte de ventas por institución
  async reporteVentasInstitucion(req, res) {
    try {
      const { rifa_id } = req.params;
      const usuario = req.user;

      const [reporte] = await db.execute(`
        SELECT 
          i.nombre as institucion,
          rp.es_promotora,
          COUNT(n.id) as total_numeros_asignados,
          SUM(CASE WHEN n.estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos,
          SUM(CASE WHEN n.estado = 'vendido' THEN COALESCE(n.precio_venta, r.precio_numero) ELSE 0 END) as total_recaudado,
          rp.comision_acordada,
          ROUND(
            SUM(CASE WHEN n.estado = 'vendido' THEN COALESCE(n.precio_venta, r.precio_numero) ELSE 0 END) * 
            rp.comision_acordada / 100, 2
          ) as comision_monto,
          ROUND(
            SUM(CASE WHEN n.estado = 'vendido' THEN COALESCE(n.precio_venta, r.precio_numero) ELSE 0 END) * 
            (1 - rp.comision_acordada / 100), 2
          ) as monto_liquido
        FROM rifa_participaciones rp
        JOIN instituciones i ON rp.institucion_id = i.id
        JOIN rifas r ON rp.rifa_id = r.id
        LEFT JOIN numeros n ON n.participacion_id = rp.id
        WHERE rp.rifa_id = ?
        GROUP BY rp.id
        ORDER BY total_recaudado DESC
      `, [rifa_id]);

      res.json({
        status: 'success',
        data: reporte
      });

    } catch (error) {
      console.error('Error al generar reporte:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  },

  // Estadísticas generales de la rifa
  async estadisticasRifa(req, res) {
    try {
      const { rifa_id } = req.params;

      const [estadisticas] = await db.execute(`
        SELECT 
          r.nombre,
          r.cantidad_numeros,
          r.precio_numero,
          r.estado,
          COUNT(DISTINCT rp.id) as instituciones_participantes,
          COUNT(DISTINCT na.vendedor_id) as vendedores_activos,
          COUNT(n.id) as numeros_generados,
          SUM(CASE WHEN n.estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos,
          SUM(CASE WHEN n.estado = 'reservado' THEN 1 ELSE 0 END) as numeros_reservados,
          SUM(CASE WHEN n.estado = 'disponible' THEN 1 ELSE 0 END) as numeros_disponibles,
          SUM(CASE WHEN n.estado = 'vendido' THEN COALESCE(n.precio_venta, r.precio_numero) ELSE 0 END) as total_recaudado,
          (r.cantidad_numeros * r.precio_numero) as total_potencial,
          ROUND(
            (SUM(CASE WHEN n.estado = 'vendido' THEN 1 ELSE 0 END) / r.cantidad_numeros) * 100, 2
          ) as porcentaje_vendido
        FROM rifas r
        LEFT JOIN rifa_participaciones rp ON r.id = rp.rifa_id AND rp.estado_participacion = 'aprobada'
        LEFT JOIN numeros n ON r.id = n.rifa_id
        LEFT JOIN numero_asignaciones na ON n.asignacion_id = na.id
        WHERE r.id = ?
        GROUP BY r.id
      `, [rifa_id]);

      if (!estadisticas.length) {
        return res.status(404).json({
          status: 'error',
          message: 'Rifa no encontrada'
        });
      }

      res.json({
        status: 'success',
        data: estadisticas[0]
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error interno del servidor'
      });
    }
  }
};

// =====================================================
// VALIDACIONES PARA ENDPOINTS
// =====================================================

export const rifasValidations = {
  crearRifa: [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('cantidad_numeros').isInt({ min: 1 }).withMessage('La cantidad de números debe ser mayor a 0'),
    body('precio_numero').isFloat({ min: 0.01 }).withMessage('El precio debe ser mayor a 0'),
    body('fecha_inicio').isDate().withMessage('Fecha de inicio inválida'),
    body('fecha_fin').isDate().withMessage('Fecha de fin inválida')
  ],
  
  venderNumero: [
    body('comprador_nombre').notEmpty().withMessage('El nombre del comprador es requerido'),
    body('comprador_telefono').optional().isMobilePhone('any'),
    body('metodo_pago').isIn(['efectivo', 'transferencia', 'tarjeta', 'mercadopago'])
  ]
};

export default rifasController;