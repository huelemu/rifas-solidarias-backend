// =====================================================
// MODELO COMPLETO - RIFAS MULTI-INSTITUCIÓN
// src/models/Rifa.js
// =====================================================

import db from '../config/db.js';

export class Rifa {
  constructor(data = {}) {
    this.id = data.id || null;
    this.nombre = data.nombre || '';
    this.descripcion = data.descripcion || '';
    this.institucion_promotora_id = data.institucion_promotora_id || null;
    this.cantidad_numeros = data.cantidad_numeros || 0;
    this.precio_numero = data.precio_numero || 0;
    this.fecha_inicio = data.fecha_inicio || null;
    this.fecha_fin = data.fecha_fin || null;
    this.fecha_sorteo = data.fecha_sorteo || null;
    this.fecha_limite_participacion = data.fecha_limite_participacion || null;
    this.max_instituciones_participantes = data.max_instituciones_participantes || null;
    this.comision_promotora = data.comision_promotora || 10.00;
    this.requiere_aprobacion = data.requiere_aprobacion || false;
    this.numeros_por_institucion = data.numeros_por_institucion || null;
    this.estado = data.estado || 'borrador';
    this.creado_por = data.creado_por || null;
    this.numero_ganador = data.numero_ganador || null;
    this.fecha_sorteo_realizado = data.fecha_sorteo_realizado || null;
    this.imagen_url = data.imagen_url || null;
    this.bases_condiciones = data.bases_condiciones || null;
    this.observaciones = data.observaciones || null;
    this.fecha_creacion = data.fecha_creacion || null;
    this.fecha_actualizacion = data.fecha_actualizacion || null;
  }

  // =====================================================
  // MÉTODOS ESTÁTICOS - OPERACIONES CRUD
  // =====================================================

  /**
   * Crear nueva rifa
   */
  static async crear(data) {
    const rifa = new Rifa(data);
    
    const query = `
      INSERT INTO rifas (
        nombre, descripcion, institucion_promotora_id, cantidad_numeros,
        precio_numero, fecha_inicio, fecha_fin, fecha_sorteo,
        fecha_limite_participacion, max_instituciones_participantes,
        comision_promotora, requiere_aprobacion, numeros_por_institucion,
        estado, creado_por, imagen_url, bases_condiciones, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await db.execute(query, [
        rifa.nombre, rifa.descripcion, rifa.institucion_promotora_id,
        rifa.cantidad_numeros, rifa.precio_numero, rifa.fecha_inicio,
        rifa.fecha_fin, rifa.fecha_sorteo, rifa.fecha_limite_participacion,
        rifa.max_instituciones_participantes, rifa.comision_promotora,
        rifa.requiere_aprobacion, rifa.numeros_por_institucion,
        rifa.estado, rifa.creado_por, rifa.imagen_url,
        rifa.bases_condiciones, rifa.observaciones
      ]);

      // Obtener la rifa creada
      const rifaCreada = await this.obtenerPorId(result.insertId);
      
      // Crear participación automática de la institución promotora
      await this.crearParticipacionPromotora(result.insertId, rifa.institucion_promotora_id, rifa.creado_por);
      
      return rifaCreada;
    } catch (error) {
      console.error('Error al crear rifa:', error);
      throw error;
    }
  }

  /**
   * Obtener rifa por ID con información completa
   */
  static async obtenerPorId(id) {
    const query = `
      SELECT 
        r.*,
        i.nombre as institucion_promotora_nombre,
        i.email as institucion_promotora_email,
        u.nombre as creador_nombre,
        u.apellido as creador_apellido,
        (SELECT COUNT(*) FROM rifa_participaciones rp WHERE rp.rifa_id = r.id AND rp.estado_participacion = 'aprobada') as total_participantes,
        (SELECT COUNT(*) FROM numeros_rifa nr WHERE nr.rifa_id = r.id AND nr.estado = 'vendido') as numeros_vendidos,
        (SELECT SUM(nr.precio_venta) FROM numeros_rifa nr WHERE nr.rifa_id = r.id AND nr.estado = 'vendido') as total_recaudado
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      LEFT JOIN usuarios u ON r.creado_por = u.id
      WHERE r.id = ?
    `;

    try {
      const [rows] = await db.execute(query, [id]);
      return rows.length > 0 ? new Rifa(rows[0]) : null;
    } catch (error) {
      console.error('Error al obtener rifa:', error);
      throw error;
    }
  }

  /**
   * Listar rifas con filtros
   */
  static async listar(filtros = {}) {
    let query = `
      SELECT 
        r.*,
        i.nombre as institucion_promotora_nombre,
        (SELECT COUNT(*) FROM rifa_participaciones rp WHERE rp.rifa_id = r.id AND rp.estado_participacion = 'aprobada') as total_participantes,
        (SELECT COUNT(*) FROM numeros_rifa nr WHERE nr.rifa_id = r.id AND nr.estado = 'vendido') as numeros_vendidos
      FROM rifas r
      LEFT JOIN instituciones i ON r.institucion_promotora_id = i.id
      WHERE 1=1
    `;

    const params = [];

    // Aplicar filtros
    if (filtros.estado) {
      query += ' AND r.estado = ?';
      params.push(filtros.estado);
    }

    if (filtros.institucion_id) {
      query += ' AND (r.institucion_promotora_id = ? OR EXISTS (SELECT 1 FROM rifa_participaciones rp WHERE rp.rifa_id = r.id AND rp.institucion_id = ? AND rp.estado_participacion = "aprobada"))';
      params.push(filtros.institucion_id, filtros.institucion_id);
    }

    if (filtros.creado_por) {
      query += ' AND r.creado_por = ?';
      params.push(filtros.creado_por);
    }

    if (filtros.activas_solo) {
      query += ' AND r.estado = "activa" AND r.fecha_fin >= CURDATE()';
    }

    // Ordenamiento
    query += ' ORDER BY r.fecha_creacion DESC';

    // Paginación
    if (filtros.limite) {
      query += ' LIMIT ?';
      params.push(parseInt(filtros.limite));
      
      if (filtros.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filtros.offset));
      }
    }

    try {
      const [rows] = await db.execute(query, params);
      return rows.map(row => new Rifa(row));
    } catch (error) {
      console.error('Error al listar rifas:', error);
      throw error;
    }
  }

  /**
   * Actualizar rifa
   */
  static async actualizar(id, data) {
    const campos = [];
    const params = [];

    // Construir query dinámicamente
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && key !== 'id') {
        campos.push(`${key} = ?`);
        params.push(data[key]);
      }
    });

    if (campos.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    params.push(id);
    
    const query = `UPDATE rifas SET ${campos.join(', ')} WHERE id = ?`;

    try {
      const [result] = await db.execute(query, params);
      
      if (result.affectedRows === 0) {
        throw new Error('Rifa no encontrada');
      }

      return await this.obtenerPorId(id);
    } catch (error) {
      console.error('Error al actualizar rifa:', error);
      throw error;
    }
  }

  /**
   * Eliminar rifa (soft delete)
   */
  static async eliminar(id) {
    try {
      const [result] = await db.execute(
        'UPDATE rifas SET estado = "cancelada" WHERE id = ?',
        [id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error al eliminar rifa:', error);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS DE PARTICIPACIONES
  // =====================================================

  /**
   * Crear participación automática de la promotora
   */
  static async crearParticipacionPromotora(rifaId, institucionId, usuarioId) {
    const query = `
      INSERT INTO rifa_participaciones (
        rifa_id, institucion_id, es_promotora, estado_participacion,
        fecha_aprobacion, aprobada_por, comision_acordada
      ) VALUES (?, ?, TRUE, 'aprobada', NOW(), ?, 0.00)
    `;

    try {
      await db.execute(query, [rifaId, institucionId, usuarioId]);
    } catch (error) {
      console.error('Error al crear participación promotora:', error);
      throw error;
    }
  }

  /**
   * Obtener participaciones de una rifa
   */
  static async obtenerParticipaciones(rifaId) {
    const query = `
      SELECT 
        rp.*,
        i.nombre as institucion_nombre,
        i.email as institucion_email,
        u.nombre as aprobador_nombre,
        u.apellido as aprobador_apellido
      FROM rifa_participaciones rp
      LEFT JOIN instituciones i ON rp.institucion_id = i.id
      LEFT JOIN usuarios u ON rp.aprobada_por = u.id
      WHERE rp.rifa_id = ?
      ORDER BY rp.es_promotora DESC, rp.fecha_solicitud ASC
    `;

    try {
      const [rows] = await db.execute(query, [rifaId]);
      return rows;
    } catch (error) {
      console.error('Error al obtener participaciones:', error);
      throw error;
    }
  }

  /**
   * Solicitar participación en rifa
   */
  static async solicitarParticipacion(rifaId, institucionId) {
    // Verificar si ya existe participación
    const [existente] = await db.execute(
      'SELECT id FROM rifa_participaciones WHERE rifa_id = ? AND institucion_id = ?',
      [rifaId, institucionId]
    );

    if (existente.length > 0) {
      throw new Error('La institución ya participa en esta rifa');
    }

    // Verificar límite de participantes
    const rifa = await this.obtenerPorId(rifaId);
    if (rifa.max_instituciones_participantes) {
      const [count] = await db.execute(
        'SELECT COUNT(*) as total FROM rifa_participaciones WHERE rifa_id = ? AND estado_participacion = "aprobada"',
        [rifaId]
      );
      
      if (count[0].total >= rifa.max_instituciones_participantes) {
        throw new Error('Se alcanzó el límite máximo de instituciones participantes');
      }
    }

    const query = `
      INSERT INTO rifa_participaciones (rifa_id, institucion_id, estado_participacion)
      VALUES (?, ?, ?)
    `;

    const estadoInicial = rifa.requiere_aprobacion ? 'solicitada' : 'aprobada';

    try {
      const [result] = await db.execute(query, [rifaId, institucionId, estadoInicial]);
      return result.insertId;
    } catch (error) {
      console.error('Error al solicitar participación:', error);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS DE NÚMEROS Y ASIGNACIONES
  // =====================================================

  /**
   * Generar números para la rifa
   */
  static async generarNumeros(rifaId) {
    const rifa = await this.obtenerPorId(rifaId);
    if (!rifa) {
      throw new Error('Rifa no encontrada');
    }

    // Verificar si ya tiene números generados
    const [existentes] = await db.execute(
      'SELECT COUNT(*) as total FROM numeros_rifa WHERE rifa_id = ?',
      [rifaId]
    );

    if (existentes[0].total > 0) {
      throw new Error('Los números ya fueron generados para esta rifa');
    }

    const numeros = [];
    for (let i = 1; i <= rifa.cantidad_numeros; i++) {
      const qrCode = `RIFA${rifaId}-${String(i).padStart(6, '0')}-${Date.now()}`;
      numeros.push([rifaId, i, qrCode]);
    }

    const query = `
      INSERT INTO numeros_rifa (rifa_id, numero, qr_code) VALUES ?
    `;

    try {
      await db.query(query, [numeros]);
      return true;
    } catch (error) {
      console.error('Error al generar números:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de la rifa
   */
  static async obtenerEstadisticas(rifaId) {
    const query = `
      SELECT 
        COUNT(*) as total_numeros,
        SUM(CASE WHEN estado = 'vendido' THEN 1 ELSE 0 END) as numeros_vendidos,
        SUM(CASE WHEN estado = 'reservado' THEN 1 ELSE 0 END) as numeros_reservados,
        SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END) as numeros_disponibles,
        SUM(CASE WHEN estado = 'vendido' THEN precio_venta ELSE 0 END) as total_recaudado,
        COUNT(DISTINCT institucion_vendedora_id) as instituciones_vendiendo
      FROM numeros_rifa
      WHERE rifa_id = ?
    `;

    try {
      const [rows] = await db.execute(query, [rifaId]);
      return rows[0];
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }

  // =====================================================
  // VALIDACIONES
  // =====================================================

  /**
   * Validar datos de rifa
   */
  static validar(data) {
    const errores = [];

    if (!data.nombre || data.nombre.trim().length < 3) {
      errores.push('El nombre debe tener al menos 3 caracteres');
    }

    if (!data.institucion_promotora_id) {
      errores.push('Debe especificar la institución promotora');
    }

    if (!data.cantidad_numeros || data.cantidad_numeros < 1) {
      errores.push('La cantidad de números debe ser mayor a 0');
    }

    if (!data.precio_numero || data.precio_numero <= 0) {
      errores.push('El precio por número debe ser mayor a 0');
    }

    if (!data.fecha_inicio) {
      errores.push('Debe especificar la fecha de inicio');
    }

    if (!data.fecha_fin) {
      errores.push('Debe especificar la fecha de fin');
    }

    if (!data.fecha_sorteo) {
      errores.push('Debe especificar la fecha de sorteo');
    }

    if (data.fecha_inicio && data.fecha_fin && new Date(data.fecha_inicio) >= new Date(data.fecha_fin)) {
      errores.push('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    if (data.fecha_fin && data.fecha_sorteo && new Date(data.fecha_fin) > new Date(data.fecha_sorteo)) {
      errores.push('La fecha de sorteo debe ser posterior a la fecha de fin');
    }

    if (data.comision_promotora && (data.comision_promotora < 0 || data.comision_promotora > 100)) {
      errores.push('La comisión debe estar entre 0 y 100%');
    }

    return errores;
  }

  // =====================================================
  // MÉTODOS DE INSTANCIA
  // =====================================================

  /**
   * Guardar instancia actual
   */
  async guardar() {
    if (this.id) {
      return await Rifa.actualizar(this.id, this);
    } else {
      return await Rifa.crear(this);
    }
  }

  /**
   * Convertir a JSON limpio
   */
  toJSON() {
    return {
      id: this.id,
      nombre: this.nombre,
      descripcion: this.descripcion,
      institucion_promotora_id: this.institucion_promotora_id,
      cantidad_numeros: this.cantidad_numeros,
      precio_numero: parseFloat(this.precio_numero),
      fecha_inicio: this.fecha_inicio,
      fecha_fin: this.fecha_fin,
      fecha_sorteo: this.fecha_sorteo,
      fecha_limite_participacion: this.fecha_limite_participacion,
      max_instituciones_participantes: this.max_instituciones_participantes,
      comision_promotora: parseFloat(this.comision_promotora),
      requiere_aprobacion: Boolean(this.requiere_aprobacion),
      numeros_por_institucion: this.numeros_por_institucion,
      estado: this.estado,
      numero_ganador: this.numero_ganador,
      fecha_sorteo_realizado: this.fecha_sorteo_realizado,
      imagen_url: this.imagen_url,
      bases_condiciones: this.bases_condiciones,
      observaciones: this.observaciones,
      fecha_creacion: this.fecha_creacion,
      fecha_actualizacion: this.fecha_actualizacion
    };
  }
}

export default Rifa;