import express from 'express';
import { 
  generarBoletoIndividual,
  generarBoletosInstitucion,
  generarBoletosVendedor
} from '../controllers/impresionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(requireAuth);

/**
 * @swagger
 * /impresion/rifas/{rifaId}/numeros/{numero}/boleto:
 *   get:
 *     summary: Generar boleto individual en PDF
 *     tags: [Impresión]
 */
router.get('/rifas/:rifaId/numeros/:numero/boleto', 
  generarBoletoIndividual
);

/**
 * @swagger
 * /impresion/rifas/{rifaId}/instituciones/{institucionId}/boletos:
 *   get:
 *     summary: Generar boletos de una institución en PDF
 *     tags: [Impresión]
 */
router.get('/rifas/:rifaId/instituciones/:institucionId/boletos', 
  requireRole(['admin_global']),
  generarBoletosInstitucion
);

/**
 * @swagger
 * /impresion/rifas/{rifaId}/vendedores/{vendedorId}/boletos:
 *   get:
 *     summary: Generar boletos de un vendedor en PDF
 *     tags: [Impresión]
 */
router.get('/rifas/:rifaId/vendedores/:vendedorId/boletos', 
  generarBoletosVendedor
);

export default router;