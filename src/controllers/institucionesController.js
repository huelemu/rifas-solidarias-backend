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

    // Obtener estadísticas adicionales
    const [rifasCount] = await db.execute(
      'SELECT COUNT(*) as total_rifas FROM rifas WHERE institucion_id = ?',
      [id]
    );

    const [usuarioCount] = await db.execute(
      'SELECT COUNT(*) as total_usuarios FROM usuarios WHERE institucion_id = ?',
      [id]
    );

    res.json({
      status: 'success',
      data: {
        ...instituciones[0],
        estadisticas: {
          total_rifas: rifasCount[0].total_rifas,
          total_usuarios: usuarioCount[0].total_usuarios
        }
      }
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
        message: 'Nombre y email son campos obligatorios'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Formato de email inválido'
      });
    }

    // Verificar que el email no esté en uso
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

    // Insertar nueva institución (convertir undefined a null)
    const [result] = await db.execute(
      `INSERT INTO instituciones (nombre, descripcion, direccion, telefono, email, logo_url) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nombre, 
        descripcion || null, 
        direccion || null, 
        telefono || null, 
        email, 
        logo_url || null
      ]
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
      'SELECT * FROM instituciones WHERE id = ?',
      [id]
    );

    if (instituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    // Validaciones
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          status: 'error',
          message: 'Formato de email inválido'
        });
      }

      // Verificar que el email no esté en uso por otra institución
      const [existingEmail] = await db.execute(
        'SELECT id FROM instituciones WHERE email = ? AND id != ?',
        [email, id]
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe otra institución con ese email'
        });
      }
    }

    if (estado && !['activa', 'inactiva'].includes(estado)) {
      return res.status(400).json({
        status: 'error',
        message: 'Estado debe ser "activa" o "inactiva"'
      });
    }

    // Construir query de actualización dinámicamente
    const campos = [];
    const valores = [];

    if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
    if (descripcion !== undefined) { campos.push('descripcion = ?'); valores.push(descripcion); }
    if (direccion !== undefined) { campos.push('direccion = ?'); valores.push(direccion); }
    if (telefono !== undefined) { campos.push('telefono = ?'); valores.push(telefono); }
    if (email !== undefined) { campos.push('email = ?'); valores.push(email); }
    if (logo_url !== undefined) { campos.push('logo_url = ?'); valores.push(logo_url); }
    if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }

    if (campos.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionaron campos para actualizar'
      });
    }

    valores.push(id);

    await db.execute(
      `UPDATE instituciones SET ${campos.join(', ')} WHERE id = ?`,
      valores
    );

    // Obtener la institución actualizada
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
      'SELECT * FROM instituciones WHERE id = ?',
      [id]
    );

    if (instituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    // Verificar si tiene rifas asociadas
    const [rifasAsociadas] = await db.execute(
      'SELECT COUNT(*) as total FROM rifas WHERE institucion_id = ?',
      [id]
    );

    if (rifasAsociadas[0].total > 0) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede eliminar la institución. Tiene ${rifasAsociadas[0].total} rifas asociadas`,
        suggestion: 'Cambia el estado a "inactiva" en su lugar'
      });
    }

    // Eliminar la institución
    await db.execute('DELETE FROM instituciones WHERE id = ?', [id]);

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