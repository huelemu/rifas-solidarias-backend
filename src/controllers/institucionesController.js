// src/controllers/institucionesController.js
import db from '../config/db.js';

// GET /instituciones - Obtener todas las instituciones
export const obtenerInstituciones = async (req, res) => {
  try {
    const { page = 1, limit = 10, estado } = req.query;
    const offset = (page - 1) * limit;

    // Construir query dinámicamente
    let query = 'SELECT * FROM instituciones';
    let countQuery = 'SELECT COUNT(*) as total FROM instituciones';
    let params = [];

    // Filtro por estado si se proporciona
    if (estado) {
      query += ' WHERE estado = ?';
      countQuery += ' WHERE estado = ?';
      params.push(estado);
    }

    // Agregar paginación
    query += ' ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    // Ejecutar consultas
    const [instituciones] = await db.execute(query, params);
    const [totalResult] = await db.execute(countQuery, estado ? [estado] : []);
    const total = totalResult[0].total;

    res.json({
      status: 'success',
      data: instituciones,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_records: total,
        per_page: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener instituciones:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// GET /instituciones/:id - Obtener una institución específica
export const obtenerInstitucionPorId = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener información básica de la institución
    const [instituciones] = await db.execute(
      'SELECT * FROM instituciones WHERE id = ?',
      [id]
    );

    if (instituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    const institucion = instituciones[0];

    // Obtener estadísticas adicionales
    try {
      // Contar rifas donde es promotora
      const [rifasPromotas] = await db.execute(
        'SELECT COUNT(*) as total_rifas_promotoras FROM rifas WHERE institucion_promotora_id = ?',
        [id]
      );

      // Contar participaciones en rifas
      const [rifasParticipantes] = await db.execute(
        'SELECT COUNT(*) as total_participaciones FROM rifa_participaciones WHERE institucion_id = ? AND estado_participacion = "aprobada"',
        [id]
      );

      // Contar usuarios de la institución
      const [usuarioCount] = await db.execute(
        'SELECT COUNT(*) as total_usuarios FROM usuarios WHERE institucion_id = ?',
        [id]
      );

      // Agregar estadísticas al objeto institución
      institucion.estadisticas = {
        total_rifas_promotoras: rifasPromotas[0].total_rifas_promotoras,
        total_participaciones: rifasParticipantes[0].total_participaciones,
        total_usuarios: usuarioCount[0].total_usuarios,
        total_rifas: rifasPromotas[0].total_rifas_promotoras + rifasParticipantes[0].total_participaciones
      };

    } catch (statsError) {
      console.warn('Error al obtener estadísticas:', statsError.message);
      // Si hay error en estadísticas, continuar sin ellas
      institucion.estadisticas = {
        total_rifas_promotoras: 0,
        total_participaciones: 0,
        total_usuarios: 0,
        total_rifas: 0,
        error: 'No se pudieron obtener estadísticas'
      };
    }

    res.json({
      status: 'success',
      data: institucion
    });

  } catch (error) {
    console.error('Error al obtener institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// POST /instituciones - Crear nueva institución
export const crearInstitucion = async (req, res) => {
  try {
    const { nombre, descripcion, direccion, telefono, email, logo_url } = req.body;

    // Validaciones básicas
    if (!nombre || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre y email son obligatorios'
      });
    }

    // Verificar que el email no exista
    const [existingEmail] = await db.execute(
      'SELECT id FROM instituciones WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe una institución con ese email'
      });
    }

    // Insertar nueva institución
    const [result] = await db.execute(
      'INSERT INTO instituciones (nombre, descripcion, direccion, telefono, email, logo_url, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, descripcion || null, direccion || null, telefono || null, email, logo_url || null, 'activa']
    );

    // Obtener la institución creada
    const [nuevaInstitucion] = await db.execute(
      'SELECT * FROM instituciones WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      status: 'success',
      message: 'Institución creada exitosamente',
      data: nuevaInstitucion[0]
    });

  } catch (error) {
    console.error('Error al crear institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// PUT /instituciones/:id - Actualizar institución
export const actualizarInstitucion = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, direccion, telefono, email, logo_url, estado } = req.body;

    // Verificar que la institución existe
    const [instituciones] = await db.execute(
      'SELECT id FROM instituciones WHERE id = ?',
      [id]
    );

    if (instituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    // Si se está actualizando el email, verificar que no exista
    if (email) {
      const [existingEmail] = await db.execute(
        'SELECT id FROM instituciones WHERE email = ? AND id != ?',
        [email, id]
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe una institución con ese email'
        });
      }
    }

    // Construir query de actualización dinámicamente
    const updateFields = [];
    const updateValues = [];

    if (nombre !== undefined) {
      updateFields.push('nombre = ?');
      updateValues.push(nombre);
    }
    if (descripcion !== undefined) {
      updateFields.push('descripcion = ?');
      updateValues.push(descripcion);
    }
    if (direccion !== undefined) {
      updateFields.push('direccion = ?');
      updateValues.push(direccion);
    }
    if (telefono !== undefined) {
      updateFields.push('telefono = ?');
      updateValues.push(telefono);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (logo_url !== undefined) {
      updateFields.push('logo_url = ?');
      updateValues.push(logo_url);
    }
    if (estado !== undefined) {
      updateFields.push('estado = ?');
      updateValues.push(estado);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionaron campos para actualizar'
      });
    }

    // Agregar ID al final de los valores
    updateValues.push(id);

    // Ejecutar actualización
    await db.execute(
      `UPDATE instituciones SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Obtener institución actualizada
    const [institucionActualizada] = await db.execute(
      'SELECT * FROM instituciones WHERE id = ?',
      [id]
    );

    res.json({
      status: 'success',
      message: 'Institución actualizada exitosamente',
      data: institucionActualizada[0]
    });

  } catch (error) {
    console.error('Error al actualizar institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// DELETE /instituciones/:id - Eliminar institución
export const eliminarInstitucion = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que la institución existe
    const [instituciones] = await db.execute(
      'SELECT id FROM instituciones WHERE id = ?',
      [id]
    );

    if (instituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    // Verificar que no tenga rifas asociadas (como promotora)
    const [rifasPromotas] = await db.execute(
      'SELECT COUNT(*) as total FROM rifas WHERE institucion_promotora_id = ?',
      [id]
    );

    if (rifasPromotas[0].total > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede eliminar la institución porque tiene rifas asociadas como promotora'
      });
    }

    // Verificar que no tenga participaciones en rifas activas
    const [participaciones] = await db.execute(
      'SELECT COUNT(*) as total FROM rifa_participaciones rp JOIN rifas r ON rp.rifa_id = r.id WHERE rp.institucion_id = ? AND r.estado IN ("activa", "borrador")',
      [id]
    );

    if (participaciones[0].total > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede eliminar la institución porque tiene participaciones en rifas activas'
      });
    }

    // Realizar eliminación (soft delete cambiando estado)
    await db.execute(
      'UPDATE instituciones SET estado = "inactiva" WHERE id = ?',
      [id]
    );

    res.json({
      status: 'success',
      message: 'Institución eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};