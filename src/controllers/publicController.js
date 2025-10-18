// =====================================================
// CONTROLADOR PÚBLICO
// Endpoints públicos sin autenticación para vistas compartidas
// =====================================================

import db from '../config/db.js';

/**
 * Obtiene el detalle completo de un número específico (vista pública)
 * Incluye toda la información necesaria para generar el link de WhatsApp
 * 
 * @route GET /public/rifas/:rifaId/numeros/:numeroId
 * @access Public
 */
export const getNumeroDetalle = async (req, res) => {
  try {
    const { rifaId, numeroId } = req.params;

    console.log(`📱 Solicitando detalle público del número ${numeroId} de rifa ${rifaId}`);

    // Buscar el número con todas sus relaciones
    const [numeros] = await db.execute(`
      SELECT 
        nr.id,
        nr.numero,
        nr.estado,
        nr.precio_venta,
        nr.fecha_venta,
        nr.fecha_reserva,
        
        -- Datos de la rifa
        r.id as rifa_id,
        r.nombre as rifa_nombre,
        r.descripcion as rifa_descripcion,
        r.precio_numero as rifa_precio,
        r.fecha_sorteo as rifa_fecha_sorteo,
        r.fecha_inicio as rifa_fecha_inicio,
        r.estado as rifa_estado,
        r.imagen_url as rifa_imagen,
        
        -- Datos del vendedor (INCLUYE TELÉFONO para WhatsApp)
        v.id as vendedor_id,
        v.nombre as vendedor_nombre,
        v.apellido as vendedor_apellido,
        v.telefono as vendedor_telefono,
        v.email as vendedor_email,
        
        -- Datos del comprador (solo si está vendido)
        c.id as comprador_id,
        c.nombre as comprador_nombre,
        c.apellido as comprador_apellido,
        
        -- Institución promotora
        i.nombre as institucion_nombre
        
      FROM numeros_rifa nr
      INNER JOIN rifas r ON nr.rifa_id = r.id
      LEFT JOIN usuarios v ON nr.vendedor_id = v.id
      LEFT JOIN usuarios c ON nr.participante_id = c.id
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      
      WHERE nr.numero = ? AND nr.rifa_id = ?
      LIMIT 1
    `, [numeroId, rifaId]);

    // Validar que el número existe
    if (!numeros || numeros.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Número no encontrado'
      });
    }

    const numero = numeros[0];

    // Validar que la rifa no esté cancelada
    if (numero.rifa_estado === 'cancelada') {
      return res.status(400).json({
        success: false,
        message: 'Esta rifa ha sido cancelada'
      });
    }

    // Obtener los premios de la rifa
    const [premios] = await db.execute(`
      SELECT 
        id,
        orden,
        descripcion,
        valor_estimado
      FROM premios
      WHERE rifa_id = ?
      ORDER BY orden ASC
    `, [rifaId]);

    // Formatear la respuesta
    const response = {
      id: numero.id,
      numero: numero.numero,
      estado: numero.estado,
      precio_pagado: numero.precio_venta,
      fecha_venta: numero.fecha_venta,
      fecha_reserva: numero.fecha_reserva,
      
      rifa: {
        id: numero.rifa_id,
        nombre: numero.rifa_nombre,
        descripcion: numero.rifa_descripcion,
        precio_numero: parseFloat(numero.rifa_precio),
        fecha_sorteo: numero.rifa_fecha_sorteo,
        fecha_inicio: numero.rifa_fecha_inicio,
        estado: numero.rifa_estado,
        imagen_url: numero.rifa_imagen,
        institucion: numero.institucion_nombre,
        premios: premios.map(p => ({
          id: p.id,
          posicion: p.posicion,
          descripcion: p.descripcion,
          valor: p.valor ? parseFloat(p.valor) : null
        }))
      },
      
      vendedor: numero.vendedor_id ? {
        id: numero.vendedor_id,
        nombre: `${numero.vendedor_nombre} ${numero.vendedor_apellido}`,
        telefono: numero.vendedor_telefono,
        email: numero.vendedor_email
      } : null,
      
      comprador: numero.comprador_id ? {
        id: numero.comprador_id,
        nombre: `${numero.comprador_nombre} ${numero.comprador_apellido}`
      } : null
    };

    console.log(`✅ Detalle del número ${numeroId} obtenido correctamente`);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('❌ Error al obtener detalle del número público:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el detalle del número',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene información pública de una rifa
 * 
 * @route GET /public/rifas/:rifaId
 * @access Public
 */
export const getRifaPublica = async (req, res) => {
  try {
    const { rifaId } = req.params;

    console.log(`🎯 Solicitando información pública de la rifa ${rifaId}`);

    const [rifas] = await db.execute(`
      SELECT 
        r.id,
        r.nombre,
        r.descripcion,
        r.precio_numero,
        r.cantidad_numeros,
        r.fecha_sorteo,
        r.fecha_inicio,
        r.estado,
        r.imagen_url,
        r.reglas,
        i.nombre as institucion_nombre,
        i.descripcion as institucion_descripcion,
        
        -- Estadísticas
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido') as numeros_vendidos,
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'reservado') as numeros_reservados,
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'disponible') as numeros_disponibles
        
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      WHERE r.id = ?
      LIMIT 1
    `, [rifaId]);

    if (!rifas || rifas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rifa no encontrada'
      });
    }

    const rifa = rifas[0];

    // Obtener premios
    const [premios] = await db.execute(`
      SELECT id, posicion, descripcion, valor
      FROM premios
      WHERE rifa_id = ?
      ORDER BY posicion ASC
    `, [rifaId]);

    const response = {
      id: rifa.id,
      nombre: rifa.nombre,
      descripcion: rifa.descripcion,
      precio_numero: parseFloat(rifa.precio_numero),
      cantidad_numeros: rifa.cantidad_numeros,
      fecha_sorteo: rifa.fecha_sorteo,
      fecha_inicio: rifa.fecha_inicio,
      estado: rifa.estado,
      imagen_url: rifa.imagen_url,
      reglas: rifa.reglas,
      institucion: {
        nombre: rifa.institucion_nombre,
        descripcion: rifa.institucion_descripcion
      },
      estadisticas: {
        vendidos: parseInt(rifa.numeros_vendidos),
        reservados: parseInt(rifa.numeros_reservados),
        disponibles: parseInt(rifa.numeros_disponibles),
        total: rifa.cantidad_numeros,
        porcentaje_vendido: ((parseInt(rifa.numeros_vendidos) / rifa.cantidad_numeros) * 100).toFixed(2)
      },
      premios: premios.map(p => ({
        id: p.id,
        posicion: p.posicion,
        descripcion: p.descripcion,
        valor: p.valor ? parseFloat(p.valor) : null
      }))
    };

    console.log(`✅ Información de la rifa ${rifaId} obtenida correctamente`);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('❌ Error al obtener rifa pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la rifa',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene los IDs de números que tienen vendedor asignado
 */
export const getNumerosConVendedor = async (req, res) => {
  try {
    const { rifaId } = req.params;

    console.log(`📱 Obteniendo números con vendedor de rifa ${rifaId}`);

    const [numeros] = await db.execute(`
      SELECT DISTINCT nr.id
      FROM numeros_rifa nr
      INNER JOIN vendedor_numeros vn ON vn.numero_id = nr.id
      WHERE nr.rifa_id = ?
    `, [rifaId]);

    const ids = numeros.map(n => n.id);

    console.log(`✅ ${ids.length} números con vendedor asignado`);

    res.json({
      success: true,
      data: ids,
      total: ids.length
    });

  } catch (error) {
    console.error('❌ Error al obtener números con vendedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener números con vendedor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtener SOLO números disponibles con vendedor asignado (súper rápido)
 * 
 * @route GET /public/rifas/:rifaId/numeros-disponibles
 * @access Public
 */
export const getNumerosDisponiblesConVendedor = async (req, res) => {
  try {
    const { rifaId } = req.params;
    const { limit = 100, aleatorios = 'false' } = req.query;

    console.log(`⚡ Obteniendo números disponibles con vendedor de rifa ${rifaId}`);

    let query = `
      SELECT 
        n.id,
        n.numero,
        n.estado,
        n.qr_code,
        COALESCE(n.precio_venta, r.precio_numero) as precio_venta
      FROM numeros_rifa n
      INNER JOIN rifas r ON n.rifa_id = r.id
      INNER JOIN vendedor_numeros vn ON vn.numero_id = n.id
      WHERE n.rifa_id = ? 
      AND n.estado = 'disponible'
    `;

    // Si se piden aleatorios, ordenar random
    if (aleatorios === 'true') {
      query += ` ORDER BY RAND()`;
    } else {
      query += ` ORDER BY n.numero ASC`;
    }

    query += ` LIMIT ?`;

    const [numeros] = await db.execute(query, [rifaId, parseInt(limit)]);

    // Contar total de disponibles con vendedor
    const [totalResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM numeros_rifa n
      INNER JOIN vendedor_numeros vn ON vn.numero_id = n.id
      WHERE n.rifa_id = ? 
      AND n.estado = 'disponible'
    `, [rifaId]);

    const total = totalResult[0].total;

    console.log(`✅ ${numeros.length} números disponibles de ${total} totales`);

    res.json({
      success: true,
      data: {
        numeros: numeros,
        total: total,
        mostrando: numeros.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener números disponibles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtener TODOS los números de una rifa con sus datos completos
 * 
 * @route GET /public/rifas/:rifaId/numeros
 * @access Public
 */
export const getNumerosRifaPublica = async (req, res) => {
  try {
    const { rifaId } = req.params;
    const { estado, page = 1, limit = 1000 } = req.query;

    console.log(`📋 Obteniendo números públicos de rifa ${rifaId}`);

    // Calcular offset para paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Query base
    let whereClause = 'WHERE n.rifa_id = ?';
    let queryParams = [rifaId];

    // Filtro por estado si se proporciona
    if (estado && estado !== 'todos') {
      whereClause += ' AND n.estado = ?';
      queryParams.push(estado);
    }

    // Obtener números con toda la info
    const [numeros] = await db.execute(`
      SELECT 
        n.id,
        n.numero,
        n.estado,
        n.qr_code,
        COALESCE(n.precio_venta, r.precio_numero) as precio_venta
      FROM numeros_rifa n
      INNER JOIN rifas r ON n.rifa_id = r.id
      ${whereClause}
      ORDER BY n.numero ASC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);

    // Contar total
    const [totalResult] = await db.execute(`
      SELECT COUNT(*) as total
      FROM numeros_rifa n
      ${whereClause}
    `, queryParams);

    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    console.log(`✅ ${numeros.length} números obtenidos de ${total} totales`);

    res.json({
      success: true,
      data: {
        numeros: numeros,
        total: total
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: totalPages,
        total: total
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo números públicos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los números',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene todos los números de una rifa (vista pública)
 * Solo devuelve información básica para mostrar disponibilidad
 * 
 * @route GET /public/rifas/:rifaId/numeros
 * @access Public
 */
export const getNumerosRifa = async (req, res) => {
  try {
    const { rifaId } = req.params;

    console.log(`🔢 Solicitando números públicos de la rifa ${rifaId}`);

    const [numeros] = await db.execute(`
      SELECT 
        id,
        numero,
        estado
      FROM numeros_rifa
      WHERE rifa_id = ?
      ORDER BY numero ASC
    `, [rifaId]);

    console.log(`✅ ${numeros.length} números obtenidos de la rifa ${rifaId}`);

    res.json({
      success: true,
      data: numeros,
      total: numeros.length
    });

  } catch (error) {
    console.error('❌ Error al obtener números públicos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los números',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene todas las rifas activas (vista pública)
 * 
 * @route GET /public/rifas
 * @access Public
 */
export const getRifasPublicas = async (req, res) => {
  try {
    console.log('🎯 Solicitando lista de rifas públicas');

    const [rifas] = await db.execute(`
      SELECT 
        r.id,
        r.nombre,
        r.descripcion,
        r.precio_numero,
        r.cantidad_numeros,
        r.fecha_sorteo,
        r.fecha_inicio,
        r.estado,
        r.imagen_url,
        i.nombre as institucion_nombre,
        
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido') as numeros_vendidos,
        (SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'disponible') as numeros_disponibles
        
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      WHERE r.estado IN ('activa', 'planificada')
      ORDER BY r.fecha_sorteo ASC
    `);

    const rifasFormateadas = rifas.map(r => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      precio_numero: parseFloat(r.precio_numero),
      cantidad_numeros: r.cantidad_numeros,
      fecha_sorteo: r.fecha_sorteo,
      fecha_inicio: r.fecha_inicio,
      estado: r.estado,
      imagen_url: r.imagen_url,
      institucion: r.institucion_nombre,
      estadisticas: {
        vendidos: parseInt(r.numeros_vendidos),
        disponibles: parseInt(r.numeros_disponibles),
        porcentaje_vendido: ((parseInt(r.numeros_vendidos) / r.cantidad_numeros) * 100).toFixed(2)
      }
    }));

    console.log(`✅ ${rifasFormateadas.length} rifas públicas obtenidas`);

    res.json({
      success: true,
      data: rifasFormateadas,
      total: rifasFormateadas.length
    });

  } catch (error) {
    console.error('❌ Error al obtener rifas públicas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las rifas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};