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

      // Actualizar números existentes (NO INSERTAR)
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
      GROUP BY ri.id, i.id, i.nombre, i.logo_url, i.estado, ri.numero_desde, 
               ri.numero_hasta, ri.cantidad_numeros, ri.estado
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
// ASIGNAR NÚMEROS A VENDEDOR (3 MODALIDADES + DOBLE REGISTRO)
// ==========================================
export const asignarNumerosAVendedor = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { rifaInstitucionId } = req.params;
    const { 
      vendedor_id, 
      tipo_asignacion,
      numeros,      // Para 'individual': [1, 5, 10, 20]
      rango,        // Para 'rango': { desde: 100, hasta: 150 }
      cantidad      // Para 'aleatorio': 25
    } = req.body;

    console.log('👤 Asignando números a vendedor:', { 
      rifaInstitucionId, 
      vendedor_id, 
      tipo_asignacion 
    });

    // ===== VALIDACIONES BÁSICAS =====
    if (!vendedor_id || !tipo_asignacion) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Debe proporcionar vendedor_id y tipo_asignacion'
      });
    }

    const tiposValidos = ['individual', 'rango', 'aleatorio'];
    if (!tiposValidos.includes(tipo_asignacion)) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `Tipo de asignación inválido. Use: ${tiposValidos.join(', ')}`
      });
    }

    // ===== VERIFICAR BLOQUE INSTITUCIÓN =====
    const [rifaInstituciones] = await connection.execute(
      `SELECT ri.*, i.nombre as institucion_nombre, r.estado as rifa_estado
       FROM rifa_instituciones ri
       INNER JOIN instituciones i ON ri.institucion_id = i.id
       INNER JOIN rifas r ON ri.rifa_id = r.id
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

    if (rifaInstitucion.rifa_estado !== 'activa') {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Solo se pueden asignar números en rifas activas'
      });
    }

    // ===== VERIFICAR VENDEDOR =====
    let vendedor;
    try {
      const [vendedores] = await connection.execute(
        'SELECT * FROM usuarios WHERE id = ? AND rol = "vendedor" AND estado = "activo"',
        [vendedor_id]
      );
      vendedor = vendedores[0];
    } catch (error) {
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

    if (vendedor.institucion_id && vendedor.institucion_id !== rifaInstitucion.institucion_id) {
      await connection.rollback();
      return res.status(403).json({
        status: 'error',
        message: 'El vendedor no pertenece a esta institución'
      });
    }

    // ===== DETERMINAR QUÉ NÚMEROS ASIGNAR =====
    let numerosAAsignar = [];

    switch (tipo_asignacion) {
      case 'individual':
        if (!numeros || !Array.isArray(numeros) || numeros.length === 0) {
          await connection.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Debe proporcionar un array de números para asignación individual'
          });
        }

        const numerosInvalidos = numeros.filter(
          n => n < rifaInstitucion.numero_desde || n > rifaInstitucion.numero_hasta
        );

        if (numerosInvalidos.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            status: 'error',
            message: `Números fuera del rango (${rifaInstitucion.numero_desde}-${rifaInstitucion.numero_hasta}): ${numerosInvalidos.join(', ')}`
          });
        }

        numerosAAsignar = numeros.sort((a, b) => a - b);
        break;

      case 'rango':
        if (!rango || !rango.desde || !rango.hasta) {
          await connection.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Debe proporcionar rango.desde y rango.hasta'
          });
        }

        const desde = parseInt(rango.desde);
        const hasta = parseInt(rango.hasta);

        if (isNaN(desde) || isNaN(hasta) || desde > hasta) {
          await connection.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Rango inválido'
          });
        }

        if (desde < rifaInstitucion.numero_desde || hasta > rifaInstitucion.numero_hasta) {
          await connection.rollback();
          return res.status(400).json({
            status: 'error',
            message: `El rango debe estar entre ${rifaInstitucion.numero_desde} y ${rifaInstitucion.numero_hasta}`
          });
        }

        for (let i = desde; i <= hasta; i++) {
          numerosAAsignar.push(i);
        }
        break;

      case 'aleatorio':
        if (!cantidad || cantidad <= 0) {
          await connection.rollback();
          return res.status(400).json({
            status: 'error',
            message: 'Debe proporcionar una cantidad válida (mayor a 0)'
          });
        }

        // Obtener números disponibles (que NO estén en vendedor_numeros con estado 'asignado')
        const [disponibles] = await connection.execute(
          `SELECT nr.id, nr.numero 
           FROM numeros_rifa nr
           LEFT JOIN vendedor_numeros vn ON vn.numero_id = nr.id AND vn.estado = 'asignado'
           WHERE nr.rifa_id = ?
             AND nr.institucion_id = ?
             AND nr.estado = 'disponible'
             AND nr.numero BETWEEN ? AND ?
             AND vn.id IS NULL
           ORDER BY nr.numero ASC`,
          [
            rifaInstitucion.rifa_id,
            rifaInstitucion.institucion_id,
            rifaInstitucion.numero_desde,
            rifaInstitucion.numero_hasta
          ]
        );

        if (disponibles.length < cantidad) {
          await connection.rollback();
          return res.status(400).json({
            status: 'error',
            message: `Solo hay ${disponibles.length} números disponibles, solicitó ${cantidad}`
          });
        }

        // Fisher-Yates shuffle
        const numerosDisponibles = [...disponibles];
        for (let i = numerosDisponibles.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [numerosDisponibles[i], numerosDisponibles[j]] = [numerosDisponibles[j], numerosDisponibles[i]];
        }

        numerosAAsignar = numerosDisponibles.slice(0, cantidad).map(n => n.numero).sort((a, b) => a - b);
        break;
    }

    console.log(`  📋 Números a asignar: ${numerosAAsignar.length}`);

    // ===== OBTENER IDs DE LOS NÚMEROS Y VERIFICAR DISPONIBILIDAD =====
    const placeholders = numerosAAsignar.map(() => '?').join(',');
    const [numerosDB] = await connection.execute(
      `SELECT nr.id, nr.numero, nr.estado, nr.vendedor_id
       FROM numeros_rifa nr
       WHERE nr.rifa_id = ?
         AND nr.institucion_id = ?
         AND nr.numero IN (${placeholders})`,
      [rifaInstitucion.rifa_id, rifaInstitucion.institucion_id, ...numerosAAsignar]
    );

    if (numerosDB.length !== numerosAAsignar.length) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Algunos números no existen en esta institución'
      });
    }

    // Verificar que NO estén ya asignados en vendedor_numeros
    const numerosIds = numerosDB.map(n => n.id);
    const placeholdersIds = numerosIds.map(() => '?').join(',');
    
    const [yaAsignados] = await connection.execute(
      `SELECT vn.numero_id, nr.numero
       FROM vendedor_numeros vn
       INNER JOIN numeros_rifa nr ON vn.numero_id = nr.id
       WHERE vn.numero_id IN (${placeholdersIds})
         AND vn.estado = 'asignado'`,
      numerosIds
    );

    if (yaAsignados.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `Los siguientes números ya están asignados: ${yaAsignados.map(n => n.numero).join(', ')}`
      });
    }

    // Verificar que estén en estado disponible
    const noDisponibles = numerosDB.filter(n => n.estado !== 'disponible');
    if (noDisponibles.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `Números no disponibles: ${noDisponibles.map(n => n.numero).join(', ')}`
      });
    }

    // ===== 1. INSERTAR EN TABLA INTERMEDIA vendedor_numeros =====
    const valoresInsert = numerosDB.map(n => 
      `(${rifaInstitucion.rifa_id}, ${vendedor_id}, ${n.id}, NOW(), 'asignado')`
    ).join(',');

    await connection.execute(
      `INSERT INTO vendedor_numeros 
       (rifa_id, vendedor_id, numero_id, fecha_asignacion, estado)
       VALUES ${valoresInsert}`
    );

    console.log(`  ✅ ${numerosDB.length} registros insertados en vendedor_numeros`);

    // ===== 2. ACTUALIZAR CAMPO vendedor_id EN numeros_rifa =====
    await connection.execute(
      `UPDATE numeros_rifa 
       SET vendedor_id = ?
       WHERE id IN (${placeholdersIds})`,
      [vendedor_id, ...numerosIds]
    );

    console.log(`  ✅ ${numerosDB.length} números actualizados con vendedor_id en numeros_rifa`);

    // ===== 3. REGISTRAR RESUMEN EN rifa_vendedores =====
    const primerNumero = numerosAAsignar[0];
    const ultimoNumero = numerosAAsignar[numerosAAsignar.length - 1];

    const [resultAsignacion] = await connection.execute(
      `INSERT INTO rifa_vendedores 
      (rifa_institucion_id, vendedor_id, numero_desde, numero_hasta, cantidad_asignada, cantidad_vendida)
      VALUES (?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE
        cantidad_asignada = cantidad_asignada + VALUES(cantidad_asignada),
        numero_hasta = VALUES(numero_hasta)`,
      [rifaInstitucionId, vendedor_id, primerNumero, ultimoNumero, numerosAAsignar.length]
    );

    await connection.commit();
    console.log('✅ Asignación completada exitosamente');

    res.status(201).json({
      status: 'success',
      message: `${numerosAAsignar.length} número(s) asignado(s) exitosamente a ${vendedor.nombre}`,
      data: {
        tipo_asignacion,
        vendedor: {
          id: vendedor.id,
          nombre: vendedor.nombre,
          email: vendedor.email
        },
        institucion: rifaInstitucion.institucion_nombre,
        numero_desde: primerNumero,
        numero_hasta: ultimoNumero,
        cantidad_asignada: numerosAAsignar.length,
        numeros_asignados: numerosAAsignar
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al asignar números:', error);
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
      porcentaje_vendido: v.cantidad_asignada > 0 
        ? ((v.cantidad_vendida / v.cantidad_asignada) * 100).toFixed(2) 
        : '0.00',
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

// ==========================================
// OBTENER NÚMEROS DISPONIBLES DE INSTITUCIÓN
// ==========================================
export const obtenerNumerosDisponiblesDeInstitucion = async (req, res) => {
  try {
    const { rifaInstitucionId } = req.params;

    // Obtener info de la institución
    const [rifaInstituciones] = await db.execute(
      `SELECT ri.*, i.nombre as institucion_nombre
       FROM rifa_instituciones ri
       INNER JOIN instituciones i ON ri.institucion_id = i.id
       WHERE ri.id = ?`,
      [rifaInstitucionId]
    );

    if (rifaInstituciones.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Bloque de institución no encontrado'
      });
    }

    const rifaInstitucion = rifaInstituciones[0];

    // Obtener números disponibles (que NO estén asignados en vendedor_numeros)
    const [numeros] = await db.execute(
      `SELECT nr.numero
       FROM numeros_rifa nr
       LEFT JOIN vendedor_numeros vn ON vn.numero_id = nr.id AND vn.estado = 'asignado'
       WHERE nr.rifa_id = ?
         AND nr.institucion_id = ?
         AND nr.estado = 'disponible'
         AND nr.numero BETWEEN ? AND ?
         AND vn.id IS NULL
       ORDER BY nr.numero ASC`,
      [
        rifaInstitucion.rifa_id,
        rifaInstitucion.institucion_id,
        rifaInstitucion.numero_desde,
        rifaInstitucion.numero_hasta
      ]
    );

    res.json({
      status: 'success',
      data: {
        institucion: rifaInstitucion.institucion_nombre,
        rango: {
          inicio: rifaInstitucion.numero_desde,
          fin: rifaInstitucion.numero_hasta,
          total: rifaInstitucion.numero_hasta - rifaInstitucion.numero_desde + 1
        },
        disponibles: {
          total: numeros.length,
          numeros: numeros.map(n => n.numero)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener números disponibles:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener números disponibles',
      error: error.message
    });
  }
};

// ==========================================
// OBTENER NÚMEROS ASIGNADOS A UN VENDEDOR
// ==========================================
export const obtenerNumerosAsignadosAVendedor = async (req, res) => {
  try {
    const { vendedorId } = req.params;
    const { rifaInstitucionId } = req.query;

    let query = `
      SELECT 
        nr.id,
        nr.numero,
        nr.estado,
        vn.fecha_asignacion,
        vn.estado as asignacion_estado,
        nr.rifa_id,
        r.titulo as rifa_titulo,
        r.estado as rifa_estado,
        ri.id as rifa_institucion_id,
        i.nombre as institucion_nombre
      FROM vendedor_numeros vn
      INNER JOIN numeros_rifa nr ON vn.numero_id = nr.id
      INNER JOIN rifas r ON nr.rifa_id = r.id
      LEFT JOIN instituciones i ON nr.institucion_id = i.id
      LEFT JOIN rifa_instituciones ri ON ri.rifa_id = nr.rifa_id AND ri.institucion_id = nr.institucion_id
      WHERE vn.vendedor_id = ?
        AND vn.estado = 'asignado'
    `;

    const params = [vendedorId];

    if (rifaInstitucionId) {
      query += ' AND ri.id = ?';
      params.push(rifaInstitucionId);
    }

    query += ' ORDER BY nr.rifa_id ASC, nr.numero ASC';

    const [numeros] = await db.execute(query, params);

    // Agrupar por rifa
    const agrupadosPorRifa = numeros.reduce((acc, numero) => {
      const rifaId = numero.rifa_id;
      if (!acc[rifaId]) {
        acc[rifaId] = {
          rifa: {
            id: numero.rifa_id,
            titulo: numero.rifa_titulo,
            estado: numero.rifa_estado
          },
          institucion: {
            id: numero.rifa_institucion_id,
            nombre: numero.institucion_nombre
          },
          numeros: []
        };
      }
      acc[rifaId].numeros.push({
        id: numero.id,
        numero: numero.numero,
        estado: numero.estado,
        asignacion_estado: numero.asignacion_estado,
        fecha_asignacion: numero.fecha_asignacion
      });
      return acc;
    }, {});

    res.json({
      status: 'success',
      data: {
        total: numeros.length,
        rifas: Object.values(agrupadosPorRifa)
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener números del vendedor:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener números del vendedor',
      error: error.message
    });
  }
};

// ==========================================
// LIBERAR NÚMEROS ASIGNADOS
// ==========================================
export const liberarNumerosDeVendedor = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { numero_ids } = req.body;

    console.log('🔓 Liberando números:', { numero_ids });

    if (!numero_ids || !Array.isArray(numero_ids) || numero_ids.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Debe proporcionar un array de IDs de números (de numeros_rifa)'
      });
    }

    // Verificar que los números existen
    const placeholders = numero_ids.map(() => '?').join(',');
    const [numeros] = await connection.execute(
      `SELECT id, numero, estado FROM numeros_rifa WHERE id IN (${placeholders})`,
      numero_ids
    );

    if (numeros.length !== numero_ids.length) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Algunos números no fueron encontrados'
      });
    }

    // Verificar que no están vendidos
    const vendidos = numeros.filter(n => n.estado === 'vendido');
    if (vendidos.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `No se pueden liberar números vendidos: ${vendidos.map(n => n.numero).join(', ')}`
      });
    }

    // ===== 1. MARCAR COMO LIBERADO EN vendedor_numeros =====
    await connection.execute(
      `UPDATE vendedor_numeros 
       SET estado = 'liberado', fecha_liberacion = NOW()
       WHERE numero_id IN (${placeholders})
         AND estado = 'asignado'`,
      numero_ids
    );

    console.log(`  ✅ Registros actualizados en vendedor_numeros`);

    // ===== 2. LIMPIAR vendedor_id EN numeros_rifa =====
    await connection.execute(
      `UPDATE numeros_rifa 
       SET vendedor_id = NULL
       WHERE id IN (${placeholders})
         AND estado = 'disponible'`,
      numero_ids
    );

    console.log(`  ✅ Campo vendedor_id limpiado en numeros_rifa`);

    await connection.commit();

    res.json({
      status: 'success',
      message: `${numeros.length} número(s) liberado(s) exitosamente`,
      data: {
        cantidad_liberada: numeros.length,
        numeros_liberados: numeros.map(n => n.numero)
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al liberar números:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al liberar números',
      error: error.message
    });
  } finally {
    connection.release();
  }
};