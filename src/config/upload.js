// archivo: src/config/upload.js
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// CONFIGURACIÓN PARA LOGOS DE INSTITUCIONES
// ========================================

const uploadsDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storageInstituciones = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const institucionId = req.params.id || 'new';
    const extension = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `institucion_${institucionId}_${timestamp}${extension}`);
  }
});

// ========================================
// CONFIGURACIÓN PARA LOGOS DE RIFAS (SIMPLIFICADO)
// ========================================

const uploadsRifasDir = path.join(__dirname, '../../uploads/rifas');
if (!fs.existsSync(uploadsRifasDir)) {
  fs.mkdirSync(uploadsRifasDir, { recursive: true });
}

const storageRifas = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsRifasDir);
  },
  filename: function (req, file, cb) {
    const rifaId = req.params.id;
    const extension = path.extname(file.originalname);
    // ✅ NOMBRE SIMPLE Y FIJO: rifa_15.jpg
    cb(null, `rifa_${rifaId}${extension}`);
  }
});

// ========================================
// FILTRO COMPARTIDO
// ========================================

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP)'), false);
  }
};

// ========================================
// EXPORTS
// ========================================

export const uploadLogo = multer({
  storage: storageInstituciones,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

export const uploadLogoRifa = multer({
  storage: storageRifas,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});