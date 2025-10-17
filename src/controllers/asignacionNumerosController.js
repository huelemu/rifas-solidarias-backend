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

// ===== 1. OBTENER MIS INSTITUCIONES =====
exports.obtenerMisInstituciones = async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const instituciones = await UsuarioInstitucion.findAll({
      where: { 
        usuario_id: usuarioId,
        activo: true
      },
      include: [{
        model: Institucion,
        as: 'institucion',
        attributes: ['id', 'nombre', 'descripcion']
      }],
      order: [['fecha_alta', 'DESC']]
    });

    res.json({
      success: true,
      data: instituciones.map(ui => ({
        id: ui.institucion.id,
        nombre: ui.institucion.nombre,
        descripcion: ui.institucion.descripcion,
        rol: ui.rol_institucion,
        fecha_alta: ui.fecha_alta
      }))
    });

  } catch (error) {
    console.error('Error al obtener instituciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tus instituciones'
    });
  }
};

// ===== 2. OBTENER RIFAS DONDE PUEDO VENDER (de mis instituciones) =====
exports.obtenerRifasDisponibles = async (req, res) => {
  try {
    const { institucionId } = req.params;
    const usuarioId = req.user.id;

    // Verificar que pertenezco a la institución
    const perteneceInstitucion = await UsuarioInstitucion.findOne({
      where: {
        usuario_id: usuarioId,
        institucion_id: institucionId,
        activo: true
      }
    });

    if (!perteneceInstitucion) {
      return res.status(403).json({
        success: false,
        message: 'No perteneces a esta institución'
      });
    }

    // Obtener rifas donde mi institución participa
    const rifasInstitucion = await RifaInstitucion.findAll({
      where: {
        institucion_id: institucionId,
        activo: true
      },
      include: [{
        model: Rifa,
        as: 'rifa',
        where: { estado: 'activa' },
        attributes: ['id', 'nombre', 'descripcion', 'precio_numero', 'fecha_sorteo', 'total_numeros']
      }]
    });

    // Enriquecer con info del vendedor
    const rifasConPermisos = await Promise.all(
      rifasInstitucion.map(async (ri) => {
        // Verificar si estoy asignado como vendedor en esta rifa
        const asignacion = await RifaVendedor.findOne({
          where: {
            rifa_institucion_id: ri.id,
            vendedor_id: usuarioId,
            activo: true
          }
        });

        // Contar números disponibles para mi institución
        const numerosDisponibles = await Numero.count({
          where: {
            rifa_id: ri.rifa_id,
            estado: 'disponible',
            vendedor_id: null,
            [Op.or]: [
              { institucion_id: null },
              { institucion_id: institucionId }
            ]
          }
        });

        // Contar mis números asignados
        const misNumeros = await Numero.count({
          where: {
            rifa_id: ri.rifa_id,
            vendedor_id: usuarioId,
            institucion_id: institucionId
          }
        });

        return {
          rifa_id: ri.rifa.id,
          nombre: ri.rifa.nombre,
          descripcion: ri.rifa.descripcion,
          precio_numero: ri.rifa.precio_numero,
          fecha_sorteo: ri.rifa.fecha_sorteo,
          total_numeros: ri.rifa.total_numeros,
          es_sponsor: ri.es_sponsor,
          porcentaje_comision: ri.porcentaje_comision,
          estoy_asignado: !!asignacion,
          cuota_numeros: asignacion?.cuota_numeros || null,
          numeros_disponibles: numerosDisponibles,
          mis_numeros: misNumeros,
          rifa_institucion_id: ri.id
        };
      })
    );

    res.json({
      success: true,
      data: rifasConPermisos
    });

  } catch (error) {
    console.error('Error al obtener rifas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rifas disponibles'
    });
  }
};

// ===== 3. OBTENER NÚMEROS DISPONIBLES PARA ASIGNAR =====
exports.obtenerNumerosDisponibles = async (req, res) => {
  try {
    const { rifaId, institucionId } = req.params;
    const usuarioId = req.user.id;

    // Verificar acceso
    const perteneceInstitucion = await UsuarioInstitucion.findOne({
      where: {
        usuario_id: usuarioId,
        institucion_id: institucionId,
        activo: true
      }
    });

    if (!perteneceInstitucion) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso'
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
        message: 'Tu institución no participa en esta rifa'
      });
    }

    // Obtener números disponibles (sin asignar o sin institución)
    const numerosDisponibles = await Numero.findAll({
      where: {
        rifa_id: rifaId,
        estado: 'disponible',
        vendedor_id: null,
        [Op.or]: [
          { institucion_id: null },
          { institucion_id: institucionId }
        ]
      },
      attributes: ['id', 'numero'],
      order: [['numero', 'ASC']]
    });

    res.json({
      success: true,
      data: numerosDisponibles
    });

  } catch (error) {
    console.error('Error al obtener números:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener números disponibles'
    });
  }
};

// ===== 4. ASIGNAR NÚMEROS A MÍ MISMO =====
exports.asignarNumeros = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { rifaId, institucionId, numeros } = req.body; // numeros = [1, 5, 10, 23]
    const vendedorId = req.user.id;

    // Validaciones
    if (!rifaId || !institucionId || !numeros || !Array.isArray(numeros) || numeros.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos. Enviar: rifaId, institucionId y array de números'
      });
    }

    // Verificar pertenencia a institución
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
        message: 'No perteneces a esta institución'
      });
    }

    // Verificar que la institución participa en la rifa
    const rifaInstitucion = await RifaInstitucion.findOne({
      where: {
        rifa_id: rifaId,
        institucion_id: institucionId,
        activo: true
      },
      transaction
    });

    if (!rifaInstitucion) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Tu institución no participa en esta rifa'
      });
    }

    // Verificar si estoy asignado como vendedor
    const asignacionVendedor = await RifaVendedor.findOne({
      where: {
        rifa_institucion_id: rifaInstitucion.id,
        vendedor_id: vendedorId,
        activo: true
      },
      transaction
    });

    // Verificar cuota si existe
    if (asignacionVendedor && asignacionVendedor.cuota_numeros !== null) {
      const numerosYaAsignados = await Numero.count({
        where: {
          rifa_id: rifaId,
          vendedor_id: vendedorId,
          institucion_id: institucionId
        },
        transaction
      });

      if (numerosYaAsignados + numeros.length > asignacionVendedor.cuota_numeros) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Excedes tu cuota de ${asignacionVendedor.cuota_numeros} números. Ya tienes ${numerosYaAsignados} asignados.`
        });
      }
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

    if (numerosActualizados === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Ningún número pudo ser asignado. Pueden estar ya tomados o no existir.'
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: `${numerosActualizados} número(s) asignado(s) correctamente`,
      numerosAsignados: numerosActualizados
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al asignar números:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar números'
    });
  }
};

// ===== 5. OBTENER MIS NÚMEROS ASIGNADOS =====
exports.obtenerMisNumeros = async (req, res) => {
  try {
    const { rifaId, institucionId } = req.params;
    const vendedorId = req.user.id;

    const misNumeros = await Numero.findAll({
      where: {
        rifa_id: rifaId,
        institucion_id: institucionId,
        vendedor_id: vendedorId
      },
      attributes: ['id', 'numero', 'estado'],
      order: [['numero', 'ASC']]
    });

    res.json({
      success: true,
      data: misNumeros
    });

  } catch (error) {
    console.error('Error al obtener mis números:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tus números'
    });
  }
};

// ===== 6. LIBERAR NÚMEROS =====
exports.liberarNumeros = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { rifaId, institucionId, numeros } = req.body;
    const vendedorId = req.user.id;

    const [numerosLiberados] = await Numero.update(
      { 
        vendedor_id: null,
        institucion_id: null,
        estado: 'disponible'
      },
      {
        where: {
          rifa_id: rifaId,
          institucion_id: institucionId,
          numero: { [Op.in]: numeros },
          vendedor_id: vendedorId,
          estado: 'asignado'
        },
        transaction
      }
    );

    await transaction.commit();

    res.json({
      success: true,
      message: `${numerosLiberados} número(s) liberado(s)`,
      numerosLiberados
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error al liberar números:', error);
    res.status(500).json({
      success: false,
      message: 'Error al liberar números'
    });
  }
};