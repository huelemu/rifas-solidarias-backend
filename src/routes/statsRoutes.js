// src/routes/statsRoutes.js

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../config/db.js';

const router = express.Router();

// =====================================================
// GET /api/stats/dashboard
// Obtener estadísticas del dashboard
// =====================================================

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.rol;

    // Estadísticas generales
    const [rifasStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_rifas,
        SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as rifas_activas,
        SUM(CASE WHEN estado = 'finalizada' THEN 1 ELSE 0 END) as rifas_finalizadas
      FROM rifas
    `);

    // Mis números comprados
    const [misNumerosStats] = await db.execute(`
      SELECT 
        COUNT(*) as mis_numeros_comprados,
        COUNT(DISTINCT rifa_id) as mis_rifas_activas,
        COALESCE(SUM(precio_venta), 0) as total_invertido
      FROM numeros_rifa
      WHERE participante_id = ?
      AND estado = 'vendido'
    `, [userId]);

    // Estadísticas solo para administradores
    let adminStats = {};
    if (userRole === 'admin_global' || userRole === 'admin_institucion') {
      const [usuarios] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
      const [instituciones] = await db.execute('SELECT COUNT(*) as total FROM instituciones');
      
      const [recaudacion] = await db.execute(`
        SELECT COALESCE(SUM(precio_venta), 0) as total_recaudado
        FROM numeros_rifa
        WHERE estado = 'vendido'
      `);

      const [ventasHoy] = await db.execute(`
        SELECT COUNT(*) as total
        FROM numeros_rifa
        WHERE estado = 'vendido'
        AND DATE(fecha_venta) = CURDATE()
      `);

      adminStats = {
        total_usuarios: usuarios[0].total,
        total_instituciones: instituciones[0].total,
        total_recaudado: recaudacion[0].total_recaudado,
        numeros_vendidos_hoy: ventasHoy[0].total
      };
    }

    res.json({
      status: 'success',
      data: {
        total_rifas: rifasStats[0].total_rifas,
        rifas_activas: rifasStats[0].rifas_activas,
        rifas_finalizadas: rifasStats[0].rifas_finalizadas,
        mis_numeros_comprados: misNumerosStats[0].mis_numeros_comprados,
        mis_rifas_activas: misNumerosStats[0].mis_rifas_activas,
        total_invertido: parseFloat(misNumerosStats[0].total_invertido),
        ...adminStats
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

// =====================================================
// GET /api/stats/mis-rifas-activas
// Obtener rifas activas donde participo
// =====================================================

router.get('/mis-rifas-activas', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rifas] = await db.execute(`
      SELECT DISTINCT
        r.id,
        r.nombre,
        r.estado,
        r.fecha_sorteo,
        ROUND((SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido') * 100.0 / r.cantidad_numeros, 2) as porcentaje_vendido,
        COALESCE((SELECT SUM(precio_venta) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido'), 0) as total_recaudado
      FROM rifas r
      INNER JOIN numeros_rifa n ON n.rifa_id = r.id
      WHERE n.participante_id = ?
      AND r.estado = 'activa'
      ORDER BY r.fecha_sorteo ASC
      LIMIT 5
    `, [userId]);

    res.json({
      status: 'success',
      data: rifas
    });

  } catch (error) {
    console.error('Error obteniendo mis rifas activas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener rifas activas',
      error: error.message
    });
  }
});

// =====================================================
// GET /api/stats/top-rifas
// Obtener top rifas por ventas (solo admin)
// =====================================================

router.get('/top-rifas', requireAuth, async (req, res) => {
  try {
    const userRole = req.user.rol;

    // Solo admins pueden ver esto
    if (userRole !== 'admin_global' && userRole !== 'admin_institucion') {
      return res.status(403).json({
        status: 'error',
        message: 'No tienes permisos para ver esta información'
      });
    }

    const limit = parseInt(req.query.limit) || 5;

    const [rifas] = await db.execute(`
      SELECT 
        r.id,
        r.nombre,
        r.estado,
        r.fecha_sorteo,
        ROUND((SELECT COUNT(*) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido') * 100.0 / r.cantidad_numeros, 2) as porcentaje_vendido,
        COALESCE((SELECT SUM(precio_venta) FROM numeros_rifa WHERE rifa_id = r.id AND estado = 'vendido'), 0) as total_recaudado
      FROM rifas r
      WHERE r.estado IN ('activa', 'finalizada')
      ORDER BY total_recaudado DESC
      LIMIT ?
    `, [limit]);

    res.json({
      status: 'success',
      data: rifas
    });

  } catch (error) {
    console.error('Error obteniendo top rifas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener top rifas',
      error: error.message
    });
  }
});

// =====================================================
// GET /api/stats/resumen-general
// Resumen general del sistema (solo admin)
// =====================================================

router.get('/resumen-general', requireAuth, async (req, res) => {
  try {
    const userRole = req.user.rol;

    if (userRole !== 'admin_global') {
      return res.status(403).json({
        status: 'error',
        message: 'Solo administradores globales pueden acceder'
      });
    }

    // Estadísticas de rifas
    const [rifasStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as activas,
        SUM(CASE WHEN estado = 'finalizada' THEN 1 ELSE 0 END) as finalizadas,
        SUM(CASE WHEN estado = 'pausada' THEN 1 ELSE 0 END) as pausadas,
        SUM(CASE WHEN estado = 'borrador' THEN 1 ELSE 0 END) as borradores
      FROM rifas
    `);

    // Estadísticas de ventas
    const [ventasStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_numeros_vendidos,
        COALESCE(SUM(precio_venta), 0) as total_recaudado,
        ROUND(AVG(precio_venta), 2) as precio_promedio
      FROM numeros_rifa
      WHERE estado = 'vendido'
    `);

    // Estadísticas de usuarios
    const [usuariosStats] = await db.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN rol = 'admin_global' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN rol = 'vendedor' THEN 1 ELSE 0 END) as vendedores,
        SUM(CASE WHEN rol = 'comprador' THEN 1 ELSE 0 END) as compradores
      FROM usuarios
    `);

    // Ventas por mes (últimos 6 meses)
    const [ventasPorMes] = await db.execute(`
      SELECT 
        DATE_FORMAT(fecha_venta, '%Y-%m') as mes,
        COUNT(*) as cantidad,
        COALESCE(SUM(precio_venta), 0) as total
      FROM numeros_rifa
      WHERE estado = 'vendido'
      AND fecha_venta >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_venta, '%Y-%m')
      ORDER BY mes ASC
    `);

    res.json({
      status: 'success',
      data: {
        rifas: rifasStats[0],
        ventas: ventasStats[0],
        usuarios: usuariosStats[0],
        ventas_por_mes: ventasPorMes
      }
    });

  } catch (error) {
    console.error('Error obteniendo resumen general:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener resumen',
      error: error.message
    });
  }
});

export default router;