import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generar un boleto individual en PDF
 * Tamaño: 10cm x 5cm (283.46 x 141.73 puntos)
 */
export const generarBoletoPDF = async (numero, rifa, institucion) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Crear documento PDF (10cm x 5cm)
      const doc = new PDFDocument({
        size: [283.46, 141.73], // 10cm x 5cm en puntos (1cm = 28.346pt)
        margins: {
          top: 15,
          bottom: 15,
          left: 15,
          right: 15
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ✅ GENERAR QR CODE CON PROTECCIÓN
      let qrData = numero.qr_code;

      // Si qr_code está vacío o null, generar uno dinámicamente
      if (!qrData || qrData === '' || qrData === null) {
        const hashCorto = (numero.hash_verificacion && numero.hash_verificacion !== '') 
          ? numero.hash_verificacion.substring(0, 16) 
          : Math.random().toString(36).substring(7);
        
        qrData = `https://rifas.huelemu.com.ar/comprar/${rifa.id}/${numero.numero}?hash=${hashCorto}`;
        console.log(`  ⚠️ QR code generado dinámicamente para número ${numero.numero}`);
      }

      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: 80,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // ===================================
      // HEADER - Logo y título
      // ===================================
      
      // Logo de la institución (si existe)
if (institucion.logo_url) {
  try {
    console.log('🖼️ Logo URL:', institucion.logo_url);
    console.log('🖼️ __dirname:', __dirname);
    
    const logoPath = path.join(__dirname, '../../', institucion.logo_url);
    console.log('🖼️ Logo Path completo:', logoPath);
    console.log('🖼️ ¿Existe el archivo?:', fs.existsSync(logoPath));
    
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 15, 15, { width: 40, height: 40 });
      console.log('✅ Logo cargado exitosamente');
    } else {
      console.log('❌ Archivo de logo NO encontrado');
    }
  } catch (error) {
    console.log('⚠️ Error al cargar logo:', error.message);
  }
} else {
  console.log('⚠️ No hay logo_url en la institución');
}

      // Título de la rifa
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('RIFA SOLIDARIA', 60, 20, { align: 'left' });

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#000000')
         .text(rifa.nombre, 60, 35, { width: 140, align: 'left' });

      // Línea divisoria
      doc.moveTo(15, 60)
         .lineTo(268, 60)
         .stroke();

      // ===================================
      // CONTENIDO PRINCIPAL
      // ===================================

      // Número del boleto (grande y destacado)
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text(`Nº ${String(numero.numero).padStart(6, '0')}`, 15, 70);

// ✅ AGREGAR ESTOS LOGS PARA DEBUG
console.log('🎫 Generando PDF con datos:', {
  numero: numero.numero,
  precio: numero.precio,
  tipo_precio: typeof numero.precio,
  precio_parseado: parseFloat(numero.precio)
});

// Precio
doc.fontSize(10)
   .font('Helvetica')
   .fillColor('#000000')
   .text(`Precio: $${parseFloat(numero.precio).toFixed(2)}`, 15, 95);

      // QR Code (derecha)
      doc.image(qrDataUrl, 180, 65, { width: 70, height: 70 });

      // ===================================
      // FOOTER
      // ===================================

      // Institución
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text(institucion.nombre, 15, 110, { width: 250, align: 'left' });

      // Línea divisoria
      doc.moveTo(15, 118)
         .lineTo(268, 118)
         .stroke();

      // URL de verificación
      doc.fontSize(7)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Verificá tu número en: rifas.huelemu.com.ar', 15, 122, { 
           width: 250, 
           align: 'center' 
         });

      // ✅ Hash de verificación (pequeño) CON PROTECCIÓN
      const hashTexto = (numero.hash_verificacion && numero.hash_verificacion !== '') 
        ? numero.hash_verificacion.substring(0, 16) 
        : 'N/A';
      
      doc.fontSize(6)
         .fillColor('#999999')
         .text(`Hash: ${hashTexto}...`, 15, 132, {
           width: 250,
           align: 'center'
         });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generar múltiples boletos en un solo PDF
 * 4 boletos por página (2x2)
 */
export const generarBoletosMasivos = async (numeros, rifa, institucion) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Documento A4 para imprimir múltiples boletos
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 20,
          bottom: 20,
          left: 20,
          right: 20
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let boletosEnPagina = 0;
      const boletosMaxPorPagina = 4; // 2x2 por página
      let xPos = 40;
      let yPos = 40;

      for (let i = 0; i < numeros.length; i++) {
        const numero = numeros[i];

        // Si completamos una página, crear nueva
        if (boletosEnPagina === boletosMaxPorPagina) {
          doc.addPage();
          boletosEnPagina = 0;
          xPos = 40;
          yPos = 40;
        }

        // ✅ GENERAR QR CON PROTECCIÓN
        let qrData = numero.qr_code;

        if (!qrData || qrData === '' || qrData === null) {
          const hashCorto = (numero.hash_verificacion && numero.hash_verificacion !== '') 
            ? numero.hash_verificacion.substring(0, 16) 
            : Math.random().toString(36).substring(7);
          
          qrData = `https://rifas.huelemu.com.ar/comprar/${rifa.id}/${numero.numero}?hash=${hashCorto}`;
        }

        const qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 60,
          margin: 1
        });

        // Dibujar borde del boleto
        doc.rect(xPos, yPos, 240, 120).stroke();

        // Logo
        if (institucion.logo_url) {
          try {
            const logoPath = path.join(__dirname, '../../', institucion.logo_url);
            if (fs.existsSync(logoPath)) {
              doc.image(logoPath, xPos + 10, yPos + 10, { width: 30, height: 30 });
            }
          } catch (error) {
            // Ignorar si no hay logo
          }
        }

        // Título
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text('RIFA SOLIDARIA', xPos + 50, yPos + 15);

        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#000000')
           .text(rifa.nombre, xPos + 50, yPos + 28, { width: 120 });

        // Número
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(`Nº ${String(numero.numero).padStart(6, '0')}`, xPos + 10, yPos + 50);

        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#000000')
           .text(`$${parseFloat(numero.precio_venta).toFixed(2)}`, xPos + 10, yPos + 72);

        // QR
        doc.image(qrDataUrl, xPos + 160, yPos + 35, { width: 60, height: 60 });

        // Institución
        doc.fontSize(7)
           .font('Helvetica-Bold')
           .fillColor('#000000')
           .text(institucion.nombre, xPos + 10, yPos + 90, { width: 220 });

        // URL
        doc.fontSize(6)
           .fillColor('#666666')
           .text('rifas.huelemu.com.ar', xPos + 10, yPos + 105);

        boletosEnPagina++;

        // Posición para el siguiente boleto (2 columnas)
        if (boletosEnPagina % 2 === 0) {
          xPos = 40;
          yPos += 140;
        } else {
          xPos += 260;
        }
      }

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};