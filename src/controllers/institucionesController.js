// src/controllers/institucionesController.js - AJUSTADO A LA TABLA REAL

import db from '../config/db.js';

/**
 * GET /instituciones - Obtener todas las instituciones
 */
export const obtenerInstituciones = async (req, res) => {
  try {
    const { page = 1, limit = 10, estado, tipo, search } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM instituciones WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM instituciones WHERE 1=1';
    let params = [];
    let countParams = [];

    if (estado && estado !== 'todas') {
      query += ' AND estado = ?';
      countQuery += ' AND estado = ?';
      params.push(estado);
      countParams.push(estado);
    }

    if (tipo && tipo !== 'todas') {
      query += ' AND tipo = ?';
      countQuery += ' AND tipo = ?';
      params.push(tipo);
      countParams.push(tipo);
    }

    if (search) {
      query += ' AND (nombre LIKE ? OR email LIKE ?)';
      countQuery += ' AND (nombre LIKE ? OR email LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
      countParams.push(searchParam, searchParam);
    }

    query += ' ORDER BY fecha_creacion DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [instituciones] = await db.execute(query, params);
    const [totalResult] = await db.execute(countQuery, countParams);
    const total = totalResult[0].total;

    res.json({
      status: 'success',
      data: {
        instituciones: instituciones,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener instituciones:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * GET /instituciones/:id - Obtener una institución específica
 */
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

    res.json({
      status: 'success',
      data: {
        institucion: instituciones[0]
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * POST /instituciones - Crear nueva institución
 */
export const crearInstitucion = async (req, res) => {
  try {
    const { 
      nombre, 
      descripcion, 
      tipo,
      email,           // ← Tabla usa 'email', no 'contacto_email'
      telefono,        // ← Tabla usa 'telefono', no 'contacto_telefono'
      direccion,
      cuit,            // ← Tabla usa 'cuit', no 'cuit_cuil'
      logo_url,
      estado = 'activa'
    } = req.body;

    // Validaciones básicas
    if (!nombre || !email || !tipo) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, email y tipo son requeridos'
      });
    }

    // Verificar email único
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
      `INSERT INTO instituciones (
        nombre, 
        descripcion, 
        tipo,
        email,
        telefono,
        direccion,
        cuit,
        logo_url,
        estado,
        fecha_creacion,
        fecha_actualizacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        nombre,
        descripcion || null,
        tipo,
        email,
        telefono || null,
        direccion || null,
        cuit || null,
        logo_url || null,
        estado
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
    console.error('❌ Error al crear institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * PUT /instituciones/:id - Actualizar institución
 */
export const actualizarInstitucion = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nombre, 
      descripcion, 
      tipo,
      email,           // ← Mapear contacto_email → email
      telefono,        // ← Mapear contacto_telefono → telefono
      direccion,
      cuit,            // ← Mapear cuit_cuil → cuit
      logo_url,
      estado,
      // Campos que vienen del frontend pero no existen en la tabla
      contacto_email,
      contacto_telefono,
      contacto_whatsapp,
      sitio_web,
      cuit_cuil,
      observaciones
    } = req.body;

    console.log('📝 Actualizando institución ID:', id);
    console.log('📦 Datos recibidos:', req.body);

    // Verificar que existe
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

    // Mapear campos del frontend a los de la tabla
    const emailFinal = email || contacto_email;
    const telefonoFinal = telefono || contacto_telefono;
    const cuitFinal = cuit || cuit_cuil;

    // Verificar email único si se está actualizando
    if (emailFinal) {
      const [existingEmail] = await db.execute(
        'SELECT id FROM instituciones WHERE email = ? AND id != ?',
        [emailFinal, id]
      );

      if (existingEmail.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe una institución con ese email'
        });
      }
    }

    // Construir query dinámicamente
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
    if (tipo !== undefined) {
      updateFields.push('tipo = ?');
      updateValues.push(tipo);
    }
    if (emailFinal !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(emailFinal);
    }
    if (telefonoFinal !== undefined) {
      updateFields.push('telefono = ?');
      updateValues.push(telefonoFinal);
    }
    if (direccion !== undefined) {
      updateFields.push('direccion = ?');
      updateValues.push(direccion);
    }
    if (cuitFinal !== undefined) {
      updateFields.push('cuit = ?');
      updateValues.push(cuitFinal);
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

    // Agregar fecha de actualización
    updateFields.push('fecha_actualizacion = NOW()');
    updateValues.push(id);

    // Ejecutar actualización
    const query = `UPDATE instituciones SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log('🔄 Query:', query);
    console.log('📊 Valores:', updateValues);

    await db.execute(query, updateValues);

    // Obtener institución actualizada
    const [institucionActualizada] = await db.execute(
      'SELECT * FROM instituciones WHERE id = ?',
      [id]
    );

    console.log('✅ Institución actualizada:', institucionActualizada[0]);

    res.json({
      status: 'success',
      message: 'Institución actualizada exitosamente',
      data: institucionActualizada[0]
    });

  } catch (error) {
    console.error('❌ Error al actualizar institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * DELETE /instituciones/:id - Eliminar institución
 */
export const eliminarInstitucion = async (req, res) => {
  try {
    const { id } = req.params;

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

    // Verificar usuarios asociados
    const [usuarios] = await db.execute(
      'SELECT COUNT(*) as total FROM usuarios WHERE institucion_id = ?',
      [id]
    );

    if (usuarios[0].total > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede eliminar la institución porque tiene usuarios asociados'
      });
    }

    await db.execute('DELETE FROM instituciones WHERE id = ?', [id]);

    res.json({
      status: 'success',
      message: 'Institución eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al eliminar institución:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};
/**
 * POST /instituciones/:id/logo - Subir logo de institución
 */
export const subirLogo = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que existe la institución
    const [instituciones] = await db.execute(
      'SELECT id, logo_url FROM instituciones WHERE id = ?',
      [id]
    );

    if (instituciones.length === 0) {
      // Eliminar archivo subido si la institución no existe
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionó ningún archivo'
      });
    }

    // Eliminar logo anterior si existe
    const oldLogoUrl = instituciones[0].logo_url;
    if (oldLogoUrl) {
      const oldLogoPath = path.join(__dirname, '../../', oldLogoUrl);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Construir URL del nuevo logo
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    // Actualizar en la base de datos
    await db.execute(
      'UPDATE instituciones SET logo_url = ?, fecha_actualizacion = NOW() WHERE id = ?',
      [logoUrl, id]
    );

    // Obtener institución actualizada
    const [institucionActualizada] = await db.execute(
      'SELECT * FROM instituciones WHERE id = ?',
      [id]
    );

    res.json({
      status: 'success',
      message: 'Logo subido exitosamente',
      data: {
        institucion: institucionActualizada[0],
        logo_url: logoUrl
      }
    });

  } catch (error) {
    // Limpiar archivo en caso de error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('❌ Error al subir logo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al subir logo',
      error: error.message
    });
  }
};

/**
 * DELETE /instituciones/:id/logo - Eliminar logo
 */
export const eliminarLogo = async (req, res) => {
  try {
    const { id } = req.params;

    const [instituciones] = await db.execute(
      'SELECT logo_url FROM instituciones WHERE id = ?',
      [id]
    );

    if (instituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Institución no encontrada'
      });
    }

    const logoUrl = instituciones[0].logo_url;
    
    if (logoUrl) {
      // Eliminar archivo físico
      const logoPath = path.join(__dirname, '../../', logoUrl);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }

      // Actualizar BD
      await db.execute(
        'UPDATE instituciones SET logo_url = NULL WHERE id = ?',
        [id]
      );
    }

    res.json({
      status: 'success',
      message: 'Logo eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error al eliminar logo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar logo'
    });
  }
};

/**
 * GET /instituciones/stats - Obtener estadísticas
 */
export const obtenerEstadisticasInstituciones = async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de instituciones...');

    const [totales] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as activas,
        SUM(CASE WHEN estado = 'inactiva' THEN 1 ELSE 0 END) as inactivas,
        SUM(CASE WHEN estado = 'suspendida' THEN 1 ELSE 0 END) as suspendidas
      FROM instituciones
    `);

    const [porTipo] = await db.execute(`
      SELECT tipo, COUNT(*) as cantidad
      FROM instituciones
      GROUP BY tipo
    `);

    const tiposObj = {
      club: 0,
      fundacion: 0,
      ong: 0,
      cooperativa: 0,
      escuela: 0,
      otro: 0
    };

    porTipo.forEach(row => {
      if (tiposObj.hasOwnProperty(row.tipo)) {
        tiposObj[row.tipo] = row.cantidad;
      }
    });

    const [conRifasActivas] = await db.execute(`
      SELECT COUNT(DISTINCT institucion_promotora_id) as total
      FROM rifas
      WHERE estado = 'activa' AND institucion_promotora_id IS NOT NULL
    `);

    const [usuariosInst] = await db.execute(`
      SELECT COUNT(*) as total
      FROM usuarios
      WHERE institucion_id IS NOT NULL
    `);

    const totalInst = totales[0].total || 1;
    const totalUsuarios = usuariosInst[0].total || 0;
    const promedio = totalInst > 0 ? (totalUsuarios / totalInst).toFixed(2) : 0;

    const stats = {
      total: totales[0].total || 0,
      activas: totales[0].activas || 0,
      inactivas: totales[0].inactivas || 0,
      suspendidas: totales[0].suspendidas || 0,
      por_tipo: tiposObj,
      con_rifas_activas: conRifasActivas[0].total || 0,
      total_usuarios_instituciones: totalUsuarios,
      promedio_usuarios_por_institucion: parseFloat(promedio)
    };

    console.log('✅ Estadísticas calculadas:', stats);

    res.json({
      status: 'success',
      data: stats
    });

  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};