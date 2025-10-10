import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tamaño del boleto: 12 cm x 5 cm = 340.16 x 141.73 pt
 */
export const generarBoletoPDF = async (numero, rifa, institucion) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [340.16, 141.73],
        margins: { top: 10, bottom: 10, left: 15, right: 15 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // =======================
      // Generar QR
      // =======================
      let qrData = numero.qr_code;
      if (!qrData) {
        const hash = numero.hash_verificacion?.substring(0, 16) || Math.random().toString(36).substring(7);
        qrData = `https://rifas.huelemu.com.ar/comprar/${rifa.id}/${numero.numero}?hash=${hash}`;
      }
      const qrDataUrl = await QRCode.toDataURL(qrData, { width: 80, margin: 1 });

      // =======================
      // Logo Institución
      // =======================
      const logoX = 15;
      const logoY = 20;
      const logoW = 55;
      const logoH = 55;

      if (institucion.logo_url) {
        try {
          const logoPath = path.join(__dirname, '../../', institucion.logo_url);
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, logoX, logoY, { width: logoW, height: logoH });
          }
        } catch (err) {
          console.log('⚠️ Error cargando logo:', err.message);
        }
      }

      // =======================
      // QR + Número + Precio
      // =======================
      const qrX = 240;
      const qrY = 25;
      doc.font('Helvetica-Bold').fontSize(11).text(`N° ${String(numero.numero).padStart(6, '0')}`, qrX, qrY - 10);
      doc.image(qrDataUrl, qrX, qrY, { width: 80, height: 80 });
      doc.font('Helvetica').fontSize(10).text(`Precio: $${parseFloat(numero.precio).toFixed(2)}`, qrX, qrY + 85);

      // =======================
      // Información de la Rifa (centro)
      // =======================
      const infoX = 95;
      const infoY = 25;

      doc.font('Helvetica-Bold').fontSize(12).text(rifa.nombre, infoX, infoY, {
        width: 130,
        align: 'center'
      });

      doc.font('Helvetica').fontSize(9).text(`Organiza: ${institucion.nombre}`, infoX, infoY + 20, {
        width: 130,
        align: 'center'
      });

      // Premios hardcodeados
      doc.font('Helvetica').fontSize(8).fillColor('#333').text(
        `1° Premio: Televisor LED 50"\n2° Premio: Bicicleta\n3° Premio: Cena para 2 personas`,
        infoX,
        infoY + 40,
        { width: 130, align: 'left' }
      );

      // =======================
      // Footer
      // =======================
      doc.moveTo(15, 125).lineTo(325, 125).strokeColor('#aaa').stroke();
      doc.fontSize(7).fillColor('#666').text('Verificá tu número en: rifas.huelemu.com.ar', 15, 128, {
        width: 310,
        align: 'center'
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generar boletos masivos (2x2 por hoja A4)
 */
export const generarBoletosMasivos = async (numeros, rifa, institucion) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const boletoW = 340.16;
      const boletoH = 141.73;
      const xStart = 40;
      const yStart = 40;
      const gapX = 30;
      const gapY = 20;

      let x = xStart;
      let y = yStart;
      let count = 0;

      for (const numero of numeros) {
        if (count > 0 && count % 4 === 0) {
          doc.addPage();
          x = xStart;
          y = yStart;
        }

        // QR
        let qrData = numero.qr_code;
        if (!qrData) {
          const hash = numero.hash_verificacion?.substring(0, 16) || Math.random().toString(36).substring(7);
          qrData = `https://rifas.huelemu.com.ar/comprar/${rifa.id}/${numero.numero}?hash=${hash}`;
        }
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 60, margin: 1 });

        // Borde del boleto
        doc.rect(x, y, boletoW, boletoH).stroke();

        // Logo
        if (institucion.logo_url) {
          const logoPath = path.join(__dirname, '../../', institucion.logo_url);
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, x + 10, y + 15, { width: 45, height: 45 });
          }
        }

        // QR + Nº + Precio
        doc.font('Helvetica-Bold').fontSize(10).text(`N° ${String(numero.numero).padStart(6, '0')}`, x + boletoW - 95, y + 10);
        doc.image(qrDataUrl, x + boletoW - 95, y + 22, { width: 65, height: 65 });
        doc.font('Helvetica').fontSize(8).text(`Precio: $${parseFloat(numero.precio).toFixed(2)}`, x + boletoW - 95, y + 90);

        // Centro
        doc.font('Helvetica-Bold').fontSize(10).text(rifa.nombre, x + 80, y + 15, { width: 140, align: 'center' });
        doc.font('Helvetica').fontSize(8).text(`Organiza: ${institucion.nombre}`, x + 80, y + 30, { width: 140, align: 'center' });
        doc.font('Helvetica').fontSize(7).text(
          `1° Premio: Televisor LED 50"\n2° Premio: Bicicleta\n3° Premio: Cena para 2 personas`,
          x + 80,
          y + 48,
          { width: 140, align: 'left' }
        );

        // Footer
        doc.fontSize(6).fillColor('#666').text('rifas.huelemu.com.ar', x + 20, y + boletoH - 15, { width: boletoW - 40, align: 'center' });

        count++;
        if (count % 2 === 0) {
          x = xStart;
          y += boletoH + gapY;
        } else {
          x += boletoW + gapX;
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
