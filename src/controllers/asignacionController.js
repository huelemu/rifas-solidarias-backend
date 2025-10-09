import db from '../config/db.js';
import crypto from 'crypto';

// ==========================================
// ASIGNAR INSTITUCIONES A RIFA (Opción 2)
// ==========================================
export const asignarInstitucionesARifa = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { rifaId } = req.params;
    const { instituciones } = req.body;

    console.log('📋 Asignando instituciones a rifa:', { rifaId, instituciones });

    // Validaciones
    if (!instituciones || !Array.isArray(instituciones) || instituciones.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Debe proporcionar un array de instituciones'
      });
    }

    // Obtener la rifa
    const [rifas] = await connection.execute(
      'SELECT * FROM rifas WHERE id = ?',
      [rifaId]
    );

    if (rifas.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Rifa no encontrada'
      });
    }

    const rifa = rifas[0];

    // Verificar que los números ya estén creados
    const [numerosExistentes] = await connection.execute(
      'SELECT COUNT(*) as total FROM numeros_rifa WHERE rifa_id = ?',
      [rifaId]
    );

    if (numerosExistentes[0].total !== rifa.cantidad_numeros) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `La rifa debe tener ${rifa.cantidad_numeros} números creados. Actualmente tiene ${numerosExistentes[0].total}`
      });
    }

    // Verificar instituciones activas
    const placeholders = instituciones.map(() => '?').join(',');
    const [institucionesExistentes] = await connection.execute(
      `SELECT id FROM instituciones 
       WHERE id IN (${placeholders}) 
       AND estado = 'activa' 
       AND (eliminado IS NULL OR eliminado = 0)`,
      instituciones
    );

    if (institucionesExistentes.length !== instituciones.length) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Una o más instituciones no existen, están inactivas o fueron eliminadas'
      });
    }

    // Verificar si ya hay asignaciones
    const [asignacionesExistentes] = await connection.execute(
      'SELECT COUNT(*) as total FROM rifa_instituciones WHERE rifa_id = ?',
      [rifaId]
    );

    if (asignacionesExistentes[0].total > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Esta rifa ya tiene instituciones asignadas'
      });
    }

    // Calcular división automática
    const totalNumeros = rifa.cantidad_numeros;
    const cantidadInstituciones = instituciones.length;
    const numerosPorInstitucion = Math.floor(totalNumeros / cantidadInstituciones);
    const numerosRestantes = totalNumeros % cantidadInstituciones;

    console.log('🔢 División automática:', {
      totalNumeros,
      cantidadInstituciones,
      numerosPorInstitucion,
      numerosRestantes
    });

    let numeroActual = 1;
    const asignaciones = [];

    // Crear asignaciones y actualizar números
    for (let i = 0; i < instituciones.length; i++) {
      const institucionId = instituciones[i];
      
      const cantidad = numerosPorInstitucion + (i === 0 ? numerosRestantes : 0);
      const numeroDesde = numeroActual;
      const numeroHasta = numeroActual + cantidad - 1;

      console.log(`  ➡️ Institución ${institucionId}: ${numeroDesde} - ${numeroHasta} (${cantidad} números)`);

      // Insertar asignación en rifa_instituciones
      const [result] = await connection.execute(
        `INSERT INTO rifa_instituciones 
        (rifa_id, institucion_id, numero_desde, numero_hasta, cantidad_numeros, estado)
        VALUES (?, ?, ?, ?, ?, 'activo')`,
        [rifaId, institucionId, numeroDesde, numeroHasta, cantidad]
      );

      asignaciones.push({
        id: result.insertId,
        institucion_id: institucionId,
        numero_desde: numeroDesde,
        numero_hasta: numeroHasta,
        cantidad_numeros: cantidad
      });

      // ✅ ACTUALIZAR números existentes (NO INSERTAR)
      console.log(`  📝 Actualizando ${cantidad} números existentes...`);
      
      const [updateResult] = await connection.execute(
        `UPDATE numeros_rifa 
         SET institucion_id = ?
         WHERE rifa_id = ? 
           AND numero BETWEEN ? AND ?`,
        [institucionId, rifaId, numeroDesde, numeroHasta]
      );

      console.log(`  ✅ ${updateResult.affectedRows} números actualizados`);

      numeroActual = numeroHasta + 1;
    }

    await connection.commit();
    console.log('✅ Asignación completada exitosamente');

    res.status(201).json({
      status: 'success',
      message: 'Instituciones asignadas exitosamente',
      data: {
        rifa_id: rifaId,
        total_numeros: totalNumeros,
        instituciones_asignadas: asignaciones.length,
        asignaciones: asignaciones
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al asignar instituciones:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al asignar instituciones a la rifa',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ==========================================
// OBTENER INSTITUCIONES DE UNA RIFA
// ==========================================
export const obtenerInstitucionesDeRifa = async (req, res) => {
  try {
    const { rifaId } = req.params;

    const [asignaciones] = await db.execute(
      `SELECT 
        ri.id,
        ri.numero_desde,
        ri.numero_hasta,
        ri.cantidad_numeros,
        ri.estado as asignacion_estado,
        i.id as institucion_id,
        i.nombre as institucion_nombre,
        i.logo_url as institucion_logo,
        i.estado as institucion_estado,
        COUNT(CASE WHEN nr.estado = 'vendido' THEN 1 END) as cantidad_vendida
      FROM rifa_instituciones ri
      INNER JOIN instituciones i ON ri.institucion_id = i.id
      LEFT JOIN numeros_rifa nr ON nr.rifa_id = ri.rifa_id 
        AND nr.institucion_id = ri.institucion_id
      WHERE ri.rifa_id = ?
      GROUP BY ri.id, i.id, i.nombre, i.logo_url, i.estado
      ORDER BY ri.numero_desde ASC`,
      [rifaId]
    );

    const resultado = asignaciones.map(asig => ({
      id: asig.id,
      institucion: {
        id: asig.institucion_id,
        nombre: asig.institucion_nombre,
        logo_url: asig.institucion_logo,
        estado: asig.institucion_estado
      },
      numero_desde: asig.numero_desde,
      numero_hasta: asig.numero_hasta,
      cantidad_numeros: asig.cantidad_numeros,
      cantidad_vendida: asig.cantidad_vendida,
      porcentaje_vendido: ((asig.cantidad_vendida / asig.cantidad_numeros) * 100).toFixed(2),
      estado: asig.asignacion_estado
    }));

    res.json({
      status: 'success',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error al obtener instituciones de rifa:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener instituciones',
      error: error.message
    });
  }
};

// ==========================================
// ASIGNAR NÚMEROS A VENDEDOR
// ==========================================
export const asignarNumerosAVendedor = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { rifaInstitucionId } = req.params;
    const { vendedor_id, cantidad } = req.body;

    console.log('👤 Asignando números a vendedor:', { rifaInstitucionId, vendedor_id, cantidad });

    // Validaciones
    if (!vendedor_id || !cantidad || cantidad <= 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Debe proporcionar vendedor_id y cantidad válida'
      });
    }

    // Verificar que el bloque institución existe
    const [rifaInstituciones] = await connection.execute(
      `SELECT ri.*, i.nombre as institucion_nombre
       FROM rifa_instituciones ri
       INNER JOIN instituciones i ON ri.institucion_id = i.id
       WHERE ri.id = ?`,
      [rifaInstitucionId]
    );

    if (rifaInstituciones.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Bloque de institución no encontrado'
      });
    }

    const rifaInstitucion = rifaInstituciones[0];

    // ✅ Verificar vendedor - Adaptable a 'activo' o 'estado'
    // Primero intentamos con 'estado', si falla probamos con 'activo'
    let vendedor;
    try {
      const [vendedores] = await connection.execute(
        'SELECT * FROM usuarios WHERE id = ? AND rol = "vendedor" AND estado = "activo"',
        [vendedor_id]
      );
      vendedor = vendedores[0];
    } catch (error) {
      // Si falla, probablemente usa 'activo' en lugar de 'estado'
      const [vendedores] = await connection.execute(
        'SELECT * FROM usuarios WHERE id = ? AND rol = "vendedor" AND activo = 1',
        [vendedor_id]
      );
      vendedor = vendedores[0];
    }

    if (!vendedor) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Vendedor no encontrado o inactivo'
      });
    }

    // Buscar números disponibles en el rango de la institución
    const [numerosDisponibles] = await connection.execute(
      `SELECT id, numero 
       FROM numeros_rifa
       WHERE rifa_id = ?
         AND institucion_id = ?
         AND vendedor_id IS NULL
         AND estado = 'disponible'
         AND numero BETWEEN ? AND ?
       ORDER BY numero ASC
       LIMIT ?`,
      [
        rifaInstitucion.rifa_id,
        rifaInstitucion.institucion_id,
        rifaInstitucion.numero_desde,
        rifaInstitucion.numero_hasta,
        cantidad
      ]
    );

    if (numerosDisponibles.length < cantidad) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `Solo hay ${numerosDisponibles.length} números disponibles, se solicitaron ${cantidad}`
      });
    }

    // Asignar números al vendedor
    const numerosIds = numerosDisponibles.map(n => n.id);
    const placeholders = numerosIds.map(() => '?').join(',');
    
    await connection.execute(
      `UPDATE numeros_rifa SET vendedor_id = ? WHERE id IN (${placeholders})`,
      [vendedor_id, ...numerosIds]
    );

    // Registrar la asignación
    const primerNumero = numerosDisponibles[0].numero;
    const ultimoNumero = numerosDisponibles[numerosDisponibles.length - 1].numero;

    const [resultAsignacion] = await connection.execute(
      `INSERT INTO rifa_vendedores 
      (rifa_institucion_id, vendedor_id, numero_desde, numero_hasta, cantidad_asignada, cantidad_vendida)
      VALUES (?, ?, ?, ?, ?, 0)`,
      [rifaInstitucionId, vendedor_id, primerNumero, ultimoNumero, cantidad]
    );

    await connection.commit();
    console.log('✅ Números asignados exitosamente');

    res.status(201).json({
      status: 'success',
      message: 'Números asignados al vendedor exitosamente',
      data: {
        asignacion_id: resultAsignacion.insertId,
        vendedor: {
          id: vendedor.id,
          nombre: vendedor.nombre,
          email: vendedor.email
        },
        institucion: rifaInstitucion.institucion_nombre,
        numero_desde: primerNumero,
        numero_hasta: ultimoNumero,
        cantidad_asignada: cantidad,
        numeros_asignados: numerosDisponibles.map(n => n.numero)
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al asignar números a vendedor:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al asignar números al vendedor',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ==========================================
// OBTENER VENDEDORES DE UNA INSTITUCIÓN
// ==========================================
export const obtenerVendedoresDeInstitucion = async (req, res) => {
  try {
    const { rifaInstitucionId } = req.params;

    const [vendedores] = await db.execute(
      `SELECT 
        rv.id,
        rv.numero_desde,
        rv.numero_hasta,
        rv.cantidad_asignada,
        rv.cantidad_vendida,
        rv.fecha_asignacion,
        u.id as vendedor_id,
        u.nombre as vendedor_nombre,
        u.email as vendedor_email,
        u.telefono as vendedor_telefono
      FROM rifa_vendedores rv
      INNER JOIN usuarios u ON rv.vendedor_id = u.id
      WHERE rv.rifa_institucion_id = ?
      ORDER BY rv.fecha_asignacion DESC`,
      [rifaInstitucionId]
    );

    const resultado = vendedores.map(v => ({
      id: v.id,
      numero_desde: v.numero_desde,
      numero_hasta: v.numero_hasta,
      cantidad_asignada: v.cantidad_asignada,
      cantidad_vendida: v.cantidad_vendida,
      fecha_asignacion: v.fecha_asignacion,
      vendedor: {
        id: v.vendedor_id,
        nombre: v.vendedor_nombre,
        email: v.vendedor_email,
        telefono: v.vendedor_telefono
      }
    }));

    res.json({
      status: 'success',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error al obtener vendedores:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener vendedores',
      error: error.message
    });
  }
};