import db from '../config/db.js';
import { generarBoletoPDF, generarBoletosMasivos } from '../services/pdfGenerator.js';

// ==========================================
// GENERAR BOLETO INDIVIDUAL
// ==========================================
export const generarBoletoIndividual = async (req, res) => {
  try {
    const { rifaId, numero } = req.params;

    console.log(`📄 Generando boleto para Rifa ${rifaId}, Número ${numero}`);

    // ✅ CAMBIAR A LEFT JOIN
    const [numeros] = await db.execute(
      `SELECT nr.*, 
              r.nombre as rifa_nombre, 
              r.precio_numero as rifa_precio_numero,
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

    console.log('📊 Datos del número:', {
      numero: numeroData.numero,
      precio_en_numero: numeroData.precio,
      precio_en_rifa: numeroData.rifa_precio_numero,
      logo_url: numeroData.institucion_logo
    });

    // ✅ Usar precio de la rifa
    const precioFinal = parseFloat(numeroData.precio || numeroData.rifa_precio_numero || 0);
    
    console.log('💰 Precio final calculado:', precioFinal);

    const rifa = {
      id: rifaId,
      nombre: numeroData.rifa_nombre,
      precio_numero: precioFinal
    };

    // ✅ Institución opcional con fallback
    const institucion = {
      nombre: numeroData.institucion_nombre || 'Rifa Solidaria',
      logo_url: numeroData.institucion_logo || null
    };

    // Asignar precio al objeto número
    const numeroConPrecio = {
      ...numeroData,
      precio: precioFinal
    };

    // Generar PDF
    const pdfBuffer = await generarBoletoPDF(numeroConPrecio, rifa, institucion);

    // Registrar impresión
    await db.execute(
      `UPDATE numeros_rifa 
       SET impreso = 1, fecha_impresion = NOW() 
       WHERE id = ?`,
      [numeroData.id]
    );

    console.log('✅ Boleto generado exitosamente');

    // Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=boleto-${rifaId}-${String(numero).padStart(6, '0')}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error al generar boleto:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar boleto',
      error: error.message
    });
  }
};

// ==========================================
// GENERAR BOLETOS POR INSTITUCIÓN
// ==========================================
export const generarBoletosInstitucion = async (req, res) => {
  try {
    const { rifaId, institucionId } = req.params;
    const { limite } = req.query;

    console.log(`📄 Generando boletos para Rifa ${rifaId}, Institución ${institucionId}`);

    let query = `
      SELECT nr.*, 
             r.nombre as rifa_nombre, 
             r.precio_numero as rifa_precio_numero,
             i.nombre as institucion_nombre, 
             i.logo_url as institucion_logo
      FROM numeros_rifa nr
      INNER JOIN rifas r ON nr.rifa_id = r.id
      LEFT JOIN instituciones i ON nr.institucion_id = i.id
      WHERE nr.rifa_id = ? AND nr.institucion_id = ?
      ORDER BY nr.numero ASC
    `;

    const params = [rifaId, institucionId];

    if (limite) {
      query += ' LIMIT ?';
      params.push(parseInt(limite));
    }

    const [numeros] = await db.execute(query, params);

    if (numeros.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron números para esta institución'
      });
    }

    const precioRifa = parseFloat(numeros[0].rifa_precio_numero || 0);
    
    numeros.forEach(num => {
      num.precio = parseFloat(num.precio || precioRifa || 0);
    });

    const rifa = {
      id: rifaId,
      nombre: numeros[0].rifa_nombre,
      precio_numero: precioRifa
    };

    const institucion = {
      nombre: numeros[0].institucion_nombre || 'Rifa Solidaria',
      logo_url: numeros[0].institucion_logo
    };

    console.log(`  📊 Generando ${numeros.length} boletos con precio $${precioRifa}...`);

    const pdfBuffer = await generarBoletosMasivos(numeros, rifa, institucion);

    const numerosIds = numeros.map(n => n.id);
    const placeholders = numerosIds.map(() => '?').join(',');
    
    await db.execute(
      `UPDATE numeros_rifa 
       SET impreso = 1, fecha_impresion = NOW() 
       WHERE id IN (${placeholders})`,
      numerosIds
    );

    console.log(`  ✅ PDF generado exitosamente`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=boletos-rifa${rifaId}-inst${institucionId}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error al generar boletos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar boletos',
      error: error.message
    });
  }
};

// ==========================================
// GENERAR BOLETOS POR VENDEDOR
// ==========================================
export const generarBoletosVendedor = async (req, res) => {
  try {
    const { rifaId, vendedorId } = req.params;

    console.log(`📄 Generando boletos para Vendedor ${vendedorId}`);

    const [numeros] = await db.execute(
      `SELECT nr.*, 
              r.nombre as rifa_nombre, 
              r.precio_numero as rifa_precio_numero,
              i.nombre as institucion_nombre, 
              i.logo_url as institucion_logo,
              u.nombre as vendedor_nombre
       FROM numeros_rifa nr
       INNER JOIN rifas r ON nr.rifa_id = r.id
       LEFT JOIN instituciones i ON nr.institucion_id = i.id
       INNER JOIN usuarios u ON nr.vendedor_id = u.id
       WHERE nr.rifa_id = ? AND nr.vendedor_id = ?
       ORDER BY nr.numero ASC`,
      [rifaId, vendedorId]
    );

    if (numeros.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontraron números para este vendedor'
      });
    }

    const precioRifa = parseFloat(numeros[0].rifa_precio_numero || 0);
    
    numeros.forEach(num => {
      num.precio = parseFloat(num.precio || precioRifa || 0);
    });

    const rifa = {
      id: rifaId,
      nombre: numeros[0].rifa_nombre,
      precio_numero: precioRifa
    };

    const institucion = {
      nombre: numeros[0].institucion_nombre || 'Rifa Solidaria',
      logo_url: numeros[0].institucion_logo
    };

    console.log(`  📊 Generando ${numeros.length} boletos para ${numeros[0].vendedor_nombre} con precio $${precioRifa}...`);

    const pdfBuffer = await generarBoletosMasivos(numeros, rifa, institucion);

    const numerosIds = numeros.map(n => n.id);
    const placeholders = numerosIds.map(() => '?').join(',');
    
    await db.execute(
      `UPDATE numeros_rifa 
       SET impreso = 1, fecha_impresion = NOW() 
       WHERE id IN (${placeholders})`,
      numerosIds
    );

    console.log(`  ✅ PDF generado exitosamente`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=boletos-vendedor${vendedorId}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error al generar boletos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al generar boletos',
      error: error.message
    });
  }
};