// archivo: src/config/upload.js
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// DIRECTORIOS DE UPLOADS
// ============================================

const logosDir = path.join(__dirname, '../../uploads/logos');
const rifasDir = path.join(__dirname, '../../uploads/rifas');

// Crear directorios si no existen
[logosDir, rifasDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// CONFIGURACIÓN PARA LOGOS DE INSTITUCIONES
// ============================================

const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, logosDir);
  },
  filename: function (req, file, cb) {
    const institucionId = req.params.id || 'new';
    const extension = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `institucion_${institucionId}_${timestamp}${extension}`);
  }
});

// ============================================
// CONFIGURACIÓN PARA IMÁGENES DE RIFAS
// ============================================

const rifaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, rifasDir);
  },
  filename: function (req, file, cb) {
    const rifaId = req.params.id || 'new';
    const extension = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `rifa_${rifaId}_${timestamp}${extension}`);
  }
});

// ============================================
// FILTRO PARA SOLO IMÁGENES
// ============================================

const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP)'), false);
  }
};

// ============================================
// EXPORTS
// ============================================

// Límite de tamaño: 5MB
const limits = {
  fileSize: 5 * 1024 * 1024 // 5MB
};

export const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageFilter,
  limits: limits
});

export const uploadRifaImage = multer({
  storage: rifaStorage,
  fileFilter: imageFilter,
  limits: limits
});



// Crear directorio si no existe
const uploadsDir = path.join(__dirname, '../../uploads/logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generar nombre único: institucion_123_timestamp.jpg
    const institucionId = req.params.id || 'new';
    const extension = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `institucion_${institucionId}_${timestamp}${extension}`);
  }
});

// Filtro para solo aceptar imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP)'), false);
  }
};

