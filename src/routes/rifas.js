// archivo: src/routes/rifas.js
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import rifasController, { rifasValidations } from '../controllers/rifasController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadLogoRifa } from '../config/upload.js';
import db from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
console.log('🔍 Funciones disponibles en rifasController:', Object.keys(rifasController));


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// ========================================
// LOGO DE LA RIFA
// ========================================

router.post('/:id/logo', 
  requireAuth, 
  requireRole(['admin_global', 'admin_institucion']), 
  uploadLogoRifa.single('logo'),
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log('📤 Subiendo logo para rifa ID:', id);

      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No se proporcionó ningún archivo'
        });
      }

      const [rifas] = await db.execute('SELECT id FROM rifas WHERE id = ?', [id]);
      if (rifas.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ status: 'error', message: 'Rifa no encontrada' });
      }

      const logoUrl = `/uploads/rifas/${req.file.filename}`;
      await db.execute('UPDATE rifas SET imagen_url = ? WHERE id = ?', [logoUrl, id]);

      console.log('✅ Logo subido exitosamente:', logoUrl);

      res.json({
        status: 'success',
        message: 'Logo subido exitosamente',
        data: { logo_url: logoUrl }
      });

    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('❌ Error al subir logo:', error);
      res.status(500).json({ status: 'error', message: 'Error al subir logo', error: error.message });
    }
  }
);

router.delete('/:id/logo',
  requireAuth,
  requireRole(['admin_global', 'admin_institucion']),
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log('🗑️ Eliminando logo de rifa ID:', id);

      const [rifas] = await db.execute('SELECT imagen_url FROM rifas WHERE id = ?', [id]);
      if (rifas.length === 0)
        return res.status(404).json({ status: 'error', message: 'Rifa no encontrada' });

      const logoUrl = rifas[0].imagen_url;
      if (!logoUrl)
        return res.status(400).json({ status: 'error', message: 'La rifa no tiene logo' });

      const uploadsDir = path.join(__dirname, '../../uploads/rifas');
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      extensions.forEach(ext => {
        const filePath = path.join(uploadsDir, `rifa_${id}${ext}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('🗑️ Logo eliminado:', filePath);
        }
      });

      await db.execute('UPDATE rifas SET imagen_url = NULL WHERE id = ?', [id]);

      console.log('✅ Logo eliminado exitosamente');
      res.json({ status: 'success', message: 'Logo eliminado exitosamente' });

    } catch (error) {
      console.error('❌ Error al eliminar logo:', error);
      res.status(500).json({ status: 'error', message: 'Error al eliminar logo', error: error.message });
    }
  }
);

// ========================================
// RUTAS PÚBLICAS
// ========================================

router.get('/', rifasController.listarRifas);
router.get('/:id', rifasController.obtenerRifa);

// ========================================
// RUTAS PROTEGIDAS (CRUD DE RIFAS)
// ========================================

router.post('/', 
  requireAuth, 
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.crearRifa,
  rifasController.crearRifa
);

router.put('/:id', 
  requireAuth, 
  requireRole(['admin_global', 'admin_institucion']),
  rifasValidations.actualizarRifa,
  rifasController.actualizarRifa
);

router.delete('/:id', 
  requireAuth, 
  requireRole(['admin_global']), 
  rifasController.eliminarRifa
);

// ========================================
// NUEVAS RUTAS - PARTICIPACIONES / INVITACIONES
// ========================================

router.post('/:id/invitar', 
  requireAuth, 
  requireRole(['admin_global', 'admin_institucion']), 
  rifasController.invitarInstituciones
);

router.get('/:id/participaciones', 
  requireAuth, 
  rifasController.obtenerParticipaciones
);

router.put('/:id/participaciones/:participacionId/aprobar', 
  requireAuth, 
  requireRole(['admin_global', 'admin_institucion']), 
  rifasController.aprobarParticipacion
);

router.put('/:id/participaciones/:participacionId/rechazar', 
  requireAuth, 
  requireRole(['admin_global', 'admin_institucion']), 
  rifasController.rechazarParticipacion
);

router.delete('/:id/participaciones/:participacionId', 
  requireAuth, 
  rifasController.retirarParticipacion
);

export default router;
