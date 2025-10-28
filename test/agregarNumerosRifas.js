// =====================================================
// SCRIPT: Agregar números 251-300 a Rifa ID 27
// =====================================================
import crypto from 'crypto';
import db from '../src/config/db.js';

async function agregarNumerosRifa27() {
  let connection;

  try {
    console.info('🔌 Conectando a la base de datos...');
    connection = await db.getConnection();
    console.info('✅ Conexión establecida');

    const RIFA_ID = 27;
    const DESDE = 301;
    const HASTA = 350;

    // Verificar rifa existente
    const [rifas] = await connection.execute('SELECT * FROM rifas WHERE id = ?', [RIFA_ID]);
    if (!rifas.length) throw new Error(`La rifa ID ${RIFA_ID} no existe`);
    const rifa = rifas[0];
    const institucion_id = rifa.institucion_promotora_id;

    console.info(`📊 Rifa "${rifa.nombre}" encontrada (id=${RIFA_ID})`);

    // Verificar números existentes
    const [existentes] = await connection.execute(
      'SELECT numero FROM numeros_rifa WHERE rifa_id = ? AND numero BETWEEN ? AND ?',
      [RIFA_ID, DESDE, HASTA]
    );
    const existentesSet = new Set(existentes.map(e => e.numero));

    // Preparar inserciones
    const nuevos = [];
    const timestamp = Date.now();

    for (let num = DESDE; num <= HASTA; num++) {
      if (existentesSet.has(num)) continue;

      const hash = crypto
        .createHash('sha256')
        .update(`${RIFA_ID}-${num}-${timestamp}-${Math.random()}`)
        .digest('hex');

      const qrCode = `RIFA${RIFA_ID}-${String(num).padStart(6, '0')}-${timestamp}`;
      nuevos.push([RIFA_ID, num, institucion_id, qrCode, hash, 'disponible']);
    }

    if (!nuevos.length) {
      console.info('⚠️ No hay números nuevos para insertar.');
      return;
    }

    console.info(`📝 Insertando ${nuevos.length} nuevos números...`);
    await connection.beginTransaction();

    const batchSize = 20;
    for (let i = 0; i < nuevos.length; i += batchSize) {
      const batch = nuevos.slice(i, i + batchSize);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const values = batch.flat();

      await connection.execute(
        `INSERT INTO numeros_rifa (rifa_id, numero, institucion_id, qr_code, hash_verificacion, estado)
         VALUES ${placeholders}`,
        values
      );
      console.info(`   ➕ Insertados ${i + batch.length}/${nuevos.length}`);
    }

    // Actualizar cantidad total
    const [[{ total }]] = await connection.query(
      'SELECT COUNT(*) AS total FROM numeros_rifa WHERE rifa_id = ?',
      [RIFA_ID]
    );

    await connection.execute(
      'UPDATE rifas SET cantidad_numeros = ?, fecha_actualizacion = NOW() WHERE id = ?',
      [total, RIFA_ID]
    );

    await connection.commit();
    console.info('✅ Transacción completada.');

    // Resumen
    const [[stats]] = await connection.query(
      `SELECT 
        COUNT(*) AS total,
        SUM(estado = 'disponible') AS disponibles,
        SUM(estado = 'vendido') AS vendidos,
        SUM(estado = 'reservado') AS reservados
       FROM numeros_rifa WHERE rifa_id = ?`,
      [RIFA_ID]
    );

    console.info('📊 RESUMEN FINAL:');
    console.info(`   Total: ${stats.total}`);
    console.info(`   Disponibles: ${stats.disponibles}`);
    console.info(`   Vendidos: ${stats.vendidos}`);
    console.info(`   Reservados: ${stats.reservados}`);
    console.info(`   Agregados en esta operación: ${nuevos.length}`);

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('❌ ERROR:', err.message);
  } finally {
    if (connection) {
      connection.release();
      console.info('🔌 Conexión liberada');
    }
  }
}

// Ejecutar
agregarNumerosRifa27()
  .then(() => console.info('✅ Script finalizado.'))
  .catch(() => console.error('❌ Script finalizado con errores.'));
