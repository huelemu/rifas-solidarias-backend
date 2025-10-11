// =====================================================
// CONTROLADOR PARA DASHBOARD PÚBLICO
// src/controllers/dashboardController.js
// =====================================================

import db from '../config/db.js';

const dashboardController = {

  /**
   * GET /api/dashboard/public
   * Dashboard público con estadísticas generales
   * Muestra información según el usuario esté autenticado o no
   */
  async getPublicDashboard(req, res) {
    try {
      const isAuthenticated = !!req.user;
      const userId = req.user?.id;
      const userRole = req.user?.rol;
      const institucionId = req.user?.institucion_id;

      // =====================================================
      // ESTADÍSTICAS PÚBLICAS (Todos pueden ver)
      // =====================================================

      // 1. Rifas activas públicas
      const [rifasActivas] = await db.execute(`
        SELECT 
          r.id,
          r.nombre,
          r.descripcion,
          r.imagen_url,
          r.precio_numero,
          r.cantidad_numeros,
          r.fecha_sorteo,
          r.fecha_fin,
          i.nombre AS institucion_nombre,
          i.logo_url AS institucion_logo,
          COALESCE(stats.numeros_vendidos, 0) AS numeros_vendidos,
          COALESCE(stats.total_recaudado, 0) AS total_recaudado,
          ROUND((COALESCE(stats.numeros_vendidos, 0) / r.cantidad_numeros) * 100, 2) AS porcentaje_vendido
        FROM rifas r
        INNER JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN (
          SELECT 
            rifa_id,
            COUNT(*) AS numeros_vendidos,
            SUM(precio_venta) AS total_recaudado
          FROM numeros_rifa
          WHERE estado = 'vendido'
          GROUP BY rifa_id
        ) stats ON r.id = stats.rifa_id
        WHERE r.estado = 'activa'
          AND r.fecha_fin >= CURDATE()
        ORDER BY r.fecha_sorteo ASC
        LIMIT 6
      `);

      // 2. Próximos sorteos
      const [proximosSorteos] = await db.execute(`
        SELECT 
          r.id,
          r.nombre,
          r.fecha_sorteo,
          r.imagen_url,
          i.nombre AS institucion_nombre,
          COALESCE(stats.numeros_vendidos, 0) AS numeros_vendidos,
          r.cantidad_numeros
        FROM rifas r
        INNER JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN (
          SELECT rifa_id, COUNT(*) AS numeros_vendidos
          FROM numeros_rifa
          WHERE estado = 'vendido'
          GROUP BY rifa_id
        ) stats ON r.id = stats.rifa_id
        WHERE r.estado = 'activa'
          AND r.fecha_sorteo IS NOT NULL
          AND r.fecha_sorteo >= CURDATE()
        ORDER BY r.fecha_sorteo ASC
        LIMIT 5
      `);

      // 3. Últimos ganadores (solo rifas finalizadas con ganador)
      const [ultimosGanadores] = await db.execute(`
        SELECT 
          r.id AS rifa_id,
          r.nombre AS rifa_nombre,
          r.numero_ganador,
          r.fecha_sorteo_realizado,
          r.imagen_url AS rifa_imagen,
          i.nombre AS institucion_nombre,
          n.comprador_nombre,
          r.precio_numero AS premio_monto
        FROM rifas r
        INNER JOIN instituciones i ON r.institucion_promotora_id = i.id
        LEFT JOIN numeros_rifa n ON r.id = n.rifa_id AND r.numero_ganador = n.numero
        WHERE r.estado = 'finalizada'
          AND r.numero_ganador IS NOT NULL
        ORDER BY r.fecha_sorteo_realizado DESC
        LIMIT 5
      `);

      // 4. Estadísticas globales
      const [statsGlobales] = await db.execute(`
        SELECT 
          COUNT(DISTINCT r.id) AS total_rifas_activas,
          COUNT(DISTINCT n.participante_id) AS total_participantes,
          COALESCE(SUM(n.precio_venta), 0) AS total_recaudado,
          COUNT(DISTINCT CASE WHEN r.estado = 'finalizada' THEN r.id END) AS rifas_finalizadas
        FROM rifas r
        LEFT JOIN numeros_rifa n ON r.id = n.rifa_id AND n.estado = 'vendido'
        WHERE r.estado IN ('activa', 'finalizada')
      `);

      // =====================================================
      // DATOS ADICIONALES SI ESTÁ AUTENTICADO
      // =====================================================

      let misNumeros = [];
      let misRifas = [];
      let estadisticasPersonales = null;

      if (isAuthenticated) {
        // Mis números comprados
        const [numerosComprados] = await db.execute(`
          SELECT 
            n.id,
            n.numero,
            n.rifa_id,
            r.nombre AS rifa_nombre,
            r.fecha_sorteo,
            r.imagen_url AS rifa_imagen,
            n.precio_venta,
            n.fecha_venta,
            r.estado AS rifa_estado,
            r.numero_ganador,
            CASE 
              WHEN r.numero_ganador = n.numero THEN 'ganador'
              WHEN r.estado = 'finalizada' THEN 'perdido'
              ELSE 'en_juego'
            END AS estado_numero
          FROM numeros_rifa n
          INNER JOIN rifas r ON n.rifa_id = r.id
          WHERE n.participante_id = ?
            AND r.estado IN ('activa', 'finalizada')
          ORDER BY r.fecha_sorteo ASC, n.numero ASC
          LIMIT 10
        `, [userId]);

        misNumeros = numerosComprados;

        // Si es admin o vendedor, mostrar rifas que maneja
        if (['admin_global', 'admin_institucion', 'vendedor'].includes(userRole)) {
          let rifasQuery = `
            SELECT 
              r.id,
              r.nombre,
              r.estado,
              r.cantidad_numeros,
              r.fecha_sorteo,
              COALESCE(stats.numeros_vendidos, 0) AS numeros_vendidos,
              COALESCE(stats.total_recaudado, 0) AS total_recaudado
            FROM rifas r
            LEFT JOIN (
              SELECT rifa_id, COUNT(*) AS numeros_vendidos, SUM(precio_venta) AS total_recaudado
              FROM numeros_rifa
              WHERE estado = 'vendido'
              GROUP BY rifa_id
            ) stats ON r.id = stats.rifa_id
            WHERE 1=1
          `;

          const params = [];

          // Filtrar según rol
          if (userRole === 'admin_institucion') {
            rifasQuery += ` AND r.institucion_promotora_id = ?`;
            params.push(institucionId);
          } else if (userRole === 'vendedor') {
            rifasQuery += ` AND r.creado_por = ?`;
            params.push(userId);
          }

          rifasQuery += ` ORDER BY r.fecha_creacion DESC LIMIT 5`;

          const [rifasManejadas] = await db.execute(rifasQuery, params);
          misRifas = rifasManejadas;
        }

        // Estadísticas personales
        const [statsPersonales] = await db.execute(`
          SELECT 
            COUNT(DISTINCT n.rifa_id) AS rifas_participando,
            COUNT(n.id) AS numeros_comprados,
            COALESCE(SUM(n.precio_venta), 0) AS total_invertido,
            COUNT(DISTINCT CASE WHEN r.numero_ganador = n.numero THEN n.id END) AS premios_ganados
          FROM numeros_rifa n
          INNER JOIN rifas r ON n.rifa_id = r.id
          WHERE n.participante_id = ?
        `, [userId]);

        estadisticasPersonales = statsPersonales[0];
      }

      // =====================================================
      // RESPUESTA ESTRUCTURADA
      // =====================================================

      res.json({
        status: 'success',
        data: {
          // Sección pública
          publico: {
            rifas_activas: rifasActivas,
            proximos_sorteos: proximosSorteos,
            ultimos_ganadores: ultimosGanadores,
            estadisticas_globales: statsGlobales[0]
          },

          // Sección personal (solo si está autenticado)
          personal: isAuthenticated ? {
            mis_numeros: misNumeros,
            mis_rifas: misRifas,
            estadisticas: estadisticasPersonales
          } : null,

          // Metadata
          meta: {
            autenticado: isAuthenticated,
            rol: userRole || null,
            fecha_consulta: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('❌ Error en dashboard público:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error al obtener datos del dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

};

export default dashboardController;