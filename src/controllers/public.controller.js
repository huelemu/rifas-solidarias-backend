const { Rifa, Numero, Usuario, Premio } = require('../models');

/**
 * Obtiene el detalle completo de un número específico (vista pública)
 * Incluye toda la información necesaria para generar el link de WhatsApp
 */
exports.getNumeroDetalle = async (req, res) => {
  try {
    const { rifaId, numeroId } = req.params;

    // Buscar el número con todas sus relaciones
    const numero = await Numero.findOne({
      where: {
        id: numeroId,
        rifa_id: rifaId
      },
      include: [
        {
          model: Rifa,
          as: 'rifa',
          attributes: ['id', 'nombre', 'descripcion', 'precio_numero', 'fecha_sorteo', 'estado'],
          include: [
            {
              model: Premio,
              as: 'premios',
              attributes: ['id', 'posicion', 'descripcion'],
              order: [['posicion', 'ASC']]
            }
          ]
        },
        {
          model: Usuario,
          as: 'vendedor',
          attributes: ['id', 'nombre', 'apellido', 'telefono', 'email']
        },
        {
          model: Usuario,
          as: 'comprador',
          attributes: ['id', 'nombre', 'apellido']
        }
      ]
    });

    // Validar que el número existe
    if (!numero) {
      return res.status(404).json({
        success: false,
        message: 'Número no encontrado'
      });
    }

    // Validar que la rifa esté activa (opcional)
    if (numero.rifa.estado === 'cancelada') {
      return res.status(400).json({
        success: false,
        message: 'Esta rifa ha sido cancelada'
      });
    }

    // Formatear la respuesta
    const response = {
      id: numero.id,
      numero: numero.numero,
      estado: numero.estado,
      precio_pagado: numero.precio_pagado,
      rifa: {
        id: numero.rifa.id,
        nombre: numero.rifa.nombre,
        descripcion: numero.rifa.descripcion,
        precio_numero: numero.rifa.precio_numero,
        fecha_sorteo: numero.rifa.fecha_sorteo,
        estado: numero.rifa.estado,
        premios: numero.rifa.premios || []
      },
      vendedor: numero.vendedor ? {
        id: numero.vendedor.id,
        nombre: `${numero.vendedor.nombre} ${numero.vendedor.apellido}`,
        telefono: numero.vendedor.telefono,
        email: numero.vendedor.email
      } : null,
      comprador: numero.comprador ? {
        id: numero.comprador.id,
        nombre: `${numero.comprador.nombre} ${numero.comprador.apellido}`
      } : null
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error al obtener detalle del número:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el detalle del número',
      error: error.message
    });
  }
};

/**
 * Obtiene información pública de una rifa
 */
exports.getRifaPublica = async (req, res) => {
  try {
    const { rifaId } = req.params;

    const rifa = await Rifa.findByPk(rifaId, {
      include: [
        {
          model: Premio,
          as: 'premios',
          attributes: ['id', 'posicion', 'descripcion']
        }
      ]
    });

    if (!rifa) {
      return res.status(404).json({
        success: false,
        message: 'Rifa no encontrada'
      });
    }

    res.json({
      success: true,
      data: rifa
    });

  } catch (error) {
    console.error('Error al obtener rifa pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la rifa',
      error: error.message
    });
  }
};

/**
 * Obtiene todos los números de una rifa (vista pública)
 */
exports.getNumerosRifa = async (req, res) => {
  try {
    const { rifaId } = req.params;

    const numeros = await Numero.findAll({
      where: { rifa_id: rifaId },
      attributes: ['id', 'numero', 'estado'],
      order: [['numero', 'ASC']]
    });

    res.json({
      success: true,
      data: numeros
    });

  } catch (error) {
    console.error('Error al obtener números:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los números',
      error: error.message
    });
  }
};