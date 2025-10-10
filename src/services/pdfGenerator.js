import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Función interna para dibujar un boleto
 */
const dibujarBoleto = async (doc, x, y, numero, rifa, institucion, width = 240, height = 120) => {
  // QR dinámico
  const hashCorto = (numero.hash_verificacion || Math.random().toString(36).substring(7)).substring(0,16);
  const qrData = `https://rifas.huelemu.com.ar/comprar/${rifa.id}/${numero.numero}?hash=${hashCorto}`;
  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 70, margin: 1 });

  // Dibujar borde del boleto
  doc.rect(x, y, width, height).lineWidth(1).stroke();

  // Nombre de la rifa arriba, centrado
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
     .text(rifa.nombre, x, y + 10, { width, align: 'center' });

  // Logo institución a la izquierda (opcional)
  if (institucion.logo_url) {
    try {
      const logoPath = path.join(__dirname, '../../', institucion.logo_url);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, x + 10, y + 35, { width: 60, height: 60 });
      }
    } catch {}
  }

  // QR a la derecha
  const qrX = x + width - 80;
  const qrY = y + 35;
  doc.image(qrDataUrl, qrX, qrY, { width: 70, height: 70 });

  // Recuadro para el número debajo del QR
  const numeroBoxHeight = 25;
  const numeroBoxY = qrY + 75; // justo debajo del QR
  doc.rect(qrX, numeroBoxY, 70, numeroBoxHeight).lineWidth(1).stroke();

  // Número centrado dentro del recuadro
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
     .text(`Nº ${String(numero.numero).padStart(6,'0')}`, qrX, numeroBoxY + 5, { width: 70, align: 'center' });

  // Precio abajo a la derecha
  doc.fontSize(10).font('Helvetica').fillColor('#000000')
     .text(`$${parseFloat(numero.precio || numero.precio_venta).toFixed(2)}`, x + width - 60, y + height - 20);
};


/**
 * Generar un boleto individual
 */
export const generarBoletoPDF = async (numero, rifa, institucion) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [283.46, 141.73], margins: { top: 15, bottom: 15, left: 15, right: 15 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      await dibujarBoleto(doc, 15, 15, numero, rifa, institucion);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generar múltiples boletos (2x2 por página)
 */
export const generarBoletosMasivos = async (numeros, rifa, institucion) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 20, bottom: 20, left: 20, right: 20 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let xPos = 40, yPos = 40, boletosEnPagina = 0;
      const boletosMaxPorPagina = 4;

      for (let i = 0; i < numeros.length; i++) {
        const numero = numeros[i];

        if (boletosEnPagina === boletosMaxPorPagina) {
          doc.addPage();
          boletosEnPagina = 0;
          xPos = 40; yPos = 40;
        }

        await dibujarBoleto(doc, xPos, yPos, numero, rifa, institucion);

        boletosEnPagina++;
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
