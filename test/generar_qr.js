// scripts/regenerar-qr.js

import db from '../src/config/db.js';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

async function regenerarQRCodes() {
  try {
    console.log('🔄 Iniciando regeneración de QR codes...');
    console.log(`📍 URL base: ${FRONTEND_URL}`);

    // Obtener todos los números
    const [numeros] = await db.execute(
      'SELECT id, rifa_id, numero FROM numeros_rifa ORDER BY id'
    );

    console.log(`📊 Total de números encontrados: ${numeros.length}`);

    let actualizados = 0;

    for (const num of numeros) {
      // Generar URL pública
      const urlPublica = `${FRONTEND_URL}/public/rifas/${num.rifa_id}/numero/${num.numero}`;
      
      // Generar nuevo QR
      const qrCodeDataURL = await QRCode.toDataURL(urlPublica, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Actualizar en BD
      await db.execute(
        'UPDATE numeros_rifa SET qr_code = ? WHERE id = ?',
        [qrCodeDataURL, num.id]
      );

      actualizados++;

      if (actualizados % 100 === 0) {
        console.log(`✅ Procesados ${actualizados}/${numeros.length}...`);
      }
    }

    console.log(`\n🎉 ¡Completado! ${actualizados} QR codes regenerados`);
    console.log(`\n📱 Ejemplo de URL: ${FRONTEND_URL}/public/rifas/1/numero/1`);
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

regenerarQRCodes();