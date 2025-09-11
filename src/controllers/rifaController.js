// src/controllers/rifaController.js - VERSIÓN COMPLETA Y LIMPIA
import db from '../config/db.js';

// Obtener todas las rifas con filtros
export const obtenerRifas = async (req, res) => {
  try {
    const { estado, institucion_id } = req.query;
    
    let query = `
      SELECT r.*, 
             r.nombre as titulo,
             r.cantidad_numeros as total_numeros,
             r.fecha_creacion as created_at,
             r.fecha_actualizacion as updated_at,
             i.nombre as institucion_nombre, 
             i.logo_url as institucion_logo,
             u.nombre as creador_nombre,
             COUNT(nr.id) as numeros_vendidos
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_id = i.id
      LEFT JOIN usuarios u ON r.creado_por = u.id
      LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id AND nr.estado = 'vendido'
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      query += ' AND r.estado = ?';
      params.push(estado);
    }
    
    if (institucion_id) {
      query += ' AND r.institucion_id = ?';
      params.push(institucion_id);
    }
    
    query += ' GROUP BY r.id ORDER BY r.fecha_creacion DESC';
    
    const [rifas] = await db.execute(query, params);
    
    const rifasConEstadisticas = rifas.map(rifa => ({
      ...rifa,
      numeros_disponibles: rifa.total_numeros - rifa.numeros_vendidos,
      porcentaje_vendido: ((rifa.numeros_vendidos / rifa.total_numeros) * 100).toFixed(2),
      recaudado: (rifa.numeros_vendidos * rifa.precio_numero).toFixed(2),
      total_potencial: (rifa.total_numeros * rifa.precio_numero).toFixed(2)
    }));
    
    res.json({
      success: true,
      data: rifasConEstadisticas,
      message: 'Rifas obtenidas exitosamente'
    });
    
  } catch (error) {
    console.error('Error al obtener rifas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Crear nueva rifa
export const crearRifa = async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      precio_numero,
      total_numeros,
      fecha_inicio,
      fecha_fin,
      fecha_sorteo,
      institucion_id,
      imagen_url
    } = req.body;
    
    const creado_por = req.user.id;
    
    // Validaciones básicas
    if (!titulo || !precio_numero || !total_numeros || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        success: false,
        message: 'Campos obligatorios: titulo, precio_numero, total_numeros, fecha_inicio, fecha_fin'
      });
    }
    
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Crear la rifa
      const [result] = await connection.execute(`
        INSERT INTO rifas (
          nombre, descripcion, precio_numero, cantidad_numeros,
          fecha_inicio, fecha_fin, fecha_sorteo, institucion_id, 
          creado_por, imagen_url, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa')
      `, [titulo, descripcion, precio_numero, total_numeros, fecha_inicio, fecha_fin, fecha_sorteo, institucion_id, creado_por, imagen_url]);
      
      const rifaId = result.insertId;
      
      // Crear números de la rifa
      const numerosValues = [];
      for (let i = 1; i <= total_numeros; i++) {
        const qrCode = `QR-${rifaId}-${i}-${Date.now()}`;
        numerosValues.push([rifaId, i, qrCode]);
      }
      
      const placeholders = numerosValues.map(() => '(?, ?, ?)').join(', ');
      const flatValues = numerosValues.flat();
      
      await connection.execute(`
        INSERT INTO numeros_rifa (rifa_id, numero, qr_code) VALUES ${placeholders}
      `, flatValues);
      
      await connection.commit();
      
      const [rifaCreada] = await db.execute(`
        SELECT r.*, 
               r.nombre as titulo,
               r.cantidad_numeros as total_numeros,
               i.nombre as institucion_nombre
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_id = i.id
        WHERE r.id = ?
      `, [rifaId]);
      
      res.status(201).json({
        success: true,
        data: rifaCreada[0],
        message: 'Rifa creada exitosamente'
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Error al crear rifa:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener rifa por ID
export const obtenerRifaPorId = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rifas] = await db.execute(`
      SELECT r.*, 
             r.nombre as titulo,
             r.cantidad_numeros as total_numeros,
             i.nombre as institucion_nombre
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_id = i.id
      WHERE r.id = ?
    `, [id]);
    
    if (rifas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rifa no encontrada'
      });
    }
    
    const [estadisticas] = await db.execute(`
      SELECT 
        COUNT(*) as total_numeros,
        SUM(CASE WHEN estado = 'vendido' THEN 1 ELSE 0 END) as vendidos,
        SUM(CASE WHEN estado = 'reservado' THEN 1 ELSE 0 END) as reservados,
        SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) as disponibles
      FROM numeros_rifa
      WHERE rifa_id = ?
    `, [id]);
    
    const rifa = {
      ...rifas[0],
      estadisticas: estadisticas[0]
    };
    
    res.json({
      success: true,
      data: rifa,
      message: 'Rifa obtenida exitosamente'
    });
    
  } catch (error) {
    console.error('Error al obtener rifa:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener números de una rifa
export const obtenerNumerosRifa = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.query;
    
    let query = `
      SELECT nr.*, u.nombre as comprador_nombre
      FROM numeros_rifa nr
      LEFT JOIN usuarios u ON nr.comprador_id = u.id
      WHERE nr.rifa_id = ?
    `;
    
    const params = [id];
    
    if (estado) {
      query += ' AND nr.estado = ?';
      params.push(estado);
    }
    
    query += ' ORDER BY nr.numero ASC';
    
    const [numeros] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: numeros,
      message: 'Números obtenidos exitosamente'
    });
    
  } catch (error) {
    console.error('Error al obtener números:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Comprar números
export const comprarNumeros = async (req, res) => {
  try {
    const { id } = req.params;
    const { numeros } = req.body;
    const comprador_id = req.user.id;
    
    if (!numeros || !Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar al menos un número para comprar'
      });
    }
    
    const [rifas] = await db.execute(`
      SELECT * FROM rifas WHERE id = ? AND estado = 'activa'
    `, [id]);
    
    if (rifas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rifa no encontrada o no está activa'
      });
    }
    
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const placeholders = numeros.map(() => '?').join(',');
      const [numerosDisponibles] = await connection.execute(`
        SELECT numero FROM numeros_rifa 
        WHERE rifa_id = ? AND numero IN (${placeholders}) AND estado = 'disponible'
      `, [id, ...numeros]);
      
      if (numerosDisponibles.length !== numeros.length) {
        await connection.rollback();
        const disponibles = numerosDisponibles.map(n => n.numero);
        const noDisponibles = numeros.filter(n => !disponibles.includes(n));
        
        return res.status(400).json({
          success: false,
          message: `Los siguientes números no están disponibles: ${noDisponibles.join(', ')}`
        });
      }
      
      await connection.execute(`
        UPDATE numeros_rifa 
        SET estado = 'vendido', comprador_id = ?, fecha_venta = NOW()
        WHERE rifa_id = ? AND numero IN (${placeholders})
      `, [comprador_id, id, ...numeros]);
      
      await connection.commit();
      
      const totalPagado = numeros.length * rifas[0].precio_numero;
      
      res.json({
        success: true,
        data: {
          rifa_id: id,
          numeros_comprados: numeros,
          cantidad: numeros.length,
          precio_unitario: rifas[0].precio_numero,
          total_pagado: totalPagado
        },
        message: `Compra realizada exitosamente. ${numeros.length} números adquiridos.`
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Error al comprar números:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar rifa
export const actualizarRifa = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const [rifas] = await db.execute('SELECT * FROM rifas WHERE id = ?', [id]);
    
    if (rifas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rifa no encontrada'
      });
    }
    
    const camposPermitidos = {
      'titulo': 'nombre',
      'descripcion': 'descripcion', 
      'fecha_fin': 'fecha_fin',
      'estado': 'estado'
    };
    
    const campos = [];
    const valores = [];
    
    for (const [campoFrontend, valorFrontend] of Object.entries(updates)) {
      const campoBD = camposPermitidos[campoFrontend];
      if (campoBD) {
        campos.push(`${campoBD} = ?`);
        valores.push(valorFrontend);
      }
    }
    
    if (campos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }
    
    valores.push(id);
    
    await db.execute(`
      UPDATE rifas SET ${campos.join(', ')}, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = ?
    `, valores);
    
    const [rifaActualizada] = await db.execute(`
      SELECT r.*, r.nombre as titulo, i.nombre as institucion_nombre
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_id = i.id
      WHERE r.id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: rifaActualizada[0],
      message: 'Rifa actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar rifa:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar rifa
export const eliminarRifa = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rifas] = await db.execute('SELECT * FROM rifas WHERE id = ?', [id]);
    
    if (rifas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rifa no encontrada'
      });
    }
    
    const [numerosVendidos] = await db.execute(`
      SELECT COUNT(*) as vendidos FROM numeros_rifa 
      WHERE rifa_id = ? AND estado = 'vendido'
    `, [id]);
    
    if (numerosVendidos[0].vendidos > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar una rifa que ya tiene números vendidos'
      });
    }
    
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      await connection.execute('DELETE FROM numeros_rifa WHERE rifa_id = ?', [id]);
      await connection.execute('DELETE FROM rifas WHERE id = ?', [id]);
      
      await connection.commit();
      
      res.json({
        success: true,
        message: 'Rifa eliminada exitosamente'
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Error al eliminar rifa:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener mis rifas
export const obtenerMisRifas = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.rol;
    
    let query = '';
    let params = [];
    
    if (userRole === 'admin_global') {
      query = `
        SELECT r.*, 
               r.nombre as titulo,
               r.cantidad_numeros as total_numeros,
               i.nombre as institucion_nombre,
               COUNT(nr.id) as numeros_vendidos
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_id = i.id
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id AND nr.estado = 'vendido'
        GROUP BY r.id
        ORDER BY r.fecha_creacion DESC
      `;
    } else if (userRole === 'admin_institucion') {
      query = `
        SELECT r.*, 
               r.nombre as titulo,
               r.cantidad_numeros as total_numeros,
               i.nombre as institucion_nombre,
               COUNT(nr.id) as numeros_vendidos
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_id = i.id
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id AND nr.estado = 'vendido'
        WHERE r.institucion_id = ?
        GROUP BY r.id
        ORDER BY r.fecha_creacion DESC
      `;
      params = [req.user.institucion_id];
    } else {
      query = `
        SELECT DISTINCT r.*, 
               r.nombre as titulo,
               r.cantidad_numeros as total_numeros,
               i.nombre as institucion_nombre,
               COUNT(nr.id) as numeros_vendidos
        FROM rifas r
        LEFT JOIN instituciones i ON r.institucion_id = i.id
        LEFT JOIN numeros_rifa nr ON r.id = nr.rifa_id AND nr.estado = 'vendido'
        INNER JOIN numeros_rifa nr2 ON r.id = nr2.rifa_id AND nr2.comprador_id = ?
        GROUP BY r.id
        ORDER BY r.fecha_creacion DESC
      `;
      params = [userId];
    }
    
    const [rifas] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: rifas,
      message: 'Rifas obtenidas exitosamente'
    });
    
  } catch (error) {
    console.error('Error al obtener mis rifas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};