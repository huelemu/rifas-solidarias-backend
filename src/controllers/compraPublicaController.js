import db from '../config/db.js';

// ==========================================
// OBTENER INFORMACIÓN DEL NÚMERO (PÚBLICO)
// ==========================================
export const obtenerInfoNumero = async (req, res) => {
  try {
    const { rifaId, numero } = req.params;
    const { hash } = req.query;

    console.log(`🔍 Consulta pública: Rifa ${rifaId}, Número ${numero}`);

    // ✅ CAMBIAR INNER JOIN → LEFT JOIN
    const [numeros] = await db.execute(
      `SELECT 
        nr.id,
        nr.numero,
        nr.estado,
        nr.qr_code,
        nr.hash_verificacion,
        nr.fecha_venta,
        nr.precio_venta,
        nr.comprador_nombre,
        nr.comprador_email,
        r.id as rifa_id,
        r.nombre as rifa_nombre,
        r.descripcion as rifa_descripcion,
        r.precio_numero as rifa_precio,
        r.fecha_sorteo,
        r.estado as rifa_estado,
        i.nombre as institucion_nombre,
        i.logo_url as institucion_logo
      FROM numeros_rifa nr
      INNER JOIN rifas r ON nr.rifa_id = r.id
      LEFT JOIN instituciones i ON nr.institucion_id = i.id
      WHERE nr.rifa_id = ? AND nr.numero = ?`,
      [rifaId, numero]
    );

    if (numeros.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Número no encontrado'
      });
    }

    const numeroData = numeros[0];

    const precioFinal = parseFloat(numeroData.precio_venta || numeroData.rifa_precio || 0);

    const respuesta = {
      numero: {
        id: numeroData.id,
        numero: numeroData.numero,
        precio: precioFinal,
        estado: numeroData.estado,
        disponible: numeroData.estado === 'disponible'
      },
      rifa: {
        id: numeroData.rifa_id,
        nombre: numeroData.rifa_nombre,
        descripcion: numeroData.rifa_descripcion,
        fecha_sorteo: numeroData.fecha_sorteo,
        estado: numeroData.rifa_estado
      }
    };

    // ✅ Institución opcional
    if (numeroData.institucion_nombre) {
      respuesta.institucion = {
        nombre: numeroData.institucion_nombre,
        logo_url: numeroData.institucion_logo
      };
    }

    if (numeroData.estado === 'vendido' && numeroData.comprador_nombre) {
      respuesta.comprador = {
        nombre: numeroData.comprador_nombre,
        email_parcial: numeroData.comprador_email
          ? numeroData.comprador_email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
          : null,
        fecha_compra: numeroData.fecha_venta
      };
    }

    res.json({
      status: 'success',
      data: respuesta
    });

  } catch (error) {
    console.error('❌ Error al obtener info del número:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener información del número',
      error: error.message
    });
  }
};

// ==========================================
// RESERVAR/COMPRAR NÚMERO (PÚBLICO)
// ==========================================
export const reservarNumero = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { rifaId, numero } = req.params;
    const { nombre, email, telefono, dni, metodo_pago, notas } = req.body;

    console.log(`🎫 Reservando número ${numero} de rifa ${rifaId} para ${nombre}`);

    if (!nombre || !email || !telefono) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Nombre, email y teléfono son requeridos'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Email inválido'
      });
    }

    const [numeros] = await connection.execute(
      `SELECT nr.*, r.estado as rifa_estado, r.nombre as rifa_nombre, r.precio_numero
       FROM numeros_rifa nr
       INNER JOIN rifas r ON nr.rifa_id = r.id
       WHERE nr.rifa_id = ? AND nr.numero = ?
       FOR UPDATE`,
      [rifaId, numero]
    );

    if (numeros.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        message: 'Número no encontrado'
      });
    }

    const numeroData = numeros[0];

    if (numeroData.rifa_estado !== 'activa') {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'La rifa no está activa'
      });
    }

    if (numeroData.estado !== 'disponible') {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `El número ya está ${numeroData.estado}`
      });
    }

    // Buscar o crear participante
    const [participantes] = await connection.execute(
      'SELECT id FROM participantes WHERE email = ?',
      [email]
    );

    let participanteId;

    if (participantes.length > 0) {
      participanteId = participantes[0].id;
      
      await connection.execute(
        `UPDATE participantes 
         SET nombre = ?, telefono = ?, dni = ?, actualizado_en = NOW()
         WHERE id = ?`,
        [nombre, telefono, dni || null, participanteId]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO participantes (nombre, email, telefono, dni)
         VALUES (?, ?, ?, ?)`,
        [nombre, email, telefono, dni || null]
      );
      
      participanteId = result.insertId;
    }

    // Actualizar número con todos los datos
    await connection.execute(
      `UPDATE numeros_rifa 
       SET participante_id = ?, 
           estado = 'vendido',
           fecha_venta = NOW(),
           precio_venta = ?,
           comprador_nombre = ?,
           comprador_email = ?,
           comprador_telefono = ?,
           metodo_pago = ?,
           observaciones = ?
       WHERE id = ?`,
      [
        participanteId,
        numeroData.precio_numero,
        nombre,
        email,
        telefono,
        metodo_pago || 'efectivo',
        notas || null,
        numeroData.id
      ]
    );

    await connection.commit();

    console.log(`✅ Número ${numero} vendido a ${nombre} (${email})`);

    res.status(201).json({
      status: 'success',
      message: '¡Número reservado exitosamente!',
      data: {
        rifa: numeroData.rifa_nombre,
        numero: numeroData.numero,
        comprador: {
          nombre: nombre,
          email: email,
          telefono: telefono
        },
        precio: parseFloat(numeroData.precio_numero),
        fecha_venta: new Date()
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al reservar número:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al reservar el número',
      error: error.message
    });
  } finally {
    connection.release();
  }
};