// src/routes/numerosRoutes.js (NUEVO ARCHIVO)
import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

/**
 * @route   GET /api/numeros/consultar-por-email
 * @desc    Consultar números comprados usando solo el email
 * @access  Public (no requiere auth)
 */
router.get('/consultar-por-email', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Debe proporcionar un email'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Email inválido'
      });
    }

    const [numeros] = await db.execute(`
      SELECT 
        nr.id,
        nr.rifa_id,
        nr.numero,
        nr.qr_code,
        nr.hash_verificacion,
        nr.estado,
        nr.comprador_nombre,
        nr.comprador_apellido,
        nr.comprador_telefono,
        nr.comprador_email,
        nr.precio_venta,
        nr.metodo_pago,
        nr.fecha_venta,
        r.titulo as rifa_nombre,
        r.descripcion as rifa_descripcion,
        r.fecha_sorteo,
        r.estado as rifa_estado,
        r.imagen_url as rifa_imagen,
        r.numero_ganador,
        i.nombre as institucion_nombre,
        i.logo_url as institucion_logo,
        -- Verificar si este número ganó
        CASE 
          WHEN r.numero_ganador = nr.numero THEN TRUE 
          ELSE FALSE 
        END as es_ganador
      FROM numeros_rifa nr
      INNER JOIN rifas r ON nr.rifa_id = r.id
      LEFT JOIN instituciones i ON r.institucion_id = i.id
      WHERE nr.comprador_email = ?
        AND nr.estado = 'vendido'
      ORDER BY nr.fecha_venta DESC
    `, [email.toLowerCase().trim()]);

    // Agrupar por rifa para mejor presentación
    const agrupadoPorRifa = numeros.reduce((acc, numero) => {
      if (!acc[numero.rifa_id]) {
        acc[numero.rifa_id] = {
          rifa: {
            id: numero.rifa_id,
            nombre: numero.rifa_nombre,
            descripcion: numero.rifa_descripcion,
            fecha_sorteo: numero.fecha_sorteo,
            estado: numero.rifa_estado,
            imagen_url: numero.rifa_imagen,
            numero_ganador: numero.numero_ganador,
            institucion_nombre: numero.institucion_nombre,
            institucion_logo: numero.institucion_logo
          },
          numeros: [],
          total_gastado: 0,
          hay_ganador: false
        };
      }

      acc[numero.rifa_id].numeros.push({
        id: numero.id,
        numero: numero.numero,
        qr_code: numero.qr_code,
        hash_verificacion: numero.hash_verificacion,
        precio: numero.precio_venta,
        metodo_pago: numero.metodo_pago,
        fecha_compra: numero.fecha_venta,
        es_ganador: numero.es_ganador
      });

      acc[numero.rifa_id].total_gastado += parseFloat(numero.precio_venta || 0);
      
      if (numero.es_ganador) {
        acc[numero.rifa_id].hay_ganador = true;
      }

      return acc;
    }, {});

    const rifasArray = Object.values(agrupadoPorRifa);

    res.json({
      status: 'success',
      message: rifasArray.length > 0 
        ? `Se encontraron ${numeros.length} números en ${rifasArray.length} rifa(s)` 
        : 'No se encontraron números comprados con este email',
      data: {
        email: email.toLowerCase().trim(),
        total_rifas: rifasArray.length,
        total_numeros: numeros.length,
        total_invertido: rifasArray.reduce((sum, r) => sum + r.total_gastado, 0),
        rifas: rifasArray
      }
    });

  } catch (error) {
    console.error('❌ Error al consultar números por email:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al consultar números',
      error: error.message
    });
  }
});

export default router;