const { 
  Usuario, 
  Institucion, 
  Rifa, 
  Numero,
  RifaInstitucion, 
  RifaVendedor,
  UsuarioInstitucion,
  sequelize 
} = require('../models');
const { Op, QueryTypes } = require('sequelize');

// ========================================
// GESTIÓN USUARIOS - INSTITUCIONES
// ========================================

// ===== ASIGNAR USUARIO A INSTITUCIÓN =====
exports.asignarUsuarioInstitucion = async (req, res) => {
  try {
    const { usuarioId, institucionId, rol } = req.body;

    // Validaciones
    if (!usuarioId || !institucionId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos: usuarioId e institucionId son requeridos'
      });
    }

    // Verificar que existen
    const usuario = await Usuario.findByPk(usuarioId);
    const institucion = await Institucion.findByPk(institucionId);

    if (!usuario || !institucion) {
      return res.status(404).json({
        success: false,
        message: 'Usuario o institución no encontrados'
      });
    }

    // Verificar si ya existe la relación
    let relacion = await UsuarioInstitucion.findOne({
      where: { 
        usuario_id: usuarioId, 
        institucion_id: institucionId 
      }
    });

    if (relacion) {
      // Actualizar si existe
      relacion.activo = true;
      relacion.rol_institucion = rol || relacion.rol_institucion;
      await relacion.save();

      return res.json({
        success: true,
        message: 'Relación actualizada correctamente',
        data: relacion
      });
    }

    // Crear nueva relación
    relacion = await UsuarioInstitucion.create({
      usuario_id: usuarioId,
      institucion_id: institucionId,
      rol_institucion: rol || 'vendedor',
      activo: true
    });

    res.json({
      success: true,
      message: 'Usuario asignado a institución correctamente',
      data: relacion
    });

  } catch (error) {
    console.error('Error al asignar usuario a institución:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar usuario a institución'
    });
  }
};

// ===== REMOVER USUARIO DE INSTITUCIÓN =====
exports.removerUsuarioInstitucion = async (req, res) => {
  try {
    const { usuarioId, institucionId } = req.body;

    const resultado = await UsuarioInstitucion.update(
      { activo: false },
      {
        where: {
          usuario_id: usuarioId,
          institucion_id: institucionId
        }
      }
    );

    if (resultado[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Usuario removido de la institución'
    });

  } catch (error) {
    console.error('Error al remover usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al remover usuario de institución'
    });
  }
};

// ===== LISTAR USUARIOS DE UNA INSTITUCIÓN =====
exports.listarUsuariosInstitucion = async (req, res) => {
  try {
    const { institucionId } = req.params;

    const usuarios = await UsuarioInstitucion.findAll({
      where: {
        institucion_id: institucionId,
        activo: true
      },
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id', 'nombre', 'email', 'rol']
      }],
      order: [['fecha_alta', 'DESC']]
    });

    res.json({
      success: true,
      data: usuarios.map(ui => ({
        usuario_id: ui.usuario.id,
        nombre: ui.usuario.nombre,
        email: ui.usuario.email,
        rol_general: ui.usuario.rol,
        rol_institucion: ui.rol_institucion,
        fecha_alta: ui.fecha_alta
      }))
    });

  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar usuarios de la institución'
    });
  }
};

// ========================================
// GESTIÓN VENDEDORES EN RIFAS
// ========================================

// ===== ASIGNAR VENDEDOR A RIFA (en institución específica) =====
exports.asignarVendedorRifa = async (req, res) => {
  try {
    const { vendedorId, rifaId, institucionId, cuotaNumeros } = req.body;

    // Validaciones
    if (!vendedorId || !rifaId || !institucionId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos: vendedorId, rifaId e institucionId son requeridos'
      });
    }

    // Verificar que el usuario pertenece a la institución
    const perteneceInstitucion = await UsuarioInstitucion.findOne({
      where: {
        usuario_id: vendedorId,
        institucion_id: institucionId,
        activo: true
      }
    });

    if (!perteneceInstitucion) {
      return res.status(400).json({
        success: false,
        message: 'El usuario debe pertenecer primero a la institución'
      });
    }

    // Verificar que la institución participa en la rifa
    const rifaInstitucion = await RifaInstitucion.findOne({
      where: {
        rifa_id: rifaId,
        institucion_id: institucionId,
        activo: true
      }
    });

    if (!rifaInstitucion) {
      return res.status(404).json({
        success: false,
        message: 'La institución no participa en esta rifa'
      });
    }

    // Verificar si ya existe la asignación
    let asignacion = await RifaVendedor.findOne({
      where: {
        rifa_institucion_id: rifaInstitucion.id,
        vendedor_id: vendedorId
      }
    });

    if (asignacion) {
      // Actualizar
      asignacion.activo = true;
      asignacion.cuota_numeros = cuotaNumeros !== undefined ? cuotaNumeros : asignacion.cuota_numeros;
      await asignacion.save();

      return res.json({
        success: true,
        message: 'Asignación actualizada correctamente',
        data: asignacion
      });
    }

    // Crear nueva asignación
    asignacion = await RifaVendedor.create({
      rifa_institucion_id: rifaInstitucion.id,
      vendedor_id: vendedorId,
      cuota_numeros: cuotaNumeros || null,
      activo: true
    });

    res.json({
      success: true,
      message: 'Vendedor asignado a rifa correctamente',
      data: asignacion
    });

  } catch (error) {
    console.error('Error al asignar vendedor a rifa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar vendedor a rifa'
    });
  }
};

// ===== REMOVER VENDEDOR DE RIFA =====
exports.removerVendedorRifa = async (req, res) => {
  try {
    const { vendedorId, rifaId, institucionId } = req.body;

    // Buscar rifa_institucion_id
    const rifaInstitucion = await RifaInstitucion.findOne({
      where: {
        rifa_id: rifaId,
        institucion_id: institucionId
      }
    });

    if (!rifaInstitucion) {
      return res.status(404).json({
        success: false,
        message: 'Relación rifa-institución no encontrada'
      });
    }

    const resultado = await RifaVendedor.update(
      { activo: false },
      {
        where: {
          rifa_institucion_id: rifaInstitucion.id,
          vendedor_id: vendedorId
        }
      }
    );

    if (resultado[0] === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asignación no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Vendedor removido de la rifa'
    });

  } catch (error) {
    console.error('Error al remover vendedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al remover vendedor de rifa'
    });
  }
};

// ===== LISTAR VENDEDORES DE UNA RIFA (por institución) =====
exports.listarVendedoresRifa = async (req, res) => {
  try {
    const { rifaId, institucionId } = req.params;

    // Buscar rifa_institucion
    const rifaInstitucion = await RifaInstitucion.findOne({
      where: {
        rifa_id: rifaId,
        institucion_id: institucionId,
        activo: true
      }
    });

    if (!rifaInstitucion) {
      return res.status(404).json({
        success: false,
        message: 'La institución no participa en esta rifa'
      });
    }

    // Obtener vendedores
    const vendedores = await RifaVendedor.findAll({
      where: {
        rifa_institucion_id: rifaInstitucion.id,
        activo: true
      },
      include: [{
        model: Usuario,
        as: 'vendedor',
        attributes: ['id', 'nombre', 'email']
      }],
      order: [['fecha_asignacion', 'DESC']]
    });

    // Enriquecer con estadísticas
    const vendedoresConStats = await Promise.all(
      vendedores.map(async (rv) => {
        const numerosAsignados = await Numero.count({
          where: {
            rifa_id: rifaId,
            institucion_id: institucionId,
            vendedor_id: rv.vendedor_id
          }
        });

        const numerosVendidos = await Numero.count({
          where: {
            rifa_id: rifaId,
            institucion_id: institucionId,
            vendedor_id: rv.vendedor_id,
            estado: 'vendido'
          }
        });

        return {
          vendedor_id: rv.vendedor.id,
          nombre: rv.vendedor.nombre,
          email: rv.vendedor.email,
          cuota_numeros: rv.cuota_numeros,
          numeros_asignados: numerosAsignados,
          numeros_vendidos: numerosVendidos,
          fecha_asignacion: rv.fecha_asignacion
        };
      })
    );

    res.json({
      success: true,
      data: vendedoresConStats
    });

  } catch (error) {
    console.error('Error al listar vendedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar vendedores de la rifa'
    });
  }
};

// ========================================
// ASIGNACIÓN MASIVA DE NÚMEROS
// ========================================

// ===== ASIGNAR NÚMEROS MASIVAMENTE A UN VENDEDOR =====
exports.asignarNumerosMasivo = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { vendedorId, rifaId, institucionId, desde, hasta } = req.body;

    // Validaciones
    if (!vendedorId || !rifaId || !institucionId || desde === undefined || hasta === undefined) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan datos: vendedorId, rifaId, institucionId, desde, hasta'
      });
    }

    if (desde > hasta) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'El rango "desde" no puede ser mayor que "hasta"'
      });
    }

    // Verificar que el vendedor pertenece a la institución
    const perteneceInstitucion = await UsuarioInstitucion.findOne({
      where: {
        usuario_id: vendedorId,
        institucion_id: institucionId,
        activo: true
      },
      transaction
    });

    if (!perteneceInstitucion) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'El vendedor no pertenece a esta institución'
      });
    }

    // Generar array de números
    const numeros = [];
    for (let i = desde; i <= hasta; i++) {
      numeros.push(i);
    }

    // Asignar números
    const [numerosActualizados] = await Numero.update(
      { 
        vendedor_id: vendedorId,
        institucion_id: institucionId,
        estado: 'asignado'
      },
      {
        where: {
          rifa_id: rifaId,
          numero: { [Op.in]: numeros },
          estado: 'disponible',
          vendedor_id: null,
          [Op.or]: [
            { institucion_id: null },
            { institucion_id: institucionId }
          ]
        },
        transaction
      }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: `${numerosActualizados} número(s) asignado(s) del ${desde} al ${hasta}`,
      numerosAsignados: numerosActualizados
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al asignar números masivamente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar números masivamente'
    });
  }
};

// ========================================
// REPORTES Y ESTADÍSTICAS
// ========================================

// ===== RESUMEN GENERAL DE UNA RIFA =====
exports.resumenRifa = async (req, res) => {
  try {
    const { rifaId } = req.params;

    // Información básica de la rifa
    const rifa = await Rifa.findByPk(rifaId, {
      attributes: ['id', 'nombre', 'descripcion', 'precio_numero', 'fecha_sorteo', 'estado', 'total_numeros']
    });

    if (!rifa) {
      return res.status(404).json({
        success: false,
        message: 'Rifa no encontrada'
      });
    }

    // Instituciones participantes
    const instituciones = await RifaInstitucion.findAll({
      where: { rifa_id: rifaId, activo: true },
      include: [{
        model: Institucion,
        as: 'institucion',
        attributes: ['id', 'nombre']
      }]
    });

    // Estadísticas por institución
    const estadisticasInstituciones = await Promise.all(
      instituciones.map(async (ri) => {
        const vendedores = await RifaVendedor.count({
          where: {
            rifa_institucion_id: ri.id,
            activo: true
          }
        });

        const numerosAsignados = await Numero.count({
          where: {
            rifa_id: rifaId,
            institucion_id: ri.institucion_id
          }
        });

        const numerosVendidos = await Numero.count({
          where: {
            rifa_id: rifaId,
            institucion_id: ri.institucion_id,
            estado: 'vendido'
          }
        });

        return {
          institucion_id: ri.institucion.id,
          institucion_nombre: ri.institucion.nombre,
          es_sponsor: ri.es_sponsor,
          porcentaje_comision: ri.porcentaje_comision,
          total_vendedores: vendedores,
          numeros_asignados: numerosAsignados,
          numeros_vendidos: numerosVendidos
        };
      })
    );

    // Estadísticas generales
    const totalDisponibles = await Numero.count({
      where: { rifa_id: rifaId, estado: 'disponible' }
    });

    const totalAsignados = await Numero.count({
      where: { rifa_id: rifaId, estado: 'asignado' }
    });

    const totalVendidos = await Numero.count({
      where: { rifa_id: rifaId, estado: 'vendido' }
    });

    res.json({
      success: true,
      data: {
        rifa: rifa,
        estadisticas: {
          total_numeros: rifa.total_numeros,
          disponibles: totalDisponibles,
          asignados: totalAsignados,
          vendidos: totalVendidos,
          porcentaje_vendido: ((totalVendidos / rifa.total_numeros) * 100).toFixed(2)
        },
        instituciones: estadisticasInstituciones
      }
    });

  } catch (error) {
    console.error('Error al obtener resumen:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen de la rifa'
    });
  }
};

// ===== RANKING DE VENDEDORES DE UNA RIFA =====
exports.rankingVendedores = async (req, res) => {
  try {
    const { rifaId } = req.params;

    const ranking = await sequelize.query(`
      SELECT 
        u.id as vendedor_id,
        u.nombre as vendedor_nombre,
        i.nombre as institucion_nombre,
        COUNT(n.id) as total_vendidos,
        SUM(r.precio_numero) as total_recaudado
      FROM numeros_rifa n
      INNER JOIN users u ON n.vendedor_id = u.id
      INNER JOIN instituciones i ON n.institucion_id = i.id
      INNER JOIN rifas r ON n.rifa_id = r.id
      WHERE n.rifa_id = ? AND n.estado = 'vendido'
      GROUP BY u.id, u.nombre, i.nombre
      ORDER BY total_vendidos DESC
      LIMIT 20
    `, {
      replacements: [rifaId],
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: ranking
    });

  } catch (error) {
    console.error('Error al obtener ranking:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ranking de vendedores'
    });
  }
};